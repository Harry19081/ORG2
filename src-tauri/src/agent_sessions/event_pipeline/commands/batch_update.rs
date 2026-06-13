//! Batch Update Commands
//!
//! Bulk operations: complete last running, patch by IDs, remove by prefix,
//! replace and remove, update task args, shell output/process updates.
//!
//! All commands accept an optional `session_id`. When omitted, the active
//! session is targeted.

use tauri::{AppHandle, State};

use crate::agent_sessions::event_pipeline::types::{SessionEvent, SessionEventPatch};

use super::{schedule_notify, EventStoreState};

/// Shell tools list shared by output and process update commands.
const SHELL_TOOLS: &[&str] = &[
    "bash",
    "shell",
    "execute_command",
    "run_terminal_command",
    "terminal",
    "terminal_command",
    "run_shell",
];

const DELETE_EVENT_MAX_RETRIES: u32 = 3;

fn delete_event_with_retry(session_id: &str, event_id: &str) -> Result<(), String> {
    for attempt in 0..DELETE_EVENT_MAX_RETRIES {
        match session_persistence::delete_event(session_id, event_id) {
            Ok(_) => return Ok(()),
            Err(err) if attempt + 1 < DELETE_EVENT_MAX_RETRIES => {
                let delay_ms = 250 * (attempt + 1) as u64;
                tracing::debug!(
                    session_id,
                    event_id,
                    error = %err,
                    attempt = attempt + 1,
                    max_retries = DELETE_EVENT_MAX_RETRIES,
                    delay_ms,
                    "es_remove_by_id persist delete failed; retrying"
                );
                std::thread::sleep(std::time::Duration::from_millis(delay_ms));
            }
            Err(err) => {
                return Err(err.to_string());
            }
        }
    }
    Err("delete_event retry loop ran no attempts".to_string())
}

/// Complete the last running event (mark as completed).
#[tauri::command]
pub async fn es_complete_last_running(
    app: AppHandle,
    state: State<'_, EventStoreState>,
    session_id: Option<String>,
) -> Result<Option<String>, String> {
    let sid = state.resolve_session_id(session_id)?;
    let result = state.with_store_mut(&sid, |store| store.complete_last_running());
    if result.is_some() {
        schedule_notify(&app, &state, &sid);
    }
    Ok(result)
}

/// Batch-update multiple events by IDs with the same patch.
#[tauri::command]
pub async fn es_patch_by_ids(
    app: AppHandle,
    state: State<'_, EventStoreState>,
    session_id: Option<String>,
    ids: Vec<String>,
    patch: SessionEventPatch,
) -> Result<usize, String> {
    let sid = state.resolve_session_id(session_id)?;
    let count = state.with_store_mut(&sid, |store| store.patch_by_ids(&ids, &patch));
    if count > 0 {
        schedule_notify(&app, &state, &sid);
    }
    Ok(count)
}

/// Remove one event by exact ID.
#[tauri::command]
pub async fn es_remove_by_id(
    app: AppHandle,
    state: State<'_, EventStoreState>,
    session_id: Option<String>,
    id: String,
) -> Result<bool, String> {
    let sid = state.resolve_session_id(session_id)?;
    let removed = state.with_store_mut(&sid, |store| store.remove_by_id(&id));
    if removed {
        let persist_sid = sid.clone();
        let persist_id = id.clone();
        let log_sid = persist_sid.clone();
        let log_id = persist_id.clone();
        tokio::spawn(async move {
            let result = tokio::task::spawn_blocking(move || {
                delete_event_with_retry(&persist_sid, &persist_id)
            })
            .await;
            match result {
                Ok(Ok(_)) => {}
                Ok(Err(err)) => tracing::warn!(
                    session_id = %log_sid,
                    event_id = %log_id,
                    error = %err,
                    "es_remove_by_id failed to persist event deletion"
                ),
                Err(err) => tracing::warn!(
                    session_id = %log_sid,
                    event_id = %log_id,
                    error = %err,
                    "es_remove_by_id persistence task failed"
                ),
            }
        });
        schedule_notify(&app, &state, &sid);
    }
    Ok(removed)
}

