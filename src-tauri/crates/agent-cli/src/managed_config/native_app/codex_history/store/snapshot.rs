//! Private, single-thread recovery snapshot; never a native profile database.
use super::schema::{normalized_sql, validate_table, Column};
use super::*;

const MAX_SNAPSHOT_FILE_BYTES: u64 = 1024 * 1024 * 1024;
const SNAPSHOT_APPLICATION_ID: i64 = 0x4f524748;
const SNAPSHOT_VERSION: i64 = 1;
const SNAPSHOT_META_COLUMNS: &[Column] = &[
    ("singleton", "INTEGER", 1, 1),
    ("version", "INTEGER", 1, 0),
    ("thread_id", "TEXT", 1, 0),
];
const SNAPSHOT_ROLLOUT_COLUMNS: &[Column] =
    &[("position", "INTEGER", 1, 1), ("rollout_id", "TEXT", 1, 0)];

fn snapshot_tables() -> Vec<(&'static str, &'static [Column])> {
    [
        ("snapshot_meta", SNAPSHOT_META_COLUMNS),
        ("snapshot_rollouts", SNAPSHOT_ROLLOUT_COLUMNS),
        ("thread_record", THREAD_COLUMNS),
    ]
    .into_iter()
    .chain(HISTORY_TABLES.iter().copied())
    .collect()
}

/// The recovery snapshot is our own single-file format, not a native profile.
/// It deliberately has no foreign keys, triggers, authentication or other
/// native control-plane tables. Preserve SQL value types and projection bytes.
fn snapshot_table_sql(name: &str, columns: &[Column]) -> String {
    let mut parts = columns
        .iter()
        .map(|column| {
            format!(
                "{} {}{}",
                column.0,
                column.1,
                if column.2 != 0 { " NOT NULL" } else { "" }
            )
        })
        .collect::<Vec<_>>();
    let mut key = columns
        .iter()
        .filter(|column| column.3 != 0)
        .collect::<Vec<_>>();
    key.sort_by_key(|column| column.3);
    parts.push(format!(
        "PRIMARY KEY ({})",
        key.iter()
            .map(|column| column.0)
            .collect::<Vec<_>>()
            .join(",")
    ));
    format!("CREATE TABLE {name} ({})", parts.join(","))
}

fn snapshot_path(path: &Path, missing: bool) -> Result<(), String> {
    super::super::files::regular_path(path, missing)?;
    match std::fs::symlink_metadata(path) {
        Ok(metadata) => {
            if !metadata.is_file() || metadata.len() > MAX_SNAPSHOT_FILE_BYTES {
                return Err("Invalid Codex history snapshot file".into());
            }
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                if metadata.permissions().mode() & 0o077 != 0 {
                    return Err("Codex history snapshot permissions are not private".into());
                }
            }
        }
        Err(error) if missing && error.kind() == std::io::ErrorKind::NotFound => {}
        Err(_) => return Err("Missing Codex history snapshot".into()),
    }
    for suffix in ["-wal", "-shm", "-journal"] {
        let mut sidecar = path.as_os_str().to_os_string();
        sidecar.push(suffix);
        match std::fs::symlink_metadata(PathBuf::from(sidecar)) {
            Ok(_) => return Err("Unsealed Codex history snapshot sidecar".into()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(_) => return Err("Cannot inspect Codex history snapshot sidecar".into()),
        }
    }
    Ok(())
}

fn validate_snapshot(connection: &Connection) -> Result<(), String> {
    let application: i64 = connection
        .pragma_query_value(None, "application_id", |r| r.get(0))
        .map_err(db_error)?;
    let version: i64 = connection
        .pragma_query_value(None, "user_version", |r| r.get(0))
        .map_err(db_error)?;
    if application != SNAPSHOT_APPLICATION_ID || version != SNAPSHOT_VERSION {
        return Err("Unsupported Codex history snapshot version".into());
    }
    let objects: Vec<(String, String, String)> = connection
        .prepare("SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY name")
        .map_err(db_error)?
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
        .map_err(db_error)?
        .collect::<Result<_, _>>()
        .map_err(db_error)?;
    let tables = snapshot_tables();
    if objects.len() != tables.len()
        || objects.iter().any(|(kind, name, sql)| {
            kind != "table"
                || !tables.iter().any(|(expected_name, columns)| {
                    name == expected_name
                        && normalized_sql(sql)
                            == normalized_sql(&snapshot_table_sql(expected_name, columns))
                })
        })
    {
        return Err("Unsupported Codex history snapshot schema".into());
    }
    for (name, columns) in tables {
        validate_table(connection, "main", name, columns)?;
    }
    Ok(())
}

