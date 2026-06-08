//! Path helpers + manifest I/O. All other modules go through these to read
//! or write a `FileSnapshot` JSON file under
//! `~/.orgii/file-history/<session_id>/`.

use std::fs;
use std::io;
use std::collections::BTreeMap;
use std::path::PathBuf;

use app_paths as paths;

use super::types::FileSnapshot;

pub(super) fn session_root(session_id: &str) -> PathBuf {
    paths::file_history_dir(session_id)
}

pub(super) fn backups_dir(session_id: &str) -> PathBuf {
    session_root(session_id).join("backups")
}

pub(super) fn snapshots_dir(session_id: &str) -> PathBuf {
    session_root(session_id).join("snapshots")
}

pub(super) fn snapshot_file(session_id: &str, snapshot_id: &str) -> PathBuf {
    snapshots_dir(session_id).join(format!("{}.json", snapshot_id))
}

pub(super) fn backup_file(session_id: &str, content_hash: &str) -> PathBuf {
    backups_dir(session_id).join(content_hash)
}

pub(super) fn ensure_dirs(session_id: &str) -> io::Result<()> {
    fs::create_dir_all(backups_dir(session_id))?;
    fs::create_dir_all(snapshots_dir(session_id))?;
    Ok(())
}

pub(super) fn hash_bytes(bytes: &[u8]) -> String {
    blake3::hash(bytes).to_hex().to_string()
}

pub(super) fn new_snapshot_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

pub(super) fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}

pub(super) fn write_snapshot(session_id: &str, snap: &FileSnapshot) -> io::Result<()> {
    ensure_dirs(session_id)?;
    let path = snapshot_file(session_id, &snap.snapshot_id);
    let json = serde_json::to_string_pretty(snap)
        .map_err(|err| io::Error::new(io::ErrorKind::InvalidData, err))?;
    fs::write(&path, json)
}

pub(super) fn read_snapshot(session_id: &str, snapshot_id: &str) -> io::Result<FileSnapshot> {
    let path = snapshot_file(session_id, snapshot_id);
    let bytes = fs::read(&path)?;
    serde_json::from_slice(&bytes).map_err(|err| io::Error::new(io::ErrorKind::InvalidData, err))
}

fn manifest_snapshots(session_id: &str) -> io::Result<BTreeMap<(String, String), String>> {
    let dir = snapshots_dir(session_id);
    if !dir.exists() {
        return Ok(BTreeMap::new());
    }

    let mut snapshots = BTreeMap::new();
    for entry in fs::read_dir(dir)? {
        let path = match entry {
            Ok(entry) => entry.path(),
            Err(err) => {
                tracing::warn!(
                    session_id,
                    error = %err,
                    "file_history snapshot directory entry unreadable; skipping"
                );
                continue;
            }
        };
        if path.extension().and_then(|ext| ext.to_str()) != Some("json") {
            continue;
        }
        let bytes = match fs::read(&path) {
            Ok(bytes) => bytes,
            Err(err) => {
                tracing::warn!(
                    manifest = %path.display(),
                    error = %err,
                    "file_history manifest unreadable while listing snapshots; skipping"
                );
                continue;
            }
        };
        let snapshot: FileSnapshot = match serde_json::from_slice(&bytes) {
            Ok(snapshot) => snapshot,
            Err(err) => {
                tracing::warn!(
                    manifest = %path.display(),
                    error = %err,
                    "file_history manifest JSON parse failed while listing snapshots; skipping"
                );
                continue;
            }
        };
        snapshots.insert(
            (snapshot.created_at.clone(), snapshot.snapshot_id.clone()),
            snapshot.snapshot_id,
        );
    }

    Ok(snapshots)
}

pub(super) fn list_snapshot_ids_at_or_after(
    session_id: &str,
    target_created_at: &str,
) -> io::Result<Vec<String>> {
    Ok(manifest_snapshots(session_id)?
        .into_iter()
        .filter_map(|((created_at, _), snapshot_id)| {
            (created_at.as_str() >= target_created_at).then_some(snapshot_id)
        })
        .collect())
}

pub(super) fn latest_snapshot_id_before(
    session_id: &str,
    target_created_at: &str,
) -> io::Result<Option<String>> {
    Ok(manifest_snapshots(session_id)?
        .into_iter()
        .take_while(|((created_at, _), _)| created_at.as_str() <= target_created_at)
        .last()
        .map(|(_, snapshot_id)| snapshot_id))
}

/// Read only the `created_at` field from a snapshot manifest without loading
/// all backup entries. Returns the ISO-8601 timestamp string.
pub fn read_snapshot_created_at(session_id: &str, snapshot_id: &str) -> io::Result<String> {
    let snap = read_snapshot(session_id, snapshot_id)?;
    Ok(snap.created_at)
}