/// Remove events whose IDs start with a given prefix.
#[tauri::command]
pub async fn es_remove_by_id_prefix(
    app: AppHandle,
    state: State<'_, EventStoreState>,
    session_id: Option<String>,
    prefix: String,
) -> Result<usize, String> {
    let sid = state.resolve_session_id(session_id)?;
    let removed = state.with_store_mut(&sid, |store| store.remove_by_id_prefix(&prefix));
    if removed > 0 {
        schedule_notify(&app, &state, &sid);
    }
    Ok(removed)
}

/// Remove frontend-injected user placeholders after the backend user turn arrives.
#[tauri::command]
pub async fn es_remove_synthetic_user_inputs(
    app: AppHandle,
    state: State<'_, EventStoreState>,
    session_id: Option<String>,
) -> Result<usize, String> {
    let sid = state.resolve_session_id(session_id)?;
    let removed = state.with_store_mut(&sid, |store| store.remove_synthetic_user_inputs());
    if removed > 0 {
        schedule_notify(&app, &state, &sid);
    }
    Ok(removed)
}

/// Atomically remove one event and upsert another.
/// Used for stream finalization (remove streaming placeholder, insert final).
#[tauri::command]
pub async fn es_replace_and_remove(
    app: AppHandle,
    state: State<'_, EventStoreState>,
    session_id: Option<String>,
    remove_id: Option<String>,
    new_event: SessionEvent,
) -> Result<bool, String> {
    let sid = state.resolve_session_id(session_id)?;
    state.with_store_mut(&sid, |store| {
        store.replace_and_remove(remove_id.as_deref(), new_event);
    });
    schedule_notify(&app, &state, &sid);
    Ok(true)
}

/// Update args on the last active spawning tool_call (task, session, spawn, Task).
#[tauri::command]
pub async fn es_update_active_task_args(
    app: AppHandle,
    state: State<'_, EventStoreState>,
    session_id: Option<String>,
    merge_args: serde_json::Value,
    function_names: Option<Vec<String>>,
) -> Result<Option<String>, String> {
    let sid = state.resolve_session_id(session_id)?;
    let default_names = vec!["task".to_string()];
    let names = function_names.unwrap_or(default_names);
    let names_refs: Vec<&str> = names.iter().map(|s| s.as_str()).collect();
    let result = state.with_store_mut(&sid, |store| {
        store.update_spawning_tool_args(&names_refs, merge_args)
    });
    if result.is_some() {
        schedule_notify(&app, &state, &sid);
    }
    Ok(result)
}

/// Update streamOutput on the last shell tool_call event.
#[tauri::command]
pub async fn es_update_last_shell_output(
    app: AppHandle,
    state: State<'_, EventStoreState>,
    session_id: Option<String>,
    stream_output: String,
) -> Result<Option<String>, String> {
    let sid = state.resolve_session_id(session_id)?;
    let result = state.with_store_mut(&sid, |store| {
        store.update_last_shell_output(stream_output, SHELL_TOOLS)
    });
    if result.is_some() {
        schedule_notify(&app, &state, &sid);
    }
    Ok(result)
}

/// Update shell process info (pid, status, exit_code, log_path) on the last shell tool_call event.
#[tauri::command]
pub async fn es_update_last_shell_process(
    app: AppHandle,
    state: State<'_, EventStoreState>,
    session_id: Option<String>,
    pid: u32,
    status: String,
    exit_code: Option<i32>,
    log_path: Option<String>,
) -> Result<Option<String>, String> {
    let sid = state.resolve_session_id(session_id)?;
    let result = state.with_store_mut(&sid, |store| {
        store.update_last_shell_process(pid, &status, exit_code, log_path.as_deref(), SHELL_TOOLS)
    });
    if result.is_some() {
        schedule_notify(&app, &state, &sid);
    }
    Ok(result)
}

/// Check if there is an active spawning tool_call in the store.
#[tauri::command]
pub async fn es_has_active_task(
    state: State<'_, EventStoreState>,
    session_id: Option<String>,
    function_names: Option<Vec<String>>,
) -> Result<bool, String> {
    let sid = state.resolve_session_id(session_id)?;
    let default_names = vec!["task".to_string()];
    let names = function_names.unwrap_or(default_names);
    let names_refs: Vec<&str> = names.iter().map(|s| s.as_str()).collect();
    Ok(state
        .with_store_opt(&sid, |store| store.has_active_spawning_tool(&names_refs))
        .unwrap_or(false))
}
