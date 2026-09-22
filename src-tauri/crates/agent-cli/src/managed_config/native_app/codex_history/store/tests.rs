//! Isolated native-schema fixtures and persistence regression tests.
use super::schema::{Column, HISTORY_TRIGGERS, STATE_TABLES, STATE_TRIGGERS};
use super::*;

fn create_table(connection: &Connection, name: &str, columns: &[Column]) {
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
    if name == "threads" {
        parts.push("FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL".into());
        parts.push(
            "FOREIGN KEY(thread_section_id) REFERENCES thread_sections(id) ON DELETE SET NULL"
                .into(),
        );
    }
    connection
        .execute_batch(&format!("CREATE TABLE {name} ({})", parts.join(",")))
        .unwrap();
}

pub(super) fn home() -> tempfile::TempDir {
    let home = tempfile::tempdir().unwrap();
    let state = Connection::open(home.path().join(STATE_FILE)).unwrap();
    state.execute_batch("PRAGMA journal_mode=WAL; CREATE TABLE _sqlx_migrations(version INTEGER PRIMARY KEY, success BOOLEAN NOT NULL); CREATE TABLE sequence_fixture(id INTEGER PRIMARY KEY AUTOINCREMENT); DROP TABLE sequence_fixture;").unwrap();
    for version in 1..=55 {
        state
            .execute("INSERT INTO _sqlx_migrations VALUES (?1,1)", [version])
            .unwrap();
    }
    create_table(&state, "threads", THREAD_COLUMNS);
    for name in STATE_TABLES
        .iter()
        .filter(|name| !matches!(**name, "threads" | "_sqlx_migrations" | "sqlite_sequence"))
    {
        state
            .execute_batch(&format!("CREATE TABLE {name}(id TEXT PRIMARY KEY)"))
            .unwrap();
    }
    for (_, sql) in STATE_TRIGGERS {
        state.execute_batch(sql).unwrap();
    }
    let history = Connection::open(home.path().join(HISTORY_FILE)).unwrap();
    history.execute_batch("PRAGMA journal_mode=WAL; CREATE TABLE _sqlx_migrations(version INTEGER PRIMARY KEY, success BOOLEAN NOT NULL)").unwrap();
    for version in 1..=6 {
        history
            .execute("INSERT INTO _sqlx_migrations VALUES (?1,1)", [version])
            .unwrap();
    }
    for (table, columns) in HISTORY_TABLES {
        create_table(&history, table, columns);
    }
    for (_, sql) in HISTORY_TRIGGERS {
        history.execute_batch(sql).unwrap();
    }
    home
}

pub(super) fn seed(home: &Path, id: &str, rollout: &str) {
    let state = Connection::open(home.join(STATE_FILE)).unwrap();
    let mut values = THREAD_COLUMNS
        .iter()
        .map(|column| match (column.1, column.2) {
            (_, 0) => Value::Null,
            ("TEXT", _) => Value::Text(String::new()),
            _ => Value::Integer(0),
        })
        .collect::<Vec<_>>();
    for (column, value) in [
        ("id", id),
        (
            "rollout_path",
            home.join(format!("sessions/{rollout}.jsonl"))
                .to_str()
                .unwrap(),
        ),
        ("model_provider", "openai"),
        ("model", "source-model"),
        ("title", "Conversation"),
        ("source", "cli"),
        ("cwd", "/test"),
        ("history_mode", "paginated"),
        ("sandbox_policy", "{\"type\":\"danger-full-access\"}"),
        ("approval_mode", "never"),
        ("memory_mode", "enabled"),
    ] {
        values[column_index(column)] = Value::Text(value.to_string());
    }
    state
        .execute(
            &format!(
                "INSERT INTO threads ({}) VALUES ({})",
                columns_sql(THREAD_COLUMNS),
                vec!["?"; THREAD_COLUMNS.len()].join(",")
            ),
            params_from_iter(values.iter()),
        )
        .unwrap();
    seed_projection(home, rollout);
}

