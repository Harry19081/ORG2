use super::{index, meta, CODEX_APP_METADATA_PARSER_VERSION};
use crate::sources::imported_history::{cache, metadata::SOURCE_CODEX_APP};
use crate::store::sqlite::SqliteRecordStore;
use rusqlite::Connection;
use std::path::PathBuf;

const THREAD: &str = "11111111-1111-4111-8111-111111111111";
const ROLLOUT: &str = "22222222-2222-4222-8222-222222222222";
const FORK: &str = "33333333-3333-4333-8333-333333333333";

struct Fixture(PathBuf);
impl Fixture {
    fn new(name: &str) -> Self {
        let path = std::env::temp_dir().join(format!(
            "codex-resend-{name}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(path.join("sessions")).unwrap();
        Self(path)
    }
    fn conn(&self) -> Connection {
        let conn = Connection::open(self.0.join("cache.sqlite")).unwrap();
        SqliteRecordStore::init_tables(&conn).unwrap();
        SqliteRecordStore::init_source_cache_tables(&conn).unwrap();
        conn
    }
    fn write(&self, stem: &str, id: &str, time: &str, fork: bool) {
        let header = serde_json::json!({"timestamp":time,"type":"session_meta","payload":{
            "id":id,"originator":"Codex Desktop","source":"vscode","cwd":"/tmp/project",
            "forked_from_id":if fork {Some(THREAD)} else {None}
        }});
        let user = serde_json::json!({"timestamp":time,"type":"event_msg","payload":{
            "type":"user_message","message":"same prompt"
        }});
        std::fs::write(
            self.0.join("sessions").join(format!("{stem}.jsonl")),
            format!("{header}\n{user}\n"),
        )
        .unwrap();
    }
    fn sync(&self, conn: &mut Connection) {
        index::sync_codex_app_cache_from_dirs(conn, &[self.0.join("sessions")]).unwrap();
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}
fn visible(conn: &Connection) -> Vec<String> {
    let mut stmt = conn.prepare("SELECT source_session_id FROM imported_history_session_cache WHERE source='codex_app' AND listable=1 ORDER BY source_session_id").unwrap();
    stmt.query_map([], |row| row.get(0))
        .unwrap()
        .collect::<Result<_, _>>()
        .unwrap()
}

#[test]
fn resend_rollout_keeps_one_family_across_live_scan_restart_and_legacy_lookup() {
    let fixture = Fixture::new("lifecycle");
    let original = format!("rollout-2026-08-23T12-40-07-{THREAD}");
    let resend = format!("rollout-2026-08-25T06-19-04-{THREAD}_{ROLLOUT}");
    let fork = format!("rollout-2026-08-25T06-20-00-{FORK}");
    fixture.write(&original, THREAD, "2026-08-23T19:40:07Z", false);
    let mut conn = fixture.conn();
    fixture.sync(&mut conn);
    assert_eq!(visible(&conn), std::slice::from_ref(&original));
    let old_id = format!("codexapp-{original}");
    assert!(
        cache::query_cached_session_by_session_id_from_conn(&conn, &old_id)
            .unwrap()
            .is_some()
    );
    // An older build cached this file and its incremental watermark without
    // the identity field. Upgrade listability without reparsing its history.
    conn.execute(
        "UPDATE imported_history_session_cache SET source_metadata_json = ''",
        [],
    )
    .unwrap();
    let watermark = crate::sources::imported_history::watermark::read_parse_watermark_from_conn(
        &conn,
        SOURCE_CODEX_APP,
        &original,
    )
    .unwrap();
    fixture.write(&resend, THREAD, "2026-08-24T22:19:04Z", false);
    fixture.write(&fork, FORK, "2026-08-24T22:20:00Z", true);
    for _ in 0..2 {
        fixture.sync(&mut conn);
        assert_eq!(visible(&conn), [resend.clone(), fork.clone()]);
        assert!(
            cache::query_cached_session_by_session_id_from_conn(&conn, &old_id)
                .unwrap()
                .is_none()
        );
        let status = cache::cached_session_continuation_status_from_conn(&conn, &old_id)
            .unwrap()
            .unwrap();
        assert_eq!(status, (Some(THREAD.to_string()), true));
        // Historical replay remains available; no raw or cached record is deleted.
        assert!(
            cache::query_cached_session_by_session_id_including_superseded_from_conn(
                &conn, &old_id
            )
            .unwrap()
            .is_some()
        );
    }
    assert_eq!(
        crate::sources::imported_history::watermark::read_parse_watermark_from_conn(
            &conn,
            SOURCE_CODEX_APP,
            &original
        )
        .unwrap(),
        watermark
    );
    let before_warm_scan = conn.total_changes();
    fixture.sync(&mut conn);
    assert_eq!(
        conn.total_changes(),
        before_warm_scan,
        "an unchanged scan must not rewrite the repaired cache"
    );
    let resumed_path =
        cache::get_cached_source_path_by_suffix_from_conn(&conn, SOURCE_CODEX_APP, THREAD)
            .unwrap()
            .unwrap();
    assert!(resumed_path.ends_with(&format!("{resend}.jsonl")));
    let plan =
        crate::sources::cli_resume::cli_resume_plan(SOURCE_CODEX_APP, &resend, None, None).unwrap();
    assert_eq!(plan.native_session_id, THREAD);
    drop(conn);
    let mut conn = fixture.conn();
    fixture.sync(&mut conn);
    assert_eq!(visible(&conn), [resend, fork]);
    assert_eq!(
        conn.query_row(
            "SELECT count(*) FROM imported_history_session_cache",
            [],
            |r| r.get::<_, i64>(0)
        )
        .unwrap(),
        3
    );
}

#[test]
fn resend_filename_resolves_thread_and_preserves_managed_ownership() {
    let fixture = Fixture::new("managed");
    let stem = format!("rollout-2026-08-25T06-19-04-{THREAD}_{ROLLOUT}");
    assert_eq!(index::codex_thread_id_from_file_stem(&stem), Some(THREAD));
    assert_eq!(index::codex_thread_id_from_file_stem(THREAD), Some(THREAD));
    assert_eq!(
        index::codex_thread_id_from_file_stem(&format!("rollout-2026-08-23T12-40-07-{THREAD}")),
        Some(THREAD)
    );
    assert_eq!(
        index::codex_thread_id_from_file_stem(&"中".repeat(13)),
        None
    );
    fixture.write(&stem, THREAD, "2026-08-24T22:19:04Z", false);
    std::fs::write(
        fixture.0.join("session_index.jsonl"),
        format!("{{\"id\":\"{THREAD}\",\"thread_name\":\"Native title\"}}\n"),
    )
    .unwrap();
    let mut conn = fixture.conn();
    fixture.sync(&mut conn);
    assert_eq!(
        conn.query_row("SELECT name FROM imported_history_session_cache", [], |r| r
            .get::<_, String>(0))
            .unwrap(),
        "Native title"
    );
    conn.execute_batch(
        "CREATE TABLE code_session_native_transcript_ids (source TEXT, source_session_id TEXT)",
    )
    .unwrap();
    conn.execute(
        "INSERT INTO code_session_native_transcript_ids VALUES (?1, ?2)",
        [SOURCE_CODEX_APP, THREAD],
    )
    .unwrap();
    fixture.sync(&mut conn);
    assert!(visible(&conn).is_empty());
    assert_eq!(
        conn.query_row(
            "SELECT client_origin FROM imported_history_session_cache",
            [],
            |r| r.get::<_, String>(0)
        )
        .unwrap(),
        "org2"
    );
    assert_eq!(
        meta::resolve_codex_transcript_for_thread_id_near_path(
            &fixture.0.join("sessions").join(format!("{stem}.jsonl")),
            THREAD
        )
        .unwrap()
        .unwrap()
        .source_session_id,
        stem
    );
    assert_eq!(
        conn.query_row(
            "SELECT parser_version FROM imported_history_session_cache",
            [],
            |r| r.get::<_, i64>(0)
        )
        .unwrap(),
        CODEX_APP_METADATA_PARSER_VERSION
    );
}
