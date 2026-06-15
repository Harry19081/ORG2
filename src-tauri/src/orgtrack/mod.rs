pub mod exporter;
pub mod history_commands;
pub mod importer;
pub mod paths;
pub mod types;

use std::path::PathBuf;

use database::db::get_connection;
use orgtrack_core::projectors::stats::{session_summaries, CoreSessionSummary};
use orgtrack_core::store::{sqlite::SqliteRecordStore, RecordStore};
use types::OrgtrackTier;

#[tauri::command]
pub async fn orgtrack_initialize(
    repo_path: String,
    tier: Option<String>,
    allow_raw_trajectory: Option<bool>,
) -> Result<types::OrgtrackExportResult, String> {
    let tier = validate_tier(tier.as_deref(), allow_raw_trajectory)?;
    tokio::task::spawn_blocking(move || {
        exporter::initialize_orgtrack(&PathBuf::from(repo_path), tier)
    })
    .await
    .map_err(|err| err.to_string())?
}

#[tauri::command]
pub async fn orgtrack_scan_start(
    repo_path: String,
    tier: Option<String>,
    allow_raw_trajectory: Option<bool>,
    resume: Option<bool>,
    rebuild: Option<bool>,
) -> Result<types::OrgtrackScanProgress, String> {
    let tier = validate_tier(tier.as_deref(), allow_raw_trajectory)?;
    exporter::start_orgtrack_scan(types::OrgtrackScanOptions {
        repo_path,
        tier,
        allow_raw_trajectory: allow_raw_trajectory.unwrap_or(false),
        resume: resume.unwrap_or(true),
        rebuild: rebuild.unwrap_or(false),
    })
}

#[tauri::command]
pub async fn orgtrack_scan_status(
    repo_path: String,
) -> Result<Option<types::OrgtrackScanProgress>, String> {
    tokio::task::spawn_blocking(move || exporter::read_scan_progress(&PathBuf::from(repo_path)))
        .await
        .map_err(|err| err.to_string())?
}

#[tauri::command]
pub async fn orgtrack_scan_cancel(
    repo_path: String,
) -> Result<types::OrgtrackScanProgress, String> {
    tokio::task::spawn_blocking(move || exporter::cancel_orgtrack_scan(&PathBuf::from(repo_path)))
        .await
        .map_err(|err| err.to_string())?
}

#[tauri::command]
pub async fn orgtrack_export(
    repo_path: String,
    tier: Option<String>,
    allow_raw_trajectory: Option<bool>,
) -> Result<types::OrgtrackExportResult, String> {
    let tier = validate_tier(tier.as_deref(), allow_raw_trajectory)?;
    tokio::task::spawn_blocking(move || exporter::export_orgtrack(&PathBuf::from(repo_path), tier))
        .await
        .map_err(|err| err.to_string())?
}

#[tauri::command]
pub async fn orgtrack_sync_core_repo(repo_path: String) -> Result<types::OrgtrackIndex, String> {
    tokio::task::spawn_blocking(move || {
        let conn = get_connection().map_err(|err| err.to_string())?;
        let store = SqliteRecordStore::new(&conn);
        orgtrack_core::repo_sync::sync_repo_from_store(&store, &PathBuf::from(repo_path))
    })
    .await
    .map_err(|err| err.to_string())?
}

#[tauri::command]
pub async fn orgtrack_get_index(repo_path: String) -> Result<Option<types::OrgtrackIndex>, String> {
    tokio::task::spawn_blocking(move || importer::read_index(&PathBuf::from(repo_path)))
        .await
        .map_err(|err| err.to_string())?
}

#[tauri::command]
pub async fn orgtrack_get_file_timeline(
    repo_path: String,
    file_path: String,
) -> Result<Option<types::OrgtrackFileTimeline>, String> {
    tokio::task::spawn_blocking(move || {
        importer::read_file_timeline(&PathBuf::from(repo_path), &file_path)
    })
    .await
    .map_err(|err| err.to_string())?
}

#[tauri::command]
pub async fn orgtrack_get_session_summaries(
    workspace_path: Option<String>,
) -> Result<Vec<CoreSessionSummary>, String> {
    tokio::task::spawn_blocking(move || {
        let conn = get_connection().map_err(|err| err.to_string())?;
        let store = SqliteRecordStore::new(&conn);
        let sessions = store.list_sessions(workspace_path.as_deref())?;
        let file_changes = store.list_file_changes(None)?;
        let commit_links = store.list_commit_links()?;
        Ok(session_summaries(sessions, file_changes, commit_links))
    })
    .await
    .map_err(|err| err.to_string())?
}

#[tauri::command]
pub async fn orgtrack_lookup_file_sessions(
    repo_path: String,
    file_path: String,
) -> Result<Option<types::OrgtrackFileSessionLookup>, String> {
    tokio::task::spawn_blocking(move || {
        importer::read_file_session_lookup(&PathBuf::from(repo_path), &file_path)
    })
    .await
    .map_err(|err| err.to_string())?
}

fn validate_tier(
    tier: Option<&str>,
    allow_raw_trajectory: Option<bool>,
) -> Result<OrgtrackTier, String> {
    let tier = OrgtrackTier::from_optional_str(tier)?;
    if tier.includes_trajectory() && allow_raw_trajectory != Some(true) {
        return Err(
            "Trajectory export can include prompts, tool payloads, file contents, and secrets. Pass allowRawTrajectory=true to opt in."
                .to_string(),
        );
    }
    Ok(tier)
}
