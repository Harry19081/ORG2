//! Narrow adapter for the audited Codex 0.155 native history stores.
//!
//! Callers own the native writer locks, rollout files, recovery journal and
//! identity barrier. This module never opens credentials/configuration, starts
//! an app-server, creates a native database, or rewrites rollout bytes. The
//! source transaction stays open until the prepared copy is dropped. Attached
//! SQLite transactions roll back ordinary failures together; a caller's journal
//! is still required for crash recovery across the two WAL databases and files.

mod schema;
mod snapshot;

use schema::{columns_sql, validate_schema, HISTORY_TABLES, LOCAL_COLUMNS, THREAD_COLUMNS};

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};
use std::time::Duration;

use rusqlite::types::Value;
use rusqlite::{params_from_iter, Connection, OpenFlags, OptionalExtension};
use sha2::{Digest, Sha256};

const STATE_FILE: &str = "state_5.sqlite";
const HISTORY_FILE: &str = "thread_history_1.sqlite";
const MAX_THREADS: usize = 10_000;
const MAX_ROLLOUTS: usize = 4_096;
const MAX_METADATA_BYTES: usize = 64 * 1024 * 1024;
const MAX_PROJECTION_ROWS: i64 = 500_000;
const MAX_PROJECTION_BYTES: i64 = 256 * 1024 * 1024;
#[derive(Clone)]
pub(super) struct ThreadRecord {
    pub id: String,
    pub rollout_path: PathBuf,
    pub cwd: PathBuf,
    /// Portable metadata only: excludes local route, permission and grouping
    /// fields, and includes the rollout filename instead of its profile root.
    pub metadata_hash: String,
    pub history_mode: String,
    values: Vec<Value>,
}