fn seed_projection(home: &Path, rollout: &str) {
    let history = Connection::open(home.join(HISTORY_FILE)).unwrap();
    history
        .execute(
            "INSERT INTO thread_history_projection_state VALUES (?1,321,9)",
            [rollout],
        )
        .unwrap();
    history.execute("INSERT INTO thread_items VALUES (?1,'turn','tool',4,10,'{\"type\":\"commandExecution\",\"raw\":\"unchanged\"}','commandExecution',8)", [rollout]).unwrap();
    history.execute("INSERT INTO thread_turns VALUES (?1,'turn',2,'completed',NULL,1,2,1,'user','assistant',123,9,321)", [rollout]).unwrap();
    history.execute("INSERT INTO thread_realtime_items VALUES (?1,'audio',5,11,'audio','{\"raw\":\"voice\"}')", [rollout]).unwrap();
}

#[test]
fn completed_gate_uses_its_held_snapshot_and_requires_every_selected_rollout() {
    let source = home();
    seed(source.path(), "thread", "current");
    seed_projection(source.path(), "ancestor");
    let ids = ["ancestor".into(), "current".into()];
    let before = prepare(source.path(), "thread", &ids).unwrap();
    assert!(before.completed_rollouts().unwrap());
    let history = Connection::open(source.path().join(HISTORY_FILE)).unwrap();
    history
        .execute(
            "UPDATE thread_turns SET status='inProgress' WHERE thread_id='ancestor'",
            [],
        )
        .unwrap();
    assert!(
        before.completed_rollouts().unwrap(),
        "a prepared snapshot must not drift with the live source"
    );
    let fresh = prepare(source.path(), "thread", &ids).unwrap();
    assert!(!fresh.completed_rollouts().unwrap());
    assert_eq!(before.projections(), fresh.projections());
    drop(fresh);
    history
        .execute("UPDATE thread_turns SET status='completed'", [])
        .unwrap();
    history.execute("UPDATE thread_history_projection_state SET next_rollout_ordinal=10 WHERE thread_id='current'", []).unwrap();
    let progressed = prepare(source.path(), "thread", &ids).unwrap();
    assert!(progressed.completed_rollouts().unwrap());
    assert_ne!(before.projections(), progressed.projections());
    drop(progressed);
    history
        .execute("DELETE FROM thread_turns WHERE thread_id='ancestor'", [])
        .unwrap();
    assert!(!prepare(source.path(), "thread", &ids)
        .unwrap()
        .completed_rollouts()
        .unwrap());
}

#[test]
fn completed_gate_rejects_noncompleted_empty_null_and_legacy_turns() {
    let source = home();
    seed(source.path(), "thread", "current");
    let ids = ["current".into()];
    let history = Connection::open(source.path().join(HISTORY_FILE)).unwrap();
    for status in [
        "inProgress",
        "failed",
        "interrupted",
        "",
        "COMPLETED",
        "completed ",
    ] {
        history
            .execute("UPDATE thread_turns SET status=?1", [status])
            .unwrap();
        assert!(
            !prepare(source.path(), "thread", &ids)
                .unwrap()
                .completed_rollouts()
                .unwrap(),
            "accepted {status:?}"
        );
    }
    history
        .execute("UPDATE thread_turns SET status='completed'", [])
        .unwrap();
    let completed = prepare(source.path(), "thread", &ids).unwrap();
    // Native schema already forbids NULL. Exercise the defensive query against
    // a malformed row without weakening the native schema gate for imports.
    let malformed = Connection::open_in_memory().unwrap();
    malformed.execute_batch("CREATE TABLE thread_turns(thread_id TEXT,status TEXT); INSERT INTO thread_turns VALUES ('current','completed'),('current',NULL)").unwrap();
    let malformed = PreparedThread {
        source: malformed,
        history_schema: "main",
        record: completed.record.clone(),
        projections: completed.projections.clone(),
    };
    assert!(!malformed.completed_rollouts().unwrap());
    drop(completed);
    history.execute("DELETE FROM thread_turns", []).unwrap();
    assert!(!prepare(source.path(), "thread", &ids)
        .unwrap()
        .completed_rollouts()
        .unwrap());
    Connection::open(source.path().join(STATE_FILE))
        .unwrap()
        .execute("UPDATE threads SET history_mode='legacy'", [])
        .unwrap();
    assert!(!prepare(source.path(), "thread", &ids)
        .unwrap()
        .completed_rollouts()
        .unwrap());
}

