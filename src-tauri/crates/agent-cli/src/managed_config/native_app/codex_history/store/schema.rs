//! Exact native schema gate for the audited desktop capability.
use super::db_error;
use rusqlite::Connection;
use std::collections::BTreeSet;

// name, declared type, NOT NULL, primary-key position. Exact column order is
// deliberate: a new native field must be reviewed before it can be discarded.
pub(super) type Column = (&'static str, &'static str, i64, i64);
pub(super) const THREAD_COLUMNS: &[Column] = &[
    ("id", "TEXT", 0, 1),
    ("rollout_path", "TEXT", 1, 0),
    ("created_at", "INTEGER", 1, 0),
    ("updated_at", "INTEGER", 1, 0),
    ("source", "TEXT", 1, 0),
    ("model_provider", "TEXT", 1, 0),
    ("cwd", "TEXT", 1, 0),
    ("title", "TEXT", 1, 0),
    ("sandbox_policy", "TEXT", 1, 0),
    ("approval_mode", "TEXT", 1, 0),
    ("tokens_used", "INTEGER", 1, 0),
    ("has_user_event", "INTEGER", 1, 0),
    ("archived", "INTEGER", 1, 0),
    ("archived_at", "INTEGER", 0, 0),
    ("git_sha", "TEXT", 0, 0),
    ("git_branch", "TEXT", 0, 0),
    ("git_origin_url", "TEXT", 0, 0),
    ("cli_version", "TEXT", 1, 0),
    ("first_user_message", "TEXT", 1, 0),
    ("agent_nickname", "TEXT", 0, 0),
    ("agent_role", "TEXT", 0, 0),
    ("memory_mode", "TEXT", 1, 0),
    ("model", "TEXT", 0, 0),
    ("reasoning_effort", "TEXT", 0, 0),
    ("agent_path", "TEXT", 0, 0),
    ("created_at_ms", "INTEGER", 0, 0),
    ("updated_at_ms", "INTEGER", 0, 0),
    ("thread_source", "TEXT", 0, 0),
    ("preview", "TEXT", 1, 0),
    ("recency_at", "INTEGER", 1, 0),
    ("recency_at_ms", "INTEGER", 1, 0),
    ("history_mode", "TEXT", 1, 0),
    ("name", "TEXT", 0, 0),
    ("is_pinned", "INTEGER", 1, 0),
    ("thread_section_id", "TEXT", 0, 0),
    ("section_position", "INTEGER", 0, 0),
    ("section_entered_at_ms", "INTEGER", 0, 0),
    ("project_id", "TEXT", 0, 0),
    ("originator", "TEXT", 0, 0),
    ("daybreak_enabled", "BOOLEAN", 0, 0),
];
pub(super) const TURN_COLUMNS: &[Column] = &[
    ("thread_id", "TEXT", 1, 1),
    ("turn_id", "TEXT", 1, 2),
    ("rollout_ordinal", "INTEGER", 1, 0),
    ("status", "TEXT", 1, 0),
    ("error_json", "TEXT", 0, 0),
    ("started_at", "INTEGER", 0, 0),
    ("completed_at", "INTEGER", 0, 0),
    ("duration_ms", "INTEGER", 0, 0),
    ("first_user_item_id", "TEXT", 0, 0),
    ("final_agent_item_id", "TEXT", 0, 0),
    ("rollout_byte_offset", "INTEGER", 0, 0),
    ("rollout_end_ordinal", "INTEGER", 0, 0),
    ("rollout_end_byte_offset", "INTEGER", 0, 0),
];
pub(super) const ITEM_COLUMNS: &[Column] = &[
    ("thread_id", "TEXT", 1, 1),
    ("turn_id", "TEXT", 1, 2),
    ("item_id", "TEXT", 1, 3),
    ("rollout_ordinal", "INTEGER", 1, 0),
    ("created_at_ms", "INTEGER", 1, 0),
    ("item_json", "TEXT", 1, 0),
    ("item_type", "TEXT", 1, 0),
    ("updated_at_ordinal", "INTEGER", 1, 0),
];
pub(super) const REALTIME_COLUMNS: &[Column] = &[
    ("thread_id", "TEXT", 1, 1),
    ("item_id", "TEXT", 1, 2),
    ("rollout_ordinal", "INTEGER", 1, 0),
    ("created_at_ms", "INTEGER", 1, 0),
    ("item_type", "TEXT", 1, 0),
    ("item_json", "TEXT", 1, 0),
];
pub(super) const CHECKPOINT_COLUMNS: &[Column] = &[
    ("thread_id", "TEXT", 0, 1),
    ("next_rollout_byte_offset", "INTEGER", 1, 0),
    ("next_rollout_ordinal", "INTEGER", 1, 0),
];
pub(super) const HISTORY_TABLES: &[(&str, &[Column])] = &[
    ("thread_turns", TURN_COLUMNS),
    ("thread_items", ITEM_COLUMNS),
    ("thread_realtime_items", REALTIME_COLUMNS),
    ("thread_history_projection_state", CHECKPOINT_COLUMNS),
];
pub(super) const STATE_TABLES: &[&str] = &[
    "_sqlx_migrations",
    "backfill_state",
    "external_agent_config_imports",
    "project_idempotency_keys",
    "project_roots",
    "projects",
    "remote_control_enrollments",
    "rollout_migration_skipped_rollouts",
    "rollout_migration_state",
    "sqlite_sequence",
    "thread_attachments",
    "thread_dynamic_tools",
    "thread_sections",
    "thread_spawn_edges",
    "threads",
];
pub(super) const LOCAL_COLUMNS: &[&str] = &[
    "model_provider",
    "model",
    "reasoning_effort",
    "sandbox_policy",
    "approval_mode",
    "memory_mode",
    "is_pinned",
    "thread_section_id",
    "section_position",
    "section_entered_at_ms",
    "project_id",
    "daybreak_enabled",
];