impl std::fmt::Debug for ThreadRecord {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        // Native metadata contains the first user message; never include the
        // raw SQL row in diagnostics, even when a caller logs a record.
        formatter
            .debug_struct("ThreadRecord")
            .field("id", &self.id)
            .field("rollout_path", &self.rollout_path)
            .field("metadata_hash", &self.metadata_hash)
            .field("history_mode", &self.history_mode)
            .finish_non_exhaustive()
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct ProjectionSnapshot {
    /// Immutable rollout ID, which can differ from the stable thread ID.
    pub rollout_id: String,
    pub next_byte_offset: Option<i64>,
    pub next_ordinal: Option<i64>,
}

pub(super) struct PreparedThread {
    source: Connection,
    history_schema: &'static str,
    record: ThreadRecord,
    projections: Vec<ProjectionSnapshot>,
}

impl ThreadRecord {
    /// Returns the stored permission payload without inventing a conversion.
    /// Older native rows contain SandboxPolicy instead of PermissionProfile;
    /// the routing writer must explicitly convert or reject that known shape.
    pub(super) fn routing_settings(
        &self,
    ) -> Result<(Option<String>, String, serde_json::Value, serde_json::Value), String> {
        let model = match &self.values[column_index("model")] {
            Value::Null => None,
            Value::Text(model) if model.is_empty() => None,
            Value::Text(model) => Some(model.clone()),
            _ => return Err("Invalid stored native Codex model".into()),
        };
        let provider = text_value(&self.values, "model_provider")?;
        if provider.is_empty() {
            return Err("Stored native Codex provider is empty".into());
        }
        let permission = serde_json::from_str(&text_value(&self.values, "sandbox_policy")?)
            .map_err(|_| "Invalid stored native Codex permission JSON".to_string())?;
        let approval = text_value(&self.values, "approval_mode")?;
        let approval = match approval.as_str() {
            "on-request" | "on-failure" | "untrusted" | "never" => {
                serde_json::Value::String(approval)
            }
            _ => serde_json::from_str(&approval)
                .map_err(|_| "Invalid stored native Codex approval policy".to_string())?,
        };
        Ok((model, provider, permission, approval))
    }
}

fn db_error(error: rusqlite::Error) -> String {
    format!("Codex history database: {error}")
}

fn database_path(home: &Path, name: &str) -> Result<PathBuf, String> {
    let path = home.join(name);
    for (candidate, directory) in [(home, true), (path.as_path(), false)] {
        let metadata = std::fs::symlink_metadata(candidate)
            .map_err(|error| format!("inspect native Codex history store: {error}"))?;
        if metadata.file_type().is_symlink()
            || (directory && !metadata.is_dir())
            || (!directory && !metadata.is_file())
        {
            return Err("Native Codex history store must be an owned regular path".into());
        }
    }
    for suffix in ["-wal", "-shm", "-journal"] {
        let sidecar = home.join(format!("{name}{suffix}"));
        match std::fs::symlink_metadata(sidecar) {
            Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_file() => {
                return Err("Native Codex database sidecar must be a regular file".into());
            }
            Ok(_) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(format!("inspect native Codex database sidecar: {error}")),
        }
    }
    Ok(path)
}

fn open(home: &Path, writable: bool, with_history: bool) -> Result<Connection, String> {
    let path = database_path(home, STATE_FILE)?;
    let flags = if writable {
        OpenFlags::SQLITE_OPEN_READ_WRITE
    } else {
        OpenFlags::SQLITE_OPEN_READ_ONLY
    };
    let connection =
        Connection::open_with_flags(path, flags | OpenFlags::SQLITE_OPEN_URI).map_err(db_error)?;
    connection
        .busy_timeout(Duration::from_millis(500))
        .map_err(db_error)?;
    if !writable {
        connection
            .pragma_update(None, "query_only", true)
            .map_err(db_error)?;
    }
    if with_history {
        let path = database_path(home, HISTORY_FILE)?;
        let mut uri = url::Url::from_file_path(path)
            .map_err(|()| "Invalid native Codex history database path".to_string())?;
        uri.query_pairs_mut()
            .append_pair("mode", if writable { "rw" } else { "ro" });
        connection
            .execute("ATTACH DATABASE ?1 AS history", [uri.as_str()])
            .map_err(db_error)?;
    }
    Ok(connection)
}

fn row_values(row: &rusqlite::Row<'_>, count: usize) -> rusqlite::Result<Vec<Value>> {
    (0..count).map(|index| row.get(index)).collect()
}

fn column_index(name: &str) -> usize {
    THREAD_COLUMNS
        .iter()
        .position(|column| column.0 == name)
        .expect("audited thread column")
}

fn text_value(values: &[Value], name: &str) -> Result<String, String> {
    match &values[column_index(name)] {
        Value::Text(text) => Ok(text.clone()),
        _ => Err(format!("Invalid native Codex thread field {name}")),
    }
}

fn value_bytes(value: &Value) -> usize {
    match value {
        Value::Text(text) => text.len(),
        Value::Blob(bytes) => bytes.len(),
        _ => 8,
    }
}

fn hash_value(hasher: &mut Sha256, value: &Value) {
    let (kind, bytes): (u8, &[u8]);
    let number;
    match value {
        Value::Null => {
            kind = 0;
            bytes = &[];
        }
        Value::Integer(value) => {
            kind = 1;
            number = value.to_le_bytes();
            bytes = &number;
        }
        Value::Real(value) => {
            kind = 2;
            number = value.to_bits().to_le_bytes();
            bytes = &number;
        }
        Value::Text(value) => {
            kind = 3;
            bytes = value.as_bytes();
        }
        Value::Blob(value) => {
            kind = 4;
            bytes = value;
        }
    }
    hasher.update([kind]);
    hasher.update((bytes.len() as u64).to_le_bytes());
    hasher.update(bytes);
}

fn thread_record(values: Vec<Value>) -> Result<ThreadRecord, String> {
    let id = text_value(&values, "id")?;
    validate_id(&id)?;
    let rollout_path = PathBuf::from(text_value(&values, "rollout_path")?);
    let cwd = PathBuf::from(text_value(&values, "cwd")?);
    if !cwd.is_absolute() {
        return Err("Native Codex working directory must be absolute".into());
    }
    if !rollout_path.is_absolute() {
        return Err("Native Codex rollout path must be absolute".into());
    }
    let history_mode = text_value(&values, "history_mode")?;
    if !matches!(history_mode.as_str(), "legacy" | "paginated") {
        return Err("Unsupported native Codex history mode".into());
    }
    match values[column_index("archived")] {
        Value::Integer(0 | 1) => {}
        _ => return Err("Invalid native Codex archived flag".into()),
    }
    let mut hasher = Sha256::new();
    for (column, value) in THREAD_COLUMNS.iter().zip(&values) {
        if LOCAL_COLUMNS.contains(&column.0) {
            continue;
        }
        if column.0 == "rollout_path" {
            let name = rollout_path
                .file_name()
                .and_then(|name| name.to_str())
                .ok_or_else(|| "Invalid native Codex rollout filename".to_string())?;
            hash_value(&mut hasher, &Value::Text(name.to_string()));
        } else {
            hash_value(&mut hasher, value);
        }
    }
    Ok(ThreadRecord {
        id,
        rollout_path,
        cwd,
        metadata_hash: format!("{:x}", hasher.finalize()),
        history_mode,
        values,
    })
}

fn validate_id(id: &str) -> Result<(), String> {
    if id.is_empty()
        || id.len() > 128
        || !id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
    {
        return Err("Invalid native Codex history id".into());
    }
    Ok(())
}

fn read_record(connection: &Connection, id: &str) -> Result<Option<ThreadRecord>, String> {
    let sql = format!(
        "SELECT {} FROM threads WHERE id=?1",
        columns_sql(THREAD_COLUMNS)
    );
    connection
        .query_row(&sql, [id], |row| row_values(row, THREAD_COLUMNS.len()))
        .optional()
        .map_err(db_error)?
        .map(thread_record)
        .transpose()
}

/// Bounded metadata discovery. `None` fails instead of silently truncating at
/// MAX_THREADS, so an incomplete inventory can never be interpreted as deletion.
pub(super) fn list_threads(
    home: &Path,
    ids: Option<&[String]>,
) -> Result<Vec<ThreadRecord>, String> {
    if ids.is_some_and(|ids| ids.len() > MAX_THREADS) {
        return Err("Codex history inventory exceeds its limit".into());
    }
    let connection = open(home, false, false)?;
    connection.execute_batch("BEGIN").map_err(db_error)?;
    validate_schema(&connection, "main")?;
    let mut records = Vec::new();
    let mut bytes = 0usize;
    let mut push = |record: ThreadRecord| -> Result<(), String> {
        bytes = bytes.saturating_add(record.values.iter().map(value_bytes).sum::<usize>());
        if records.len() == MAX_THREADS || bytes > MAX_METADATA_BYTES {
            return Err("Codex history inventory exceeds its limit".into());
        }
        records.push(record);
        Ok(())
    };
    if let Some(ids) = ids {
        let mut seen = BTreeSet::new();
        for id in ids {
            validate_id(id)?;
            if seen.insert(id) {
                if let Some(record) = read_record(&connection, id)? {
                    push(record)?;
                }
            }
        }
    } else {
        let sql = format!(
            "SELECT {} FROM threads ORDER BY id LIMIT {}",
            columns_sql(THREAD_COLUMNS),
            MAX_THREADS + 1
        );
        let mut statement = connection.prepare(&sql).map_err(db_error)?;
        let mut rows = statement.query([]).map_err(db_error)?;
        while let Some(row) = rows.next().map_err(db_error)? {
            push(thread_record(
                row_values(row, THREAD_COLUMNS.len()).map_err(db_error)?,
            )?)?;
        }
    }
    Ok(records)
}

fn read_checkpoint(
    connection: &Connection,
    schema: &str,
    rollout_id: &str,
) -> Result<ProjectionSnapshot, String> {
    let checkpoint: Option<(i64, i64)> = connection.query_row(
        &format!("SELECT next_rollout_byte_offset,next_rollout_ordinal FROM {schema}.thread_history_projection_state WHERE thread_id=?1"),
        [rollout_id], |row| Ok((row.get(0)?, row.get(1)?)),
    ).optional().map_err(db_error)?;
    if checkpoint.is_some_and(|(bytes, ordinal)| bytes < 0 || ordinal < 0) {
        return Err("Invalid native Codex projection checkpoint".into());
    }
    Ok(ProjectionSnapshot {
        rollout_id: rollout_id.to_string(),
        next_byte_offset: checkpoint.map(|value| value.0),
        next_ordinal: checkpoint.map(|value| value.1),
    })
}

/// Inspect existing immutable ancestors without requiring a matching thread
/// catalog row. A skipped ancestor must already project its frozen byte range.
pub(super) fn checkpoints(
    home: &Path,
    rollout_ids: &[String],
) -> Result<Vec<ProjectionSnapshot>, String> {
    if rollout_ids.len() > MAX_ROLLOUTS {
        return Err("Invalid Codex rollout lineage size".into());
    }
    let source = open(home, false, true)?;
    source.execute_batch("BEGIN").map_err(db_error)?;
    validate_schema(&source, "main")?;
    validate_schema(&source, "history")?;
    rollout_ids
        .iter()
        .map(|id| {
            validate_id(id)?;
            read_checkpoint(&source, "history", id)
        })
        .collect()
}

/// Capture metadata and all requested immutable rollout projections under one
/// held read transaction. The caller must validate that these IDs are exactly
/// the selected rollout's lineage and retain both native writer locks.
pub(super) fn prepare(
    home: &Path,
    id: &str,
    rollout_ids: &[String],
) -> Result<PreparedThread, String> {
    validate_id(id)?;
    if rollout_ids.is_empty() || rollout_ids.len() > MAX_ROLLOUTS {
        return Err("Invalid Codex rollout lineage size".into());
    }
    let source = open(home, false, true)?;
    source.execute_batch("BEGIN").map_err(db_error)?;
    validate_schema(&source, "main")?;
    validate_schema(&source, "history")?;
    let record = read_record(&source, id)?
        .ok_or_else(|| "Native Codex source thread disappeared".to_string())?;
    prepare_rows(source, "history", record, rollout_ids)
}

fn prepare_rows(
    source: Connection,
    history_schema: &'static str,
    record: ThreadRecord,
    rollout_ids: &[String],
) -> Result<PreparedThread, String> {
    if rollout_ids.is_empty() || rollout_ids.len() > MAX_ROLLOUTS {
        return Err("Invalid Codex rollout lineage size".into());
    }
    if record.values.iter().map(value_bytes).sum::<usize>() > MAX_METADATA_BYTES {
        return Err("Codex thread metadata exceeds its limit".into());
    }
    let mut projections = Vec::new();
    let mut seen = BTreeSet::new();
    let mut row_count = 0i64;
    let mut byte_count = 0i64;
    for rollout_id in rollout_ids {
        validate_id(rollout_id)?;
        if !seen.insert(rollout_id) {
            return Err("Duplicate Codex rollout in lineage".into());
        }
        for (table, columns) in HISTORY_TABLES {
            let lengths = columns
                .iter()
                .map(|column| format!("coalesce(length(cast({} as blob)),0)", column.0))
                .collect::<Vec<_>>()
                .join("+");
            let (count, bytes): (i64, i64) = source.query_row(
                &format!("SELECT count(*),coalesce(sum({lengths}),0) FROM (SELECT {} FROM {history_schema}.{table} WHERE thread_id=?1 LIMIT {})", columns_sql(columns), MAX_PROJECTION_ROWS + 1),
                [rollout_id], |row| Ok((row.get(0)?, row.get(1)?)),
            ).map_err(db_error)?;
            row_count = row_count.saturating_add(count);
            byte_count = byte_count.saturating_add(bytes);
            if row_count > MAX_PROJECTION_ROWS || byte_count > MAX_PROJECTION_BYTES {
                return Err("Codex history projection exceeds its copy limit".into());
            }
        }
        let checkpoint = read_checkpoint(&source, history_schema, rollout_id)?;
        if record.history_mode == "paginated" && checkpoint.next_byte_offset.is_none() {
            return Err("Native paginated Codex history has no durable projection".into());
        }
        projections.push(checkpoint);
    }
    Ok(PreparedThread {
        source,
        history_schema,
        record,
        projections,
    })
}

impl PreparedThread {
    pub(super) fn record(&self) -> &ThreadRecord {
        &self.record
    }
    pub(super) fn projections(&self) -> &[ProjectionSnapshot] {
        &self.projections
    }

