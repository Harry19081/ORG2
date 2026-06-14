use rusqlite::{params, Connection, OptionalExtension};

use super::RecordStore;
use crate::canonical::{ActivityRecord, CommitLinkRecord, FileChangeRecord, ScanCheckpoint, SessionRecord};

pub struct SqliteRecordStore<'conn> {
    conn: &'conn Connection,
}

impl<'conn> SqliteRecordStore<'conn> {
    pub fn new(conn: &'conn Connection) -> Self {
        Self { conn }
    }

    pub fn init_tables(conn: &Connection) -> rusqlite::Result<()> {
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS orgtrack_core_sessions (
                session_id          TEXT PRIMARY KEY,
                source              TEXT NOT NULL,
                source_session_id   TEXT NOT NULL,
                workspace_path      TEXT,
                title               TEXT NOT NULL,
                created_at          TEXT,
                updated_at          TEXT,
                completed_at        TEXT,
                branch              TEXT,
                payload_json        TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_orgtrack_core_sessions_source
                ON orgtrack_core_sessions(source, source_session_id);
            CREATE INDEX IF NOT EXISTS idx_orgtrack_core_sessions_workspace
                ON orgtrack_core_sessions(workspace_path);

            CREATE TABLE IF NOT EXISTS orgtrack_core_activities (
                record_id       TEXT PRIMARY KEY,
                source          TEXT NOT NULL,
                session_id      TEXT,
                timestamp       TEXT NOT NULL,
                workspace_path  TEXT,
                file_path       TEXT,
                kind            TEXT NOT NULL,
                payload_json    TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_orgtrack_core_activities_session
                ON orgtrack_core_activities(session_id, timestamp);
            CREATE INDEX IF NOT EXISTS idx_orgtrack_core_activities_workspace
                ON orgtrack_core_activities(workspace_path, timestamp);

            CREATE TABLE IF NOT EXISTS orgtrack_core_file_changes (
                record_id       TEXT PRIMARY KEY,
                source          TEXT NOT NULL,
                session_id      TEXT NOT NULL,
                workspace_path  TEXT,
                file_path       TEXT NOT NULL,
                path_hash       TEXT NOT NULL,
                timestamp       INTEGER NOT NULL,
                payload_json    TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_orgtrack_core_file_changes_session
                ON orgtrack_core_file_changes(session_id, timestamp);
            CREATE INDEX IF NOT EXISTS idx_orgtrack_core_file_changes_workspace
                ON orgtrack_core_file_changes(workspace_path, timestamp);
            CREATE INDEX IF NOT EXISTS idx_orgtrack_core_file_changes_path
                ON orgtrack_core_file_changes(file_path, timestamp);

            CREATE TABLE IF NOT EXISTS orgtrack_core_commit_links (
                record_id       TEXT PRIMARY KEY,
                commit_sha      TEXT NOT NULL,
                linked_at       TEXT NOT NULL,
                payload_json    TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_orgtrack_core_commit_links_sha
                ON orgtrack_core_commit_links(commit_sha);

            CREATE TABLE IF NOT EXISTS orgtrack_core_checkpoints (
                source          TEXT PRIMARY KEY,
                parser_version  INTEGER NOT NULL,
                updated_at      TEXT,
                payload_json    TEXT NOT NULL
            );
            ",
        )
    }

    pub fn init_source_cache_tables(conn: &Connection) -> rusqlite::Result<()> {
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS cursor_session_cache (
                id              TEXT PRIMARY KEY,
                name            TEXT NOT NULL DEFAULT '',
                created_at      INTEGER NOT NULL DEFAULT 0,
                last_active_at  INTEGER NOT NULL DEFAULT 0,
                status          TEXT NOT NULL DEFAULT '',
                is_agentic      INTEGER NOT NULL DEFAULT 0,
                mode            TEXT NOT NULL DEFAULT '',
                model           TEXT NOT NULL DEFAULT '',
                lines_added     INTEGER NOT NULL DEFAULT 0,
                lines_removed   INTEGER NOT NULL DEFAULT 0,
                files_changed   INTEGER NOT NULL DEFAULT 0,
                tokens_used     INTEGER NOT NULL DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_cursor_cache_created
                ON cursor_session_cache(created_at);
            CREATE INDEX IF NOT EXISTS idx_cursor_cache_status
                ON cursor_session_cache(status);

            CREATE TABLE IF NOT EXISTS cursor_ide_turn_summaries (
                session_id          TEXT NOT NULL,
                composer_id         TEXT NOT NULL,
                turn_id             TEXT NOT NULL,
                next_turn_id        TEXT,
                turn_index          INTEGER NOT NULL,
                started_at          TEXT NOT NULL,
                ended_at            TEXT,
                duration_ms         INTEGER,
                user_preview        TEXT NOT NULL DEFAULT '',
                event_count         INTEGER NOT NULL DEFAULT 0,
                body_event_count    INTEGER NOT NULL DEFAULT 0,
                source_updated_at   INTEGER NOT NULL DEFAULT 0,
                source_bubble_count INTEGER NOT NULL DEFAULT 0,
                source_fingerprint  TEXT NOT NULL DEFAULT '',
                updated_at          TEXT NOT NULL,
                PRIMARY KEY (session_id, turn_id)
            );
            CREATE INDEX IF NOT EXISTS idx_cursor_ide_turns_session_index
                ON cursor_ide_turn_summaries(session_id, turn_index);

            CREATE TABLE IF NOT EXISTS claude_session_cache (
                id              TEXT PRIMARY KEY,
                name            TEXT NOT NULL DEFAULT '',
                created_at      INTEGER NOT NULL DEFAULT 0,
                last_active_at  INTEGER NOT NULL DEFAULT 0,
                message_count   INTEGER NOT NULL DEFAULT 0,
                model           TEXT NOT NULL DEFAULT '',
                workspace_path  TEXT NOT NULL DEFAULT '',
                git_branch      TEXT NOT NULL DEFAULT '',
                input_tokens    INTEGER NOT NULL DEFAULT 0,
                output_tokens   INTEGER NOT NULL DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_claude_cache_created
                ON claude_session_cache(created_at);

            CREATE TABLE IF NOT EXISTS cli_session_cache (
                id              TEXT PRIMARY KEY,
                tool            TEXT NOT NULL DEFAULT '',
                name            TEXT NOT NULL DEFAULT '',
                created_at      INTEGER NOT NULL DEFAULT 0,
                last_active_at  INTEGER NOT NULL DEFAULT 0,
                message_count   INTEGER NOT NULL DEFAULT 0,
                model           TEXT NOT NULL DEFAULT '',
                workspace_path  TEXT NOT NULL DEFAULT '',
                input_tokens    INTEGER NOT NULL DEFAULT 0,
                output_tokens   INTEGER NOT NULL DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_cli_cache_created
                ON cli_session_cache(created_at);
            CREATE INDEX IF NOT EXISTS idx_cli_cache_tool
                ON cli_session_cache(tool);

            CREATE TABLE IF NOT EXISTS imported_history_session_cache (
                source              TEXT NOT NULL,
                source_session_id   TEXT NOT NULL,
                session_id          TEXT NOT NULL,
                source_path         TEXT NOT NULL DEFAULT '',
                source_record_key   TEXT NOT NULL DEFAULT '',
                source_mtime_ms     INTEGER NOT NULL DEFAULT 0,
                source_size_bytes   INTEGER NOT NULL DEFAULT 0,
                source_fingerprint  TEXT NOT NULL DEFAULT '',
                parser_version      INTEGER NOT NULL DEFAULT 0,
                name                TEXT NOT NULL DEFAULT '',
                created_at_ms       INTEGER NOT NULL DEFAULT 0,
                updated_at_ms       INTEGER NOT NULL DEFAULT 0,
                model               TEXT NOT NULL DEFAULT '',
                input_tokens        INTEGER NOT NULL DEFAULT 0,
                output_tokens       INTEGER NOT NULL DEFAULT 0,
                repo_path           TEXT NOT NULL DEFAULT '',
                branch              TEXT NOT NULL DEFAULT '',
                listable            INTEGER NOT NULL DEFAULT 1,
                updated_at          TEXT NOT NULL DEFAULT '',
                PRIMARY KEY (source, source_session_id)
            );
            CREATE INDEX IF NOT EXISTS idx_imported_history_source_updated
                ON imported_history_session_cache(source, updated_at_ms DESC);
            CREATE INDEX IF NOT EXISTS idx_imported_history_source_repo
                ON imported_history_session_cache(source, repo_path);
            CREATE INDEX IF NOT EXISTS idx_imported_history_source_path
                ON imported_history_session_cache(source, source_path);
            "
        )
    }

    fn to_json<T: serde::Serialize>(value: &T) -> Result<String, String> {
        serde_json::to_string(value).map_err(|err| err.to_string())
    }

    fn from_json<T: serde::de::DeserializeOwned>(value: String) -> Result<T, String> {
        serde_json::from_str(&value).map_err(|err| err.to_string())
    }
}

impl RecordStore for SqliteRecordStore<'_> {
    fn upsert_session(&self, record: &SessionRecord) -> Result<(), String> {
        let payload = Self::to_json(record)?;
        self.conn
            .execute(
                "INSERT INTO orgtrack_core_sessions (
                    session_id, source, source_session_id, workspace_path, title,
                    created_at, updated_at, completed_at, branch, payload_json
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
                ON CONFLICT(session_id) DO UPDATE SET
                    source=excluded.source,
                    source_session_id=excluded.source_session_id,
                    workspace_path=excluded.workspace_path,
                    title=excluded.title,
                    created_at=excluded.created_at,
                    updated_at=excluded.updated_at,
                    completed_at=excluded.completed_at,
                    branch=excluded.branch,
                    payload_json=excluded.payload_json",
                params![
                    record.session_id,
                    record.source,
                    record.source_session_id,
                    record.workspace_path,
                    record.title,
                    record.created_at,
                    record.updated_at,
                    record.completed_at,
                    record.branch,
                    payload
                ],
            )
            .map_err(|err| err.to_string())?;
        Ok(())
    }

    fn append_activity(&self, record: &ActivityRecord) -> Result<(), String> {
        let payload = Self::to_json(record)?;
        self.conn
            .execute(
                "INSERT OR IGNORE INTO orgtrack_core_activities (
                    record_id, source, session_id, timestamp, workspace_path, file_path, kind, payload_json
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    record.record_id,
                    record.source,
                    record.session_id,
                    record.timestamp,
                    record.workspace_path,
                    record.file_path,
                    format!("{:?}", record.kind),
                    payload
                ],
            )
            .map_err(|err| err.to_string())?;
        Ok(())
    }

    fn upsert_file_change(&self, record: &FileChangeRecord) -> Result<(), String> {
        let payload = Self::to_json(record)?;
        self.conn
            .execute(
                "INSERT INTO orgtrack_core_file_changes (
                    record_id, source, session_id, workspace_path, file_path, path_hash, timestamp, payload_json
                ) VALUES (?1, ?2, ?3, NULL, ?4, ?5, ?6, ?7)
                ON CONFLICT(record_id) DO UPDATE SET
                    source=excluded.source,
                    session_id=excluded.session_id,
                    file_path=excluded.file_path,
                    path_hash=excluded.path_hash,
                    timestamp=excluded.timestamp,
                    payload_json=excluded.payload_json",
                params![
                    record.record_id,
                    record.source,
                    record.session_id,
                    record.file_path,
                    record.path_hash,
                    record.timestamp,
                    payload
                ],
            )
            .map_err(|err| err.to_string())?;
        Ok(())
    }

    fn upsert_commit_link(&self, record: &CommitLinkRecord) -> Result<(), String> {
        let payload = Self::to_json(record)?;
        self.conn
            .execute(
                "INSERT INTO orgtrack_core_commit_links (record_id, commit_sha, linked_at, payload_json)
                VALUES (?1, ?2, ?3, ?4)
                ON CONFLICT(record_id) DO UPDATE SET
                    commit_sha=excluded.commit_sha,
                    linked_at=excluded.linked_at,
                    payload_json=excluded.payload_json",
                params![record.record_id, record.commit_sha, record.linked_at, payload],
            )
            .map_err(|err| err.to_string())?;
        Ok(())
    }

    fn get_checkpoint(&self, source: &str) -> Result<Option<ScanCheckpoint>, String> {
        self.conn
            .query_row(
                "SELECT payload_json FROM orgtrack_core_checkpoints WHERE source = ?1",
                params![source],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(|err| err.to_string())?
            .map(Self::from_json)
            .transpose()
    }

    fn put_checkpoint(&self, checkpoint: &ScanCheckpoint) -> Result<(), String> {
        let payload = Self::to_json(checkpoint)?;
        self.conn
            .execute(
                "INSERT INTO orgtrack_core_checkpoints (source, parser_version, updated_at, payload_json)
                VALUES (?1, ?2, ?3, ?4)
                ON CONFLICT(source) DO UPDATE SET
                    parser_version=excluded.parser_version,
                    updated_at=excluded.updated_at,
                    payload_json=excluded.payload_json",
                params![checkpoint.source, checkpoint.parser_version, checkpoint.updated_at, payload],
            )
            .map_err(|err| err.to_string())?;
        Ok(())
    }

    fn list_sessions(&self, workspace_path: Option<&str>) -> Result<Vec<SessionRecord>, String> {
        let mut records = Vec::new();
        if let Some(workspace_path) = workspace_path {
            let mut stmt = self.conn
                .prepare("SELECT payload_json FROM orgtrack_core_sessions WHERE workspace_path = ?1 ORDER BY updated_at DESC")
                .map_err(|err| err.to_string())?;
            let rows = stmt
                .query_map(params![workspace_path], |row| row.get::<_, String>(0))
                .map_err(|err| err.to_string())?;
            for row in rows {
                records.push(Self::from_json(row.map_err(|err| err.to_string())?)?);
            }
            return Ok(records);
        }

        let mut stmt = self.conn
            .prepare("SELECT payload_json FROM orgtrack_core_sessions ORDER BY updated_at DESC")
            .map_err(|err| err.to_string())?;
        let rows = stmt
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|err| err.to_string())?;
        for row in rows {
            records.push(Self::from_json(row.map_err(|err| err.to_string())?)?);
        }
        Ok(records)
    }

    fn list_file_changes(&self, workspace_path: Option<&str>) -> Result<Vec<FileChangeRecord>, String> {
        let mut records = Vec::new();
        if let Some(workspace_path) = workspace_path {
            let mut stmt = self.conn
                .prepare("SELECT payload_json FROM orgtrack_core_file_changes WHERE workspace_path = ?1 ORDER BY timestamp DESC")
                .map_err(|err| err.to_string())?;
            let rows = stmt
                .query_map(params![workspace_path], |row| row.get::<_, String>(0))
                .map_err(|err| err.to_string())?;
            for row in rows {
                records.push(Self::from_json(row.map_err(|err| err.to_string())?)?);
            }
            return Ok(records);
        }

        let mut stmt = self.conn
            .prepare("SELECT payload_json FROM orgtrack_core_file_changes ORDER BY timestamp DESC")
            .map_err(|err| err.to_string())?;
        let rows = stmt
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|err| err.to_string())?;
        for row in rows {
            records.push(Self::from_json(row.map_err(|err| err.to_string())?)?);
        }
        Ok(records)
    }
}