pub(super) fn columns_sql(columns: &[Column]) -> String {
    columns
        .iter()
        .map(|column| column.0)
        .collect::<Vec<_>>()
        .join(",")
}

pub(super) fn validate_table(
    connection: &Connection,
    schema: &str,
    table: &str,
    expected: &[Column],
) -> Result<(), String> {
    let mut statement = connection
        .prepare(&format!("PRAGMA {schema}.table_xinfo({table})"))
        .map_err(db_error)?;
    let columns = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, i64>(3)?,
                row.get::<_, i64>(5)?,
                row.get::<_, i64>(6)?,
            ))
        })
        .map_err(db_error)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_error)?;
    if columns.len() != expected.len()
        || columns.iter().zip(expected).any(|(actual, expected)| {
            actual.0 != expected.0
                || actual.1 != expected.1
                || actual.2 != expected.2
                || actual.3 != expected.3
                || actual.4 != 0
        })
    {
        return Err(format!(
            "Unsupported native Codex schema for {table}; history was not changed"
        ));
    }
    let mut keys = connection
        .prepare(&format!("PRAGMA {schema}.foreign_key_list({table})"))
        .map_err(db_error)?;
    let foreign_keys: BTreeSet<Vec<String>> = keys
        .query_map([], |row| (2..=7).map(|index| row.get(index)).collect())
        .map_err(db_error)?
        .collect::<Result<_, _>>()
        .map_err(db_error)?;
    let expected_keys: BTreeSet<Vec<String>> = if table == "threads" {
        [
            [
                "projects",
                "project_id",
                "id",
                "NO ACTION",
                "SET NULL",
                "NONE",
            ],
            [
                "thread_sections",
                "thread_section_id",
                "id",
                "NO ACTION",
                "SET NULL",
                "NONE",
            ],
        ]
        .into_iter()
        .map(|row| row.into_iter().map(String::from).collect())
        .collect()
    } else {
        BTreeSet::new()
    };
    if foreign_keys != expected_keys {
        return Err(format!("Unsupported native Codex foreign keys on {table}"));
    }
    Ok(())
}