    /// A loaded source can only be considered for a fixed completed snapshot
    /// when every selected immutable rollout has turns and all are completed.
    /// Read from this same held SQLite snapshot; never consult newer live rows.
    /// This is one prerequisite, not a replacement for the caller's raw-file,
    /// checkpoint, metadata, and destination writer-lock fences.
    pub(super) fn completed_rollouts(&self) -> Result<bool, String> {
        if self.record.history_mode != "paginated" || self.projections.is_empty() {
            return Ok(false);
        }
        let sql = format!(
            "SELECT count(*),count(CASE WHEN status='completed' THEN 1 END) FROM {}.thread_turns WHERE thread_id=?1",
            self.history_schema
        );
        let mut statement = self.source.prepare(&sql).map_err(db_error)?;
        for projection in &self.projections {
            let (total, completed): (i64, i64) = statement
                .query_row([&projection.rollout_id], |row| {
                    Ok((row.get(0)?, row.get(1)?))
                })
                .map_err(db_error)?;
            if total == 0 || total != completed {
                return Ok(false);
            }
        }
        Ok(true)
    }

    /// Publish projections and portable metadata. `None` requires a new target;
    /// `Some(hash)` compares the target's current portable metadata inside the
    /// write transaction. The caller's validated route matches its appended
    /// native settings event; existing permissions/organization are retained.
    /// Files must already be staged/published under the caller's recovery journal.
    #[allow(clippy::too_many_arguments)]
    pub(super) fn apply(
        &self,
        target_home: &Path,
        target_rollout_path: &Path,
        imported_rollout_ids: &[String],
        provider: &str,
        model: &str,
        expected_target_hash: Option<&str>,
        mut check_owner: impl FnMut() -> Result<(), String>,
    ) -> Result<ThreadRecord, String> {
        let imported: BTreeSet<&str> = imported_rollout_ids.iter().map(String::as_str).collect();
        if imported.is_empty()
            || imported.len() != imported_rollout_ids.len()
            || imported.iter().any(|id| {
                !self
                    .projections
                    .iter()
                    .any(|projection| projection.rollout_id == *id)
            })
        {
            return Err("Invalid Codex imported rollout set".into());
        }
        if provider.is_empty() || provider.len() > 256 || model.is_empty() || model.len() > 512 {
            return Err("Invalid target Codex history route".into());
        }
        if !target_rollout_path.is_absolute()
            || !target_rollout_path.starts_with(target_home)
            || target_rollout_path
                .components()
                .any(|part| matches!(part, std::path::Component::ParentDir))
        {
            return Err("Target Codex rollout is outside its profile".into());
        }
        let target_database = database_path(target_home, STATE_FILE)?;
        let source_database = self
            .source
            .path()
            .ok_or("Missing native source database path")?;
        let canonical = |path: &Path| {
            std::fs::canonicalize(path)
                .map_err(|error| format!("resolve native Codex database: {error}"))
        };
        if canonical(Path::new(source_database))? == canonical(&target_database)? {
            return Err("Codex history source and target are the same profile".into());
        }
        check_owner()?;
        let mut target = open(target_home, true, true)?;
        let transaction = target
            .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
            .map_err(db_error)?;
        validate_schema(&transaction, "main")?;
        validate_schema(&transaction, "history")?;
        let existing = read_record(&transaction, &self.record.id)?;
        if existing
            .as_ref()
            .map(|record| record.metadata_hash.as_str())
            != expected_target_hash
        {
            return Err("Native Codex target metadata changed before history publication".into());
        }
        let mut values = self.record.values.clone();
        values[column_index("rollout_path")] = Value::Text(
            target_rollout_path
                .to_str()
                .ok_or_else(|| "Invalid target Codex path".to_string())?
                .to_string(),
        );
        for column in LOCAL_COLUMNS {
            let index = column_index(column);
            values[index] = existing
                .as_ref()
                .map(|record| record.values[index].clone())
                .unwrap_or_else(|| match *column {
                    "model_provider" => Value::Text(provider.to_string()),
                    "model" => Value::Text(model.to_string()),
                    "sandbox_policy" => {
                        Value::Text(super::routing::conservative_permission_profile().to_string())
                    }
                    "approval_mode" => Value::Text("on-request".into()),
                    "memory_mode" => Value::Text("disabled".into()),
                    "is_pinned" => Value::Integer(0),
                    _ => Value::Null,
                });
        }
        // The caller has already selected an existing destination model when
        // its provider still matches the destination configuration. A provider
        // change must reach SQLite immediately, otherwise the GUI's state-only
        // provider filter can hide the conversation before native resume.
        values[column_index("model_provider")] = Value::Text(provider.to_string());
        values[column_index("model")] = Value::Text(model.to_string());
        for projection in &self.projections {
            if !imported.contains(projection.rollout_id.as_str()) {
                continue;
            }
            // Deleting a checkpoint invokes native realtime cleanup. Delete it
            // before restoring realtime rows, and write its new checkpoint last.
            transaction
                .execute(
                    "DELETE FROM history.thread_history_projection_state WHERE thread_id=?1",
                    [&projection.rollout_id],
                )
                .map_err(db_error)?;
            for (table, columns) in HISTORY_TABLES {
                transaction
                    .execute(
                        &format!("DELETE FROM history.{table} WHERE thread_id=?1"),
                        [&projection.rollout_id],
                    )
                    .map_err(db_error)?;
                let select = format!(
                    "SELECT {} FROM {}.{table} WHERE thread_id=?1",
                    columns_sql(columns),
                    self.history_schema
                );
                let mut source_rows = self.source.prepare(&select).map_err(db_error)?;
                let mut rows = source_rows
                    .query([&projection.rollout_id])
                    .map_err(db_error)?;
                let placeholders = vec!["?"; columns.len()].join(",");
                let insert = format!(
                    "INSERT INTO history.{table} ({}) VALUES ({placeholders})",
                    columns_sql(columns)
                );
                let mut insert = transaction.prepare(&insert).map_err(db_error)?;
                let mut copied = 0usize;
                while let Some(row) = rows.next().map_err(db_error)? {
                    let values = row_values(row, columns.len()).map_err(db_error)?;
                    insert
                        .execute(params_from_iter(values.iter()))
                        .map_err(db_error)?;
                    copied += 1;
                    if copied % 1_000 == 0 {
                        check_owner()?;
                    }
                }
            }
            check_owner()?;
        }
        let columns = columns_sql(THREAD_COLUMNS);
        let placeholders = vec!["?"; THREAD_COLUMNS.len()].join(",");
        let update = THREAD_COLUMNS
            .iter()
            .filter(|column| column.0 != "id")
            .map(|column| format!("{}=excluded.{}", column.0, column.0))
            .collect::<Vec<_>>()
            .join(",");
        transaction.execute(&format!("INSERT INTO threads ({columns}) VALUES ({placeholders}) ON CONFLICT(id) DO UPDATE SET {update}"), params_from_iter(values.iter())).map_err(db_error)?;
        let result = read_record(&transaction, &self.record.id)?
            .ok_or_else(|| "Published Codex history metadata is missing".to_string())?;
        check_owner()?;
        transaction.commit().map_err(db_error)?;
        Ok(result)
    }
}

#[cfg(test)]
pub(super) fn fixture_home() -> tempfile::TempDir {
    tests::home()
}

#[cfg(test)]
pub(super) fn fixture_seed(home: &Path, id: &str, rollout: &str) {
    tests::seed(home, id, rollout);
}

#[cfg(test)]
mod tests;