#[test]
fn durable_snapshot_restores_complete_projection_without_original_databases() {
    let source = home();
    let target = home();
    let journal = tempfile::tempdir().unwrap();
    let snapshot = journal
        .path()
        .canonicalize()
        .unwrap()
        .join("snapshot.sqlite");
    seed(source.path(), "thread", "replacement");
    seed_projection(source.path(), "ancestor");
    let prepared = prepare(
        source.path(),
        "thread",
        &["replacement".into(), "ancestor".into()],
    )
    .unwrap();
    let original_path = prepared.record().rollout_path.clone();
    prepared.persist_snapshot(&snapshot, || Ok(())).unwrap();
    drop(prepared);
    // Native source progress or even removal cannot invalidate recovery.
    drop(source);
    let restored = PreparedThread::from_snapshot(&snapshot).unwrap();
    assert_eq!(restored.record().rollout_path, original_path);
    assert_eq!(restored.projections().len(), 2);
    restored
        .apply(
            target.path(),
            &target.path().join("sessions/replacement.jsonl"),
            &["replacement".into(), "ancestor".into()],
            "orgii",
            "target-model",
            None,
            || Ok(()),
        )
        .unwrap();
    let history = Connection::open(target.path().join(HISTORY_FILE)).unwrap();
    for (table, _) in HISTORY_TABLES {
        let count: i64 = history
            .query_row(&format!("SELECT count(*) FROM {table}"), [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(count, 2, "{table}");
    }
    let voice: String = history
        .query_row(
            "SELECT item_json FROM thread_realtime_items WHERE thread_id='replacement'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(voice, "{\"raw\":\"voice\"}");
    let snapshot_connection = Connection::open(&snapshot).unwrap();
    let names: Vec<String> = snapshot_connection
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .unwrap()
        .query_map([], |row| row.get(0))
        .unwrap()
        .collect::<Result<_, _>>()
        .unwrap();
    assert_eq!(names.len(), 7);
    assert!(!names
        .iter()
        .any(|name| name == "remote_control_enrollments" || name == "projects"));
}

#[test]
fn snapshot_owner_cancellation_leaves_no_publish_and_existing_snapshot_is_immutable() {
    let source = home();
    let journal = tempfile::tempdir().unwrap();
    let root = journal.path().canonicalize().unwrap();
    let snapshot = root.join("snapshot.sqlite");
    seed(source.path(), "thread", "replacement");
    let prepared = prepare(source.path(), "thread", &["replacement".into()]).unwrap();
    let mut checks = 0;
    let result = prepared.persist_snapshot(&snapshot, || {
        checks += 1;
        if checks >= 2 {
            Err("owner revoked".into())
        } else {
            Ok(())
        }
    });
    assert_eq!(result.unwrap_err(), "owner revoked");
    assert!(!snapshot.exists());
    assert_eq!(std::fs::read_dir(&root).unwrap().count(), 0);
    prepared.persist_snapshot(&snapshot, || Ok(())).unwrap();
    let original = std::fs::read(&snapshot).unwrap();
    assert!(prepared.persist_snapshot(&snapshot, || Ok(())).is_err());
    assert_eq!(std::fs::read(&snapshot).unwrap(), original);
}

#[test]
fn snapshot_rejects_unknown_schema_unrelated_rollouts_and_sidecars() {
    let source = home();
    let journal = tempfile::tempdir().unwrap();
    let root = journal.path().canonicalize().unwrap();
    seed(source.path(), "thread", "replacement");
    let prepared = prepare(source.path(), "thread", &["replacement".into()]).unwrap();
    let unknown = root.join("unknown.sqlite");
    prepared.persist_snapshot(&unknown, || Ok(())).unwrap();
    Connection::open(&unknown)
        .unwrap()
        .execute_batch("CREATE TABLE future_semantics(id TEXT)")
        .unwrap();
    assert!(PreparedThread::from_snapshot(&unknown).is_err());
    let unrelated = root.join("unrelated.sqlite");
    prepared.persist_snapshot(&unrelated, || Ok(())).unwrap();
    Connection::open(&unrelated)
        .unwrap()
        .execute(
            "INSERT INTO thread_realtime_items VALUES ('other','audio',1,1,'audio','{}')",
            [],
        )
        .unwrap();
    assert!(PreparedThread::from_snapshot(&unrelated).is_err());
    let sidecar = root.join("sidecar.sqlite");
    prepared.persist_snapshot(&sidecar, || Ok(())).unwrap();
    std::fs::write(root.join("sidecar.sqlite-wal"), []).unwrap();
    assert!(PreparedThread::from_snapshot(&sidecar).is_err());
}

#[test]
fn publishes_raw_projections_and_conservative_new_route_without_other_state() {
    let source = home();
    let target = home();
    seed(source.path(), "thread", "replacement");
    seed_projection(source.path(), "ancestor");
    let prepared = prepare(
        source.path(),
        "thread",
        &["replacement".into(), "ancestor".into()],
    )
    .unwrap();
    assert_eq!(prepared.projections()[0].next_byte_offset, Some(321));
    let published = prepared
        .apply(
            target.path(),
            &target.path().join("sessions/replacement.jsonl"),
            &["replacement".into(), "ancestor".into()],
            "orgii",
            "market-model",
            None,
            || Ok(()),
        )
        .unwrap();
    assert_eq!(published.metadata_hash, prepared.record().metadata_hash);
    assert_eq!(
        text_value(&published.values, "model_provider").unwrap(),
        "orgii"
    );
    let (_, _, permissions, _) = published.routing_settings().unwrap();
    assert_eq!(permissions["type"], "managed");
    assert_eq!(permissions["network"], "restricted");
    assert_eq!(permissions["file_system"]["entries"][0]["access"], "read");
    assert_eq!(
        text_value(&published.values, "approval_mode").unwrap(),
        "on-request"
    );
    assert_eq!(
        text_value(&published.values, "memory_mode").unwrap(),
        "disabled"
    );
    let copied = open(target.path(), false, true).unwrap();
    assert_eq!(
        copied
            .query_row(
                "SELECT count(*) FROM history.thread_realtime_items",
                [],
                |row| row.get::<_, i64>(0)
            )
            .unwrap(),
        2
    );
    assert_eq!(copied.query_row("SELECT rollout_end_byte_offset FROM history.thread_turns WHERE thread_id='ancestor'", [], |row| row.get::<_, i64>(0)).unwrap(), 321);
    assert_eq!(
        copied
            .query_row(
                "SELECT count(*) FROM remote_control_enrollments",
                [],
                |row| row.get::<_, i64>(0)
            )
            .unwrap(),
        0
    );
}

#[test]
fn publishes_selected_route_and_preserves_permissions_and_grouping() {
    let source = home();
    let target = home();
    seed(source.path(), "thread", "replacement");
    seed(target.path(), "thread", "replacement");
    let target_db = Connection::open(target.path().join(STATE_FILE)).unwrap();
    target_db
        .execute("INSERT INTO projects VALUES ('local-project')", [])
        .unwrap();
    target_db
        .execute("INSERT INTO thread_sections VALUES ('local-section')", [])
        .unwrap();
    target_db.execute("UPDATE threads SET model_provider='outdated-provider',model='outdated-model',approval_mode='untrusted',sandbox_policy='local-policy',project_id='local-project',thread_section_id='local-section',is_pinned=1", []).unwrap();
    let before = list_threads(target.path(), None).unwrap().remove(0);
    let prepared = prepare(source.path(), "thread", &["replacement".into()]).unwrap();
    let record = prepared
        .apply(
            target.path(),
            &target.path().join("sessions/replacement.jsonl"),
            &["replacement".into()],
            "orgii",
            "chosen",
            Some(&before.metadata_hash),
            || Ok(()),
        )
        .unwrap();
    for (field, expected) in [
        ("model_provider", "orgii"),
        ("model", "chosen"),
        ("approval_mode", "untrusted"),
        ("sandbox_policy", "local-policy"),
        ("project_id", "local-project"),
        ("thread_section_id", "local-section"),
    ] {
        assert_eq!(text_value(&record.values, field).unwrap(), expected);
    }
    let history = Connection::open(target.path().join(HISTORY_FILE)).unwrap();
    assert_eq!(
        history
            .query_row("SELECT count(*) FROM thread_realtime_items", [], |row| row
                .get::<_, i64>(
                0
            ))
            .unwrap(),
        1
    );
}

#[test]
fn source_snapshot_does_not_mix_later_metadata_or_projection_writes() {
    let source = home();
    let target = home();
    seed(source.path(), "thread", "rollout");
    let prepared = prepare(source.path(), "thread", &["rollout".into()]).unwrap();
    Connection::open(source.path().join(STATE_FILE))
        .unwrap()
        .execute("UPDATE threads SET title='later'", [])
        .unwrap();
    Connection::open(source.path().join(HISTORY_FILE))
        .unwrap()
        .execute("UPDATE thread_items SET item_json='later'", [])
        .unwrap();
    let record = prepared
        .apply(
            target.path(),
            &target.path().join("sessions/rollout.jsonl"),
            &["rollout".into()],
            "orgii",
            "chosen",
            None,
            || Ok(()),
        )
        .unwrap();
    assert_eq!(text_value(&record.values, "title").unwrap(), "Conversation");
    let history = Connection::open(target.path().join(HISTORY_FILE)).unwrap();
    assert_ne!(
        history
            .query_row("SELECT item_json FROM thread_items", [], |row| row
                .get::<_, String>(0))
            .unwrap(),
        "later"
    );
}

#[test]
fn identity_change_rolls_back_both_databases() {
    let source = home();
    let target = home();
    seed(source.path(), "thread", "rollout");
    let prepared = prepare(source.path(), "thread", &["rollout".into()]).unwrap();
    let mut checks = 0;
    let result = prepared.apply(
        target.path(),
        &target.path().join("sessions/rollout.jsonl"),
        &["rollout".into()],
        "orgii",
        "chosen",
        None,
        || {
            checks += 1;
            if checks == 3 {
                Err("owner changed".into())
            } else {
                Ok(())
            }
        },
    );
    assert!(result.is_err());
    assert!(list_threads(target.path(), None).unwrap().is_empty());
    let history = Connection::open(target.path().join(HISTORY_FILE)).unwrap();
    assert_eq!(
        history
            .query_row("SELECT count(*) FROM thread_items", [], |row| row
                .get::<_, i64>(0))
            .unwrap(),
        0
    );
}

#[test]
fn refuses_unknown_columns_tables_triggers_or_missing_checkpoint() {
    for mutation in [
        "ALTER TABLE threads ADD COLUMN future_control TEXT",
        "CREATE TABLE future_history(id TEXT)",
        "CREATE TRIGGER surprise AFTER UPDATE ON threads BEGIN DELETE FROM projects; END",
        "INSERT INTO _sqlx_migrations VALUES (56,1)",
    ] {
        let source = home();
        seed(source.path(), "thread", "rollout");
        Connection::open(source.path().join(STATE_FILE))
            .unwrap()
            .execute_batch(mutation)
            .unwrap();
        assert!(
            prepare(source.path(), "thread", &["rollout".into()]).is_err(),
            "{mutation}"
        );
    }
    let source = home();
    seed(source.path(), "thread", "rollout");
    Connection::open(source.path().join(HISTORY_FILE))
        .unwrap()
        .execute("DELETE FROM thread_history_projection_state", [])
        .unwrap();
    assert!(prepare(source.path(), "thread", &["rollout".into()]).is_err());
}

#[test]
fn refuses_target_conflict_without_changing_history() {
    let source = home();
    let target = home();
    seed(source.path(), "thread", "rollout");
    seed(target.path(), "thread", "rollout");
    let before = list_threads(target.path(), None).unwrap().remove(0);
    Connection::open(target.path().join(STATE_FILE))
        .unwrap()
        .execute("UPDATE threads SET title='renamed'", [])
        .unwrap();
    let prepared = prepare(source.path(), "thread", &["rollout".into()]).unwrap();
    assert!(prepared
        .apply(
            target.path(),
            &target.path().join("sessions/rollout.jsonl"),
            &["rollout".into()],
            "orgii",
            "chosen",
            Some(&before.metadata_hash),
            || Ok(())
        )
        .is_err());
    assert_eq!(
        list_threads(target.path(), None).unwrap()[0].values[column_index("title")],
        Value::Text("renamed".into())
    );
}

#[test]
fn does_not_replace_projection_for_an_existing_unimported_ancestor() {
    let source = home();
    let target = home();
    seed(source.path(), "thread", "replacement");
    seed_projection(source.path(), "ancestor");
    seed_projection(target.path(), "ancestor");
    let history = Connection::open(target.path().join(HISTORY_FILE)).unwrap();
    history.execute("UPDATE thread_history_projection_state SET next_rollout_byte_offset=999,next_rollout_ordinal=20", []).unwrap();
    history
        .execute(
            "UPDATE thread_items SET item_json='target later history'",
            [],
        )
        .unwrap();
    let prepared = prepare(
        source.path(),
        "thread",
        &["replacement".into(), "ancestor".into()],
    )
    .unwrap();
    prepared
        .apply(
            target.path(),
            &target.path().join("sessions/replacement.jsonl"),
            &["replacement".into()],
            "orgii",
            "chosen",
            None,
            || Ok(()),
        )
        .unwrap();
    let checkpoint = checkpoints(target.path(), &["ancestor".into()])
        .unwrap()
        .remove(0);
    assert_eq!(checkpoint.next_byte_offset, Some(999));
    assert_eq!(checkpoint.next_ordinal, Some(20));
    assert_eq!(
        history
            .query_row(
                "SELECT item_json FROM thread_items WHERE thread_id='ancestor'",
                [],
                |row| row.get::<_, String>(0)
            )
            .unwrap(),
        "target later history"
    );
}

#[cfg(unix)]
#[test]
fn refuses_database_sidecar_symlinks_before_opening_the_target() {
    let source = home();
    let target = home();
    seed(source.path(), "thread", "rollout");
    let prepared = prepare(source.path(), "thread", &["rollout".into()]).unwrap();
    let outside = target.path().join("outside");
    std::fs::write(&outside, b"untouched").unwrap();
    std::os::unix::fs::symlink(&outside, target.path().join(format!("{STATE_FILE}-wal"))).unwrap();
    assert!(prepared
        .apply(
            target.path(),
            &target.path().join("sessions/rollout.jsonl"),
            &["rollout".into()],
            "orgii",
            "chosen",
            None,
            || Ok(())
        )
        .is_err());
    assert_eq!(std::fs::read(outside).unwrap(), b"untouched");
}
