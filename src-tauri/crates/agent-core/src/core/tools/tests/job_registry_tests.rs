use std::path::PathBuf;

use crate::tools::impls::coding::exec::registry::{self, JobKind, JobStatus};

#[test]
fn test_register_shell_and_get() {
    let pid = 99990;
    let tx = registry::register_shell(
        pid,
        "sleep 100".into(),
        PathBuf::from("/tmp/1.txt"),
        "s1".into(),
    );
    let handle = pid.to_string();
    assert!(registry::get_status(&handle).is_some());
    let (status, kind) = registry::get_status(&handle).unwrap();
    assert!(matches!(status, JobStatus::Running));
    assert!(matches!(kind, JobKind::Shell { .. }));

    let _ = tx.send("hello\n".into());
    assert!(registry::subscribe(&handle).is_some());

    registry::remove(&handle);
    assert!(registry::get_status(&handle).is_none());
}

#[test]
fn test_mark_exited_shell() {
    let pid = 99991;
    let _tx = registry::register_shell(pid, "ls".into(), PathBuf::from("/tmp/2.txt"), "s1".into());
    let handle = pid.to_string();
    registry::mark_exited(&handle, JobStatus::Exited(0));
    let (status, _) = registry::get_status(&handle).unwrap();
    assert!(matches!(status, JobStatus::Exited(0)));
    registry::remove(&handle);
}

#[test]
fn test_register_subagent() {
    let handle = "shadow-builtin:general-abc123".to_string();
    let (tx, _cancel) = registry::register_subagent(
        handle.clone(),
        "shadow".into(),
        "General Agent".into(),
        "parent-session".into(),
    );
    assert!(registry::get_status(&handle).is_some());
    let (status, kind) = registry::get_status(&handle).unwrap();
    assert!(matches!(status, JobStatus::Running));
    assert!(matches!(kind, JobKind::Subagent { .. }));

    let _ = tx.send("tool call: read_file\n".into());
    assert!(registry::subscribe(&handle).is_some());

    registry::set_final_result(&handle, "Found 7 files.".into());
    assert_eq!(
        registry::get_final_result(&handle),
        Some("Found 7 files.".into())
    );

    registry::mark_exited(&handle, JobStatus::Completed);
    let (status, _) = registry::get_status(&handle).unwrap();
    assert!(matches!(status, JobStatus::Completed));

    registry::remove(&handle);
    assert!(registry::get_status(&handle).is_none());
}

#[test]
fn test_list_shell_for_session() {
    let pid_a = 99992;
    let pid_b = 99993;
    let _tx_a = registry::register_shell(
        pid_a,
        "cmd_a".into(),
        PathBuf::from("/tmp/a.txt"),
        "session_x".into(),
    );
    let _tx_b = registry::register_shell(
        pid_b,
        "cmd_b".into(),
        PathBuf::from("/tmp/b.txt"),
        "session_y".into(),
    );

    let list = registry::list_shell_for_session("session_x");
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].0, pid_a);

    registry::remove(&pid_a.to_string());
    registry::remove(&pid_b.to_string());
}

#[test]
fn test_subagent_not_in_shell_list() {
    let handle = "agent-builtin:explore-xyz".to_string();
    let (_tx, _cancel) = registry::register_subagent(
        handle.clone(),
        "explore".into(),
        "Explorer".into(),
        "session_x".into(),
    );

    let list = registry::list_shell_for_session("session_x");
    assert!(list.is_empty());

    registry::remove(&handle);
}

#[tokio::test(flavor = "multi_thread")]
async fn test_kill_subagent_sets_job_cancel_flag() {
    use std::sync::atomic::Ordering;

    let handle = "agent-builtin:general-kill-flag".to_string();
    let (_tx, cancel) = registry::register_subagent(
        handle.clone(),
        "delegate".into(),
        "Worker".into(),
        "session_kill".into(),
    );
    assert!(!cancel.load(Ordering::SeqCst));

    registry::kill_subagent(&handle).expect("kill succeeds");
    assert!(
        cancel.load(Ordering::SeqCst),
        "kill must set the job's own cancel flag for cooperative shutdown"
    );
    let (status, _) = registry::get_status(&handle).unwrap();
    assert!(matches!(status, JobStatus::Killed));

    registry::remove(&handle);
}

#[tokio::test(flavor = "multi_thread")]
async fn test_killed_status_is_sticky_over_completed() {
    let handle = "agent-builtin:general-sticky".to_string();
    let (_tx, _cancel) = registry::register_subagent(
        handle.clone(),
        "delegate".into(),
        "Worker".into(),
        "session_sticky".into(),
    );

    registry::kill_subagent(&handle).expect("kill succeeds");
    // The cooperatively-cancelled worker's completion path still calls
    // mark_exited(Completed) — that must not overwrite the Killed verdict.
    registry::mark_exited(&handle, JobStatus::Completed);
    let (status, _) = registry::get_status(&handle).unwrap();
    assert!(matches!(status, JobStatus::Killed));

    registry::remove(&handle);
}

#[tokio::test(flavor = "multi_thread")]
async fn test_cancel_subagents_for_session_scopes_to_session() {
    use std::sync::atomic::Ordering;

    let mine = "agent-fanout-mine".to_string();
    let other = "agent-fanout-other".to_string();
    let (_tx1, mine_flag) = registry::register_subagent(
        mine.clone(),
        "delegate".into(),
        "Mine".into(),
        "session_fanout_a".into(),
    );
    let (_tx2, other_flag) = registry::register_subagent(
        other.clone(),
        "delegate".into(),
        "Other".into(),
        "session_fanout_b".into(),
    );

    let cancelled = registry::cancel_subagents_for_session("session_fanout_a");
    assert_eq!(cancelled, 1);
    assert!(mine_flag.load(Ordering::SeqCst));
    assert!(
        !other_flag.load(Ordering::SeqCst),
        "fan-out must not touch other sessions' workers"
    );

    registry::remove(&mine);
    registry::remove(&other);
}
