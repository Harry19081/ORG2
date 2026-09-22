//! One-time native schema initialization and native default-model resolution.
//!
//! This never sends turn/start: a private disposable thread acquires one raw
//! user item through the supported injection API, then is permanently deleted.
//! Native Codex owns schema creation. Once the native thread ID is known,
//! a durable journal records it before injection so cleanup can recover from a
//! lost injection/deletion reply without deleting pre-existing conversations.

use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::time::Duration;

use agent_cli::managed_config::native_app::codex_history::configured_route;
use rusqlite::{Connection, OpenFlags, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::json;

use super::catalog::{request, with_rpc};
use super::CodexAppServerRpcClient;

const JOURNAL: &str = ".org2-history-bootstrap.json";
const WORK_PREFIX: &str = "org2-history-bootstrap-";
const OWNER_MARKER: &str = ".org2-bootstrap-owner";
const BOOTSTRAP_TEXT: &str = "ORG2 temporary native history store initialization";

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct ResolvedCodexHistoryRoute {
    pub model: String,
    pub provider: String,
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct OwnedThread {
    version: u8,
    id: String,
    cwd: PathBuf,
}

fn regular(path: &Path, missing: bool) -> Result<(), String> {
    if !path.is_absolute()
        || path
            .components()
            .any(|part| part == std::path::Component::ParentDir)
    {
        return Err("Invalid native Codex bootstrap path".into());
    }
    for ancestor in path.ancestors() {
        match fs::symlink_metadata(ancestor) {
            Ok(metadata) if metadata.file_type().is_symlink() => {
                return Err("Native Codex bootstrap paths must not be symbolic links".into())
            }
            Ok(_) => {}
            Err(error) if missing && error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(format!("Inspect native Codex bootstrap path: {error}")),
        }
    }
    Ok(())
}

fn read_bounded(path: &Path, limit: u64) -> Result<Vec<u8>, String> {
    regular(path, false)?;
    let mut bytes = Vec::new();
    File::open(path)
        .map_err(|error| error.to_string())?
        .take(limit + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| error.to_string())?;
    if bytes.len() as u64 > limit {
        return Err("Native Codex bootstrap input exceeds its size limit".into());
    }
    Ok(bytes)
}

fn route_token(value: Option<&str>) -> Result<String, String> {
    value
        .filter(|value| {
            !value.is_empty() && value.len() <= 256 && !value.chars().any(char::is_control)
        })
        .map(str::to_owned)
        .ok_or_else(|| "Native Codex returned an invalid model/provider".into())
}

fn sync_directory(path: &Path) -> Result<(), String> {
    File::open(path)
        .and_then(|directory| directory.sync_all())
        .map_err(|error| format!("Sync native Codex bootstrap directory: {error}"))
}

fn write_marker(owned: &OwnedThread) -> Result<(), String> {
    let mut marker = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(owned.cwd.join(OWNER_MARKER))
        .map_err(|error| error.to_string())?;
    marker
        .write_all(owned.id.as_bytes())
        .map_err(|error| error.to_string())?;
    marker.sync_all().map_err(|error| error.to_string())?;
    sync_directory(&owned.cwd)
}

fn write_owned(home: &Path, owned: &OwnedThread) -> Result<(), String> {
    let path = home.join(JOURNAL);
    regular(&path, true)?;
    let mut temporary = tempfile::NamedTempFile::new_in(home).map_err(|error| error.to_string())?;
    serde_json::to_writer(&mut temporary, owned).map_err(|error| error.to_string())?;
    temporary
        .as_file_mut()
        .flush()
        .map_err(|error| error.to_string())?;
    temporary
        .as_file()
        .sync_all()
        .map_err(|error| error.to_string())?;
    temporary
        .persist(&path)
        .map_err(|error| error.to_string())?;
    sync_directory(home)
}

fn validate_owned_structure(home: &Path, owned: &OwnedThread) -> Result<(), String> {
    if owned.version != 1
        || uuid::Uuid::parse_str(&owned.id).is_err()
        || owned.cwd.parent() != Some(home)
        || !owned
            .cwd
            .file_name()
            .and_then(|value| value.to_str())
            .is_some_and(|name| {
                name.starts_with(WORK_PREFIX)
                    && name.len() > WORK_PREFIX.len()
                    && name.len() <= 128
                    && name
                        .bytes()
                        .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
            })
    {
        return Err("Invalid native Codex bootstrap ownership journal".into());
    }
    regular(&owned.cwd, true)?;
    Ok(())
}

fn validate_marker(owned: &OwnedThread) -> Result<(), String> {
    if read_bounded(&owned.cwd.join(OWNER_MARKER), 64)? != owned.id.as_bytes() {
        return Err("Native Codex bootstrap owner marker changed".into());
    }
    Ok(())
}

/// Read only our recorded ID. Injected threads are intentionally hidden by
/// thread/list until their first real turn, so listing cannot prove absence.
fn stored_owned(home: &Path, owned: &OwnedThread) -> Result<bool, String> {
    let path = home.join("state_5.sqlite");
    regular(&path, true)?;
    if !path.exists() {
        return Ok(false);
    }
    let database = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|error| format!("Inspect native Codex bootstrap ownership: {error}"))?;
    database
        .busy_timeout(Duration::from_millis(200))
        .map_err(|error| error.to_string())?;
    let cwd: Option<String> = database
        .query_row(
            "SELECT cwd FROM threads WHERE id = ?1",
            [&owned.id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| format!("Inspect native Codex bootstrap thread: {error}"))?;
    match cwd {
        Some(cwd) if Path::new(&cwd) != owned.cwd => {
            Err("Native Codex bootstrap thread belongs to a different directory".into())
        }
        Some(_) => Ok(true),
        None => Ok(false),
    }
}

fn remove_owned_files(home: &Path, owned: &OwnedThread, live: bool) -> Result<(), String> {
    // Cleanup is restartable after any unlink. Never recursively delete, and
    // only permit an empty directory or our exact owner marker.
    if owned.cwd.exists() {
        let entries = fs::read_dir(&owned.cwd)
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;
        if entries.len() > 1
            || entries
                .first()
                .is_some_and(|entry| entry.file_name() != OWNER_MARKER)
        {
            return Err("Unexpected content in native Codex bootstrap directory".into());
        }
        if !entries.is_empty() {
            if live {
                regular(&owned.cwd.join(OWNER_MARKER), false)?;
            } else {
                validate_marker(owned)?;
            }
            fs::remove_file(owned.cwd.join(OWNER_MARKER)).map_err(|error| error.to_string())?;
            sync_directory(&owned.cwd)?;
        }
        fs::remove_dir(&owned.cwd).map_err(|error| error.to_string())?;
        sync_directory(home)?;
    }
    let journal = home.join(JOURNAL);
    if journal.exists() {
        fs::remove_file(journal).map_err(|error| error.to_string())?;
        sync_directory(home)?;
    }
    Ok(())
}

fn delete_owned(
    runtime: &tokio::runtime::Runtime,
    client: &mut CodexAppServerRpcClient,
    home: &Path,
    owned: &OwnedThread,
    live: bool,
) -> Result<(), String> {
    validate_owned_structure(home, owned)?;
    let stored = stored_owned(home, owned)?;
    if stored {
        // A freshly returned thread ID is owned by this call. Recovery also
        // requires the durable marker before touching a persisted thread.
        if !live {
            validate_marker(owned)?;
        }
        let result = request(
            runtime,
            client,
            "thread/read",
            json!({"threadId":owned.id,"includeTurns":false}),
        )?;
        if result["thread"]["id"].as_str() != Some(owned.id.as_str())
            || result["thread"]["cwd"].as_str().map(Path::new) != Some(owned.cwd.as_path())
        {
            return Err("Native Codex bootstrap thread identity changed".into());
        }
    }
    if stored || live {
        // thread/delete supports loaded threads; no unload/closing race is needed.
        request(
            runtime,
            client,
            "thread/delete",
            json!({"threadId":owned.id}),
        )?;
        if stored_owned(home, owned)? {
            return Err("Native Codex did not remove its bootstrap thread".into());
        }
    }
    remove_owned_files(home, owned, live)
}

/// Caller holds its profile/configuration barrier and supplies the active owner
/// fence. Call from a blocking worker, never from a Tokio async executor thread.
pub(crate) fn prepare_history_store(
    home: &Path,
    check: impl Fn() -> Result<(), String>,
) -> Result<ResolvedCodexHistoryRoute, String> {
    check()?;
    regular(home, false)?;
    let history = home.join("thread_history_1.sqlite");
    regular(&history, true)?;
    let configured = configured_route(home)?;
    let journal = home.join(JOURNAL);
    regular(&journal, true)?;
    if history.is_file() && !journal.exists() {
        if let Some(model) = &configured.0 {
            return Ok(ResolvedCodexHistoryRoute {
                model: model.clone(),
                provider: configured.1.clone(),
            });
        }
    }
    let lock_path = home.join(".org2-history-bootstrap.lock");
    regular(&lock_path, true)?;
    let lock = OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(lock_path)
        .map_err(|error| error.to_string())?;
    fs2::FileExt::try_lock_exclusive(&lock)
        .map_err(|_| "Native Codex history initialization is already in progress")?;
    check()?;
    // Existing journal recovery uses only the exact recorded ID and validates
    // its native cwd. It never enumerates or deletes unrelated native threads.
    with_rpc(home, home, |runtime, client| {
        if journal.exists() {
            let owned: OwnedThread = serde_json::from_slice(&read_bounded(&journal, 16 * 1024)?)
                .map_err(|_| "Invalid native Codex bootstrap journal")?;
            delete_owned(runtime, client, home, &owned, false)
                .map_err(|error| format!("Recover native Codex bootstrap {}: {error}", owned.id))?;
        }
        check()?;
        let missing_history = !history.is_file();
        if !missing_history {
            if let Some(model) = &configured.0 {
                return Ok(ResolvedCodexHistoryRoute {
                    model: model.clone(),
                    provider: configured.1.clone(),
                });
            }
        }
        let directory = tempfile::Builder::new()
            .prefix(WORK_PREFIX)
            .tempdir_in(home)
            .map_err(|error| error.to_string())?;
        let started = request(
            runtime,
            client,
            "thread/start",
            json!({
                "cwd":directory.path(),"historyMode":"paginated","ephemeral":false,
                "approvalPolicy":"on-request","sandbox":"read-only"
            }),
        )?;
        let id = started["thread"]["id"]
            .as_str()
            .filter(|id| uuid::Uuid::parse_str(id).is_ok())
            .ok_or("Native Codex bootstrap returned no valid owned thread ID")?
            .to_owned();
        let cwd = directory.keep();
        let owned = OwnedThread {
            version: 1,
            id,
            cwd,
        };
        let operation = (|| {
            write_marker(&owned)?;
            write_owned(home, &owned)?;
            let route = ResolvedCodexHistoryRoute {
                model: route_token(started["model"].as_str())?,
                provider: route_token(started["modelProvider"].as_str())?,
            };
            if route.provider != configured.1 {
                return Err("Native Codex resolved a different configured provider".into());
            }
            check()?;
            if missing_history {
                request(
                    runtime,
                    client,
                    "thread/inject_items",
                    json!({"threadId":owned.id,"items":[{
                        "type":"message","role":"user","content":[{"type":"input_text","text":BOOTSTRAP_TEXT}]
                    }]}),
                )?;
                regular(&history, false)?;
                if !history.is_file() {
                    return Err("Native Codex did not initialize its history database".into());
                }
            }
            check()?;
            Ok(route)
        })();
        let cleanup = delete_owned(runtime, client, home, &owned, true);
        match (operation, cleanup) {
            (Ok(route), Ok(())) => Ok(route),
            (Err(error), Ok(())) => Err(error),
            (result, Err(cleanup)) => Err(format!(
                "{}; cleanup of native Codex bootstrap {} failed: {cleanup}",
                result
                    .err()
                    .unwrap_or_else(|| "Native Codex bootstrap completed".into()),
                owned.id
            )),
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn existing_store_and_explicit_model_require_no_native_process() {
        let directory = tempfile::tempdir().unwrap();
        let home = directory.path().canonicalize().unwrap();
        fs::write(
            home.join("config.toml"),
            "model='gpt-6-astra'\nmodel_provider='orgii'\n",
        )
        .unwrap();
        fs::write(
            home.join("thread_history_1.sqlite"),
            b"checked by downstream schema adapter",
        )
        .unwrap();
        assert_eq!(
            prepare_history_store(&home, || Ok(())).unwrap(),
            ResolvedCodexHistoryRoute {
                model: "gpt-6-astra".into(),
                provider: "orgii".into()
            }
        );
        assert!(!home.join(JOURNAL).exists());
        assert!(!home.join(".org2-history-bootstrap.lock").exists());
    }

    #[test]
    fn stale_owner_and_malformed_configuration_fail_before_native_launch() {
        let directory = tempfile::tempdir().unwrap();
        let home = directory.path().canonicalize().unwrap();
        assert_eq!(
            prepare_history_store(&home, || Err("owner changed".into())).unwrap_err(),
            "owner changed"
        );
        fs::write(home.join("config.toml"), "model=123").unwrap();
        assert!(prepare_history_store(&home, || Ok(())).is_err());
        assert!(!home.join(".org2-history-bootstrap.lock").exists());
    }
    #[test]
    fn owned_cleanup_can_resume_after_marker_or_directory_was_removed() {
        for phase in 0..3 {
            let directory = tempfile::tempdir().unwrap();
            let home = directory.path().canonicalize().unwrap();
            let cwd = home.join("org2-history-bootstrap-recovery");
            let owned = OwnedThread {
                version: 1,
                id: uuid::Uuid::new_v4().to_string(),
                cwd: cwd.clone(),
            };
            if phase < 2 {
                fs::create_dir(&cwd).unwrap();
            }
            if phase == 0 {
                write_marker(&owned).unwrap();
            }
            write_owned(&home, &owned).unwrap();
            validate_owned_structure(&home, &owned).unwrap();
            remove_owned_files(&home, &owned, false).unwrap();
            assert!(!home.join(JOURNAL).exists());
            assert!(!cwd.exists());
        }
    }

    #[test]
    fn cleanup_retains_unexpected_content_and_journal() {
        let directory = tempfile::tempdir().unwrap();
        let home = directory.path().canonicalize().unwrap();
        let cwd = home.join("org2-history-bootstrap-unexpected");
        fs::create_dir(&cwd).unwrap();
        let owned = OwnedThread {
            version: 1,
            id: uuid::Uuid::new_v4().to_string(),
            cwd: cwd.clone(),
        };
        write_marker(&owned).unwrap();
        write_owned(&home, &owned).unwrap();
        fs::write(cwd.join("unrelated.txt"), "retain").unwrap();
        assert!(remove_owned_files(&home, &owned, false).is_err());
        assert!(home.join(JOURNAL).exists());
        assert_eq!(
            fs::read_to_string(cwd.join("unrelated.txt")).unwrap(),
            "retain"
        );
    }
}