impl PreparedThread {
    /// Persist exactly this source read snapshot before the caller records its
    /// pending file publication. The unique destination must not already exist.
    /// A reopened snapshot remains sufficient even if the original source has
    /// moved on, disappeared, or changed its projection schema after a crash.
    pub(in super::super) fn persist_snapshot(
        &self,
        path: &Path,
        mut check_owner: impl FnMut() -> Result<(), String>,
    ) -> Result<(), String> {
        check_owner()?;
        snapshot_path(path, true)?;
        if path.exists() {
            return Err("Codex history snapshot already exists".into());
        }
        let parent = path
            .parent()
            .ok_or("Missing Codex history snapshot directory")?;
        super::super::files::regular_path(parent, false)?;
        let temporary = tempfile::NamedTempFile::new_in(parent)
            .map_err(|_| "Cannot stage Codex history snapshot")?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            temporary
                .as_file()
                .set_permissions(std::fs::Permissions::from_mode(0o600))
                .map_err(|_| "Cannot protect Codex history snapshot")?;
        }
        let mut snapshot =
            Connection::open_with_flags(temporary.path(), OpenFlags::SQLITE_OPEN_READ_WRITE)
                .map_err(db_error)?;
        snapshot
            .execute_batch("PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL;")
            .map_err(db_error)?;
        snapshot
            .pragma_update(None, "application_id", SNAPSHOT_APPLICATION_ID)
            .map_err(db_error)?;
        snapshot
            .pragma_update(None, "user_version", SNAPSHOT_VERSION)
            .map_err(db_error)?;
        let transaction = snapshot.transaction().map_err(db_error)?;
        for (name, columns) in snapshot_tables() {
            transaction
                .execute_batch(&snapshot_table_sql(name, columns))
                .map_err(db_error)?;
        }
        transaction
            .execute(
                "INSERT INTO snapshot_meta VALUES (1,?1,?2)",
                rusqlite::params![SNAPSHOT_VERSION, self.record.id],
            )
            .map_err(db_error)?;
        transaction
            .execute(
                &format!(
                    "INSERT INTO thread_record ({}) VALUES ({})",
                    columns_sql(THREAD_COLUMNS),
                    vec!["?"; THREAD_COLUMNS.len()].join(",")
                ),
                params_from_iter(self.record.values.iter()),
            )
            .map_err(db_error)?;
        for (position, projection) in self.projections.iter().enumerate() {
            transaction
                .execute(
                    "INSERT INTO snapshot_rollouts VALUES (?1,?2)",
                    rusqlite::params![position as i64, projection.rollout_id],
                )
                .map_err(db_error)?;
            for (table, columns) in HISTORY_TABLES {
                let mut statement = self
                    .source
                    .prepare(&format!(
                        "SELECT {} FROM {}.{table} WHERE thread_id=?1",
                        columns_sql(columns),
                        self.history_schema
                    ))
                    .map_err(db_error)?;
                let mut rows = statement
                    .query([&projection.rollout_id])
                    .map_err(db_error)?;
                let mut insert = transaction
                    .prepare(&format!(
                        "INSERT INTO {table} ({}) VALUES ({})",
                        columns_sql(columns),
                        vec!["?"; columns.len()].join(",")
                    ))
                    .map_err(db_error)?;
                let mut copied = 0usize;
                while let Some(row) = rows.next().map_err(db_error)? {
                    insert
                        .execute(params_from_iter(
                            row_values(row, columns.len()).map_err(db_error)?.iter(),
                        ))
                        .map_err(db_error)?;
                    copied += 1;
                    if copied % 1_000 == 0 {
                        check_owner()?;
                    }
                }
            }
            check_owner()?;
        }
        check_owner()?;
        transaction.commit().map_err(db_error)?;
        snapshot.close().map_err(|(_, error)| db_error(error))?;
        temporary
            .as_file()
            .sync_all()
            .map_err(|_| "Cannot flush Codex history snapshot")?;
        snapshot_path(temporary.path(), false)?;
        check_owner()?;
        // Noclobber makes one pending operation incapable of replacing another
        // operation's only durable recovery data.
        temporary
            .persist_noclobber(path)
            .map_err(|_| "Cannot publish Codex history snapshot")?;
        std::fs::File::open(parent)
            .and_then(|directory| directory.sync_all())
            .map_err(|_| "Cannot flush Codex history snapshot directory")?;
        Ok(())
    }

    pub(in super::super) fn from_snapshot(path: &Path) -> Result<Self, String> {
        snapshot_path(path, false)?;
        let source = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)
            .map_err(db_error)?;
        source
            .execute_batch("PRAGMA query_only=ON; BEGIN")
            .map_err(db_error)?;
        validate_snapshot(&source)?;
        let count: i64 = source
            .query_row("SELECT count(*) FROM snapshot_meta", [], |row| row.get(0))
            .map_err(db_error)?;
        let (version, id): (i64, String) = source
            .query_row(
                "SELECT version,thread_id FROM snapshot_meta WHERE singleton=1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(db_error)?;
        if count != 1 || version != SNAPSHOT_VERSION {
            return Err("Invalid Codex history snapshot identity".into());
        }
        let count: i64 = source
            .query_row("SELECT count(*) FROM thread_record", [], |row| row.get(0))
            .map_err(db_error)?;
        if count != 1 {
            return Err("Codex history snapshot must contain one thread".into());
        }
        let record = thread_record(
            source
                .query_row(
                    &format!(
                        "SELECT {} FROM thread_record WHERE id=?1",
                        columns_sql(THREAD_COLUMNS)
                    ),
                    [&id],
                    |row| row_values(row, THREAD_COLUMNS.len()),
                )
                .map_err(db_error)?,
        )?;
        let rollouts: Vec<(i64, String)> = source
            .prepare(&format!(
                "SELECT position,rollout_id FROM snapshot_rollouts ORDER BY position LIMIT {}",
                MAX_ROLLOUTS + 1
            ))
            .map_err(db_error)?
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
            .map_err(db_error)?
            .collect::<Result<_, _>>()
            .map_err(db_error)?;
        if rollouts
            .iter()
            .enumerate()
            .any(|(position, (stored, _))| *stored != position as i64)
        {
            return Err("Invalid Codex history snapshot rollout order".into());
        }
        for (table, _) in HISTORY_TABLES {
            let extra: bool = source.query_row(&format!("SELECT EXISTS(SELECT 1 FROM {table} WHERE thread_id NOT IN (SELECT rollout_id FROM snapshot_rollouts))"), [], |row| row.get(0)).map_err(db_error)?;
            if extra {
                return Err("Codex history snapshot contains an unrelated rollout".into());
            }
        }
        prepare_rows(
            source,
            "main",
            record,
            &rollouts.into_iter().map(|(_, id)| id).collect::<Vec<_>>(),
        )
    }
}