pub(super) const STATE_TRIGGERS: &[(&str, &str)] = &[
    ("threads_created_at_ms_after_insert", "CREATE TRIGGER threads_created_at_ms_after_insert AFTER INSERT ON threads WHEN NEW.created_at_ms IS NULL BEGIN UPDATE threads SET created_at_ms = NEW.created_at * 1000 WHERE id = NEW.id; END"),
    ("threads_updated_at_ms_after_insert", "CREATE TRIGGER threads_updated_at_ms_after_insert AFTER INSERT ON threads WHEN NEW.updated_at_ms IS NULL BEGIN UPDATE threads SET updated_at_ms = NEW.updated_at * 1000 WHERE id = NEW.id; END"),
    ("threads_created_at_ms_after_update", "CREATE TRIGGER threads_created_at_ms_after_update AFTER UPDATE OF created_at ON threads WHEN NEW.created_at != OLD.created_at AND NEW.created_at_ms IS OLD.created_at_ms BEGIN UPDATE threads SET created_at_ms = NEW.created_at * 1000 WHERE id = NEW.id; END"),
    ("threads_updated_at_ms_after_update", "CREATE TRIGGER threads_updated_at_ms_after_update AFTER UPDATE OF updated_at ON threads WHEN NEW.updated_at != OLD.updated_at AND NEW.updated_at_ms IS OLD.updated_at_ms BEGIN UPDATE threads SET updated_at_ms = NEW.updated_at * 1000 WHERE id = NEW.id; END"),
    ("threads_recency_at_after_insert", "CREATE TRIGGER threads_recency_at_after_insert AFTER INSERT ON threads WHEN NEW.recency_at_ms = 0 BEGIN UPDATE threads SET recency_at = NEW.updated_at, recency_at_ms = COALESCE(NEW.updated_at_ms, NEW.updated_at * 1000) WHERE id = NEW.id; END"),
];
pub(super) const HISTORY_TRIGGERS: &[(&str, &str)] = &[
    ("thread_realtime_items_projection_cleanup", "CREATE TRIGGER thread_realtime_items_projection_cleanup AFTER DELETE ON thread_history_projection_state BEGIN DELETE FROM thread_realtime_items WHERE thread_id = OLD.thread_id; END"),
];

pub(super) fn normalized_sql(sql: &str) -> String {
    sql.split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim_end_matches(';')
        .to_ascii_lowercase()
}

pub(super) fn validate_schema(connection: &Connection, schema: &str) -> Result<(), String> {
    let history = schema == "history";
    let tables: BTreeSet<String> = connection
        .prepare(&format!(
            "SELECT name FROM {schema}.sqlite_master WHERE type='table'"
        ))
        .map_err(db_error)?
        .query_map([], |row| row.get(0))
        .map_err(db_error)?
        .collect::<Result<_, _>>()
        .map_err(db_error)?;
    let expected: BTreeSet<String> = if history {
        HISTORY_TABLES
            .iter()
            .map(|entry| entry.0.to_string())
            .chain(std::iter::once("_sqlx_migrations".into()))
            .collect()
    } else {
        STATE_TABLES
            .iter()
            .map(|name| (*name).to_string())
            .collect()
    };
    if tables != expected {
        return Err("Unsupported native Codex tables; history was not changed".into());
    }
    let versions: Vec<(i64, bool)> = connection
        .prepare(&format!(
            "SELECT version,success FROM {schema}._sqlx_migrations ORDER BY version"
        ))
        .map_err(db_error)?
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(db_error)?
        .collect::<Result<_, _>>()
        .map_err(db_error)?;
    if versions
        != (1..=if history { 6 } else { 55 })
            .map(|version| (version, true))
            .collect::<Vec<_>>()
    {
        return Err("Unsupported native Codex migration version; history was not changed".into());
    }
    if history {
        for (table, columns) in HISTORY_TABLES {
            validate_table(connection, schema, table, columns)?;
        }
    } else {
        validate_table(connection, schema, "threads", THREAD_COLUMNS)?;
    }
    let expected_triggers = if history {
        HISTORY_TRIGGERS
    } else {
        STATE_TRIGGERS
    };
    let triggers: Vec<(String, String)> = connection
        .prepare(&format!(
            "SELECT name,sql FROM {schema}.sqlite_master WHERE type='trigger'"
        ))
        .map_err(db_error)?
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(db_error)?
        .collect::<Result<_, _>>()
        .map_err(db_error)?;
    if triggers.len() != expected_triggers.len()
        || triggers.iter().any(|(name, sql)| {
            !expected_triggers
                .iter()
                .any(|(expected_name, expected_sql)| {
                    name == expected_name && normalized_sql(sql) == normalized_sql(expected_sql)
                })
        })
    {
        return Err("Unsupported native Codex triggers; history was not changed".into());
    }
    Ok(())
}
