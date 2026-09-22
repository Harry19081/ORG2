//! One authenticated owner, one filesystem subscription, no periodic scans.
use super::owner;
use crate::agent_sessions::cli::parsers::codex_app_server::prepare_history_store;
use agent_cli::managed_config::{
    self,
    native_app::{self, codex_history, NativeAppProfile},
};
use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use sha2::{Digest, Sha256};
use std::io::Read;
use std::{
    collections::BTreeSet,
    path::{Path, PathBuf},
    sync::{Arc, Mutex, OnceLock},
};
use tokio::sync::Notify;
use tokio_util::sync::CancellationToken;

const MAX_DIRTY: usize = 128;
#[derive(Default)]
struct Dirty {
    all: bool,
    metadata: bool,
    ids: BTreeSet<String>,
}
impl Dirty {
    fn all(&mut self) {
        self.all = true;
        self.ids.clear();
    }
    fn id(&mut self, id: String) {
        if !self.all {
            self.ids.insert(id);
            if self.ids.len() > MAX_DIRTY {
                self.all();
            }
        }
    }
    fn take(&mut self) -> Option<Taken> {
        if !self.all && !self.metadata && self.ids.is_empty() {
            return None;
        }
        let all = std::mem::take(&mut self.all);
        let revalidate = all || std::mem::take(&mut self.metadata);
        let ids = std::mem::take(&mut self.ids)
            .into_iter()
            .collect::<Vec<_>>();
        Some(Taken {
            // A reverted rollout has a new immutable ID but keeps its stable
            // thread ID. Resolve file IDs against the native catalog first.
            changed_files: (!all).then_some(ids),
            revalidate,
        })
    }
    fn restore(&mut self, taken: Taken) {
        match taken.changed_files {
            None => self.all(),
            Some(ids) => {
                self.metadata |= taken.revalidate;
                for id in ids {
                    self.id(id);
                }
            }
        }
    }
}
#[derive(Debug, PartialEq, Eq)]
struct Taken {
    changed_files: Option<Vec<String>>,
    /// Configuration or catalog metadata moved; re-check the managed state
    /// before touching history. Plain rollout appends never need that.
    revalidate: bool,
}
/// One native bootstrap attempt per package configuration state. A failure is
/// remembered until the configuration changes or is explicitly re-applied, so
/// native events cannot turn a failing bootstrap into a launch loop.
struct CachedModel {
    fingerprint: [u8; 32],
    model: Result<String, String>,
}
struct Service {
    lease: owner::Lease,
    dirty: Mutex<Dirty>,
    wake: Notify,
    cancel: CancellationToken,
    package_model: Mutex<Option<CachedModel>>,
}
struct Handle {
    service: Arc<Service>,
    task: tokio::task::JoinHandle<()>,
}
fn slot() -> &'static Mutex<Option<Handle>> {
    static VALUE: OnceLock<Mutex<Option<Handle>>> = OnceLock::new();
    VALUE.get_or_init(Default::default)
}

impl Service {
    fn check(&self) -> Result<(), String> {
        if self.cancel.is_cancelled() {
            Err("Codex history owner retired".into())
        } else {
            self.lease.check()
        }
    }
}

pub(super) fn ensure_started(lease: owner::Lease) {
    if lease.check().is_err() {
        return;
    }
    let mut current = slot().lock().unwrap_or_else(|v| v.into_inner());
    if lease.check().is_err() {
        return;
    }
    if let Some(handle) = current.as_ref() {
        if handle.service.lease.same_epoch(&lease) && !handle.task.is_finished() {
            // Auth refresh only changes the expiry wait. It is not a history invalidation.
            handle.service.wake.notify_one();
            return;
        }
        handle.service.cancel.cancel();
    }
    let service = Arc::new(Service {
        lease,
        dirty: Mutex::new(Dirty {
            all: true,
            ..Default::default()
        }),
        wake: Notify::new(),
        cancel: CancellationToken::new(),
        package_model: Mutex::new(None),
    });
    let task = tokio::spawn(run(service.clone()));
    *current = Some(Handle { service, task });
}
/// Configuration application is a real invalidation; auth refresh is not.
pub(super) fn configuration_applied() {
    let service = slot()
        .lock()
        .unwrap_or_else(|v| v.into_inner())
        .as_ref()
        .map(|v| v.service.clone());
    if let Some(service) = service.filter(|v| v.check().is_ok()) {
        *service
            .package_model
            .lock()
            .unwrap_or_else(|v| v.into_inner()) = None;
        service
            .dirty
            .lock()
            .unwrap_or_else(|v| v.into_inner())
            .all();
        service.wake.notify_one();
    }
}

pub(super) fn stop() {
    if let Some(handle) = slot().lock().unwrap_or_else(|v| v.into_inner()).take() {
        handle.service.cancel.cancel();
    }
}
pub(super) async fn before_open(lease: owner::Lease) -> Result<(), String> {
    if let Err(reason) = super::native_app_launch::verify_codex_history().await {
        lease.check()?;
        tracing::warn!(%reason, "Codex automatic history is unavailable for this native release");
        return Ok(());
    }
    ensure_started(lease.clone());
    let service = slot()
        .lock()
        .unwrap_or_else(|v| v.into_inner())
        .as_ref()
        .filter(|v| v.service.lease.same_epoch(&lease))
        .map(|v| v.service.clone())
        .ok_or("Codex history owner changed")?;
    // An explicit open is the one place a remembered bootstrap failure is retried.
    *service
        .package_model
        .lock()
        .unwrap_or_else(|v| v.into_inner()) = None;
    let result = match reconcile(service.clone(), None).await {
        Ok(report) => report,
        Err(reason) => {
            service.check()?;
            tracing::warn!(%reason, "Codex history preserved; native launch can continue");
            return Ok(());
        }
    };
    if result.more {
        service
            .dirty
            .lock()
            .unwrap_or_else(|v| v.into_inner())
            .all();
        service.wake.notify_one();
    }
    Ok(())
}
async fn reconcile(
    service: Arc<Service>,
    changed_files: Option<Vec<String>>,
) -> Result<codex_history::Report, String> {
    let _serial = super::history_serial().lock().await;
    service.check()?;
    let operation = service.lease.clone().operation().await?;
    tokio::task::spawn_blocking(move || {
        let _operation = operation;
        service.check()?;
        let profile = service
            .lease
            .native_app("codex")?
            .ok_or("Missing Codex profile")?;
        native_app::with_existing_profile(&profile, true, |check_profile| {
            let check = || {
                service.check()?;
                check_profile()
            };
            let primary = app_paths::native_transcript_home_dir().join(".codex");
            // Creating the user's first primary profile belongs to native Codex.
            // The parent watcher wakes this service when that profile appears.
            if !primary.is_dir() {
                return Ok(codex_history::Report::default());
            }
            // The user's own profile is never initialized or probed with a native
            // process. Without an explicit model there, conversations still flow
            // into the package and the return direction waits (see the engine).
            let primary_model = codex_history::configured_route(&primary)?
                .0
                .unwrap_or_default();
            let package_model = resolve_package_model(&service, &profile.home(), &check)?;
            codex_history::reconcile_changes(
                &profile,
                None,
                [&primary_model, &package_model],
                changed_files.as_deref(),
                check,
            )
        })
    })
    .await
    .map_err(|_| "Codex history worker stopped")?
}

fn config_fingerprint(home: &Path) -> Result<[u8; 32], String> {
    let path = home.join("config.toml");
    let metadata = match std::fs::symlink_metadata(&path) {
        Ok(value) if value.is_file() => Some(value),
        Ok(_) => return Err("Codex configuration is not a regular file".into()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
        Err(_) => return Err("Cannot inspect Codex configuration".into()),
    };
    let mut digest = Sha256::new();
    if metadata.is_some() {
        digest.update(b"present");
        let mut bytes = Vec::new();
        std::fs::File::open(&path)
            .map_err(|_| "Cannot inspect Codex configuration")?
            .take(4 * 1024 * 1024 + 1)
            .read_to_end(&mut bytes)
            .map_err(|_| "Cannot inspect Codex configuration")?;
        if bytes.len() > 4 * 1024 * 1024 {
            return Err("Codex configuration exceeds limit".into());
        }
        digest.update(bytes);
    } else {
        digest.update(b"absent");
    }
    Ok(digest.finalize().into())
}

fn resolve_package_model(
    service: &Service,
    home: &Path,
    check: &impl Fn() -> Result<(), String>,
) -> Result<String, String> {
    check()?;
    let fingerprint = config_fingerprint(home)?;
    let store_present =
        home.join("state_5.sqlite").is_file() && home.join("thread_history_1.sqlite").is_file();
    if let Some(cached) = &*service
        .package_model
        .lock()
        .unwrap_or_else(|v| v.into_inner())
    {
        // A removed store is re-initialized once; a remembered failure is not
        // retried by native events.
        if cached.fingerprint == fingerprint && (store_present || cached.model.is_err()) {
            return cached.model.clone();
        }
    }
    let model = prepare_history_store(home, check).map(|route| route.model);
    check()?;
    if config_fingerprint(home)? != fingerprint {
        return Err("Codex configuration changed during history initialization".into());
    }
    *service
        .package_model
        .lock()
        .unwrap_or_else(|v| v.into_inner()) = Some(CachedModel {
        fingerprint,
        model: model.clone(),
    });
    model
}

fn thread_id(path: &Path) -> Option<String> {
    let name = path.file_name()?.to_str()?;
    let stem = name
        .strip_suffix(".jsonl")
        .or_else(|| name.strip_suffix(".lock"))?;
    let id = stem.get(stem.len().checked_sub(36)?..)?;
    uuid::Uuid::parse_str(id).ok().map(|_| id.to_owned())
}
fn install(
    service: &Arc<Service>,
    profile: &NativeAppProfile,
) -> Result<(RecommendedWatcher, Vec<(PathBuf, RecursiveMode)>), String> {
    let homes = vec![
        app_paths::native_transcript_home_dir().join(".codex"),
        profile.home(),
    ];
    let manifest = app_paths::cli_config_profile_manifest("codex");
    let observed = homes.clone();
    let manifest_callback = manifest.clone();
    let weak = Arc::downgrade(service);
    let mut watcher = notify::recommended_watcher(move |event: notify::Result<notify::Event>| {
        let Some(service) = weak.upgrade().filter(|v| v.check().is_ok()) else {
            return;
        };
        let mut dirty = service.dirty.lock().unwrap_or_else(|v| v.into_inner());
        let mut changed = false;
        match event {
            Ok(event) if event.need_rescan() => {
                dirty.all();
                changed = true;
            }
            Ok(event) if !matches!(event.kind, notify::EventKind::Access(_)) => {
                for path in event.paths {
                    if path == manifest_callback {
                        dirty.all();
                        changed = true;
                        continue;
                    }
                    for home in &observed {
                        if path == *home {
                            dirty.all();
                            changed = true;
                            continue;
                        }
                        let Ok(relative) = path.strip_prefix(home) else {
                            continue;
                        };
                        let first = relative
                            .components()
                            .next()
                            .and_then(|v| v.as_os_str().to_str())
                            .unwrap_or("");
                        if matches!(
                            first,
                            "sessions" | "archived_sessions" | "thread-writer-locks"
                        ) {
                            if let Some(id) = thread_id(&path) {
                                dirty.id(id);
                                changed = true;
                            } else if path.is_dir() || path == home.join(first) {
                                dirty.all();
                                changed = true;
                            }
                        } else if matches!(
                            first,
                            "config.toml"
                                | "state_5.sqlite"
                                | "state_5.sqlite-wal"
                                | "thread_history_1.sqlite"
                                | "thread_history_1.sqlite-wal"
                        ) {
                            dirty.metadata = true;
                            changed = true;
                        }
                    }
                }
            }
            Err(_) => {
                dirty.all();
                changed = true;
            }
            _ => {}
        }
        drop(dirty);
        if changed {
            service.wake.notify_one();
        }
    })
    .map_err(|_| "Cannot observe Codex history")?;
    let roots = watch_roots(profile);
    for (path, mode) in &roots {
        watcher
            .watch(path, *mode)
            .map_err(|_| "Cannot subscribe to Codex history")?;
    }
    Ok((watcher, roots))
}

fn watch_roots(profile: &NativeAppProfile) -> Vec<(PathBuf, RecursiveMode)> {
    let homes = [
        app_paths::native_transcript_home_dir().join(".codex"),
        profile.home(),
    ];
    let manifest = app_paths::cli_config_profile_manifest("codex");
    let mut roots = Vec::new();
    for home in homes {
        if home.is_dir() {
            roots.push((home.clone(), RecursiveMode::NonRecursive));
            for child in ["sessions", "archived_sessions", "thread-writer-locks"] {
                let path = home.join(child);
                if path.is_dir() {
                    roots.push((path, RecursiveMode::Recursive));
                }
            }
        } else if let Some(parent) = home.parent().filter(|v| v.is_dir()) {
            roots.push((parent.to_path_buf(), RecursiveMode::NonRecursive));
        }
    }
    if let Some(parent) = manifest.parent().filter(|v| v.is_dir()) {
        roots.push((parent.to_path_buf(), RecursiveMode::NonRecursive));
    }
    roots
}

fn transient(error: &str) -> bool {
    error.ends_with("busy") || error.ends_with("already synchronizing")
}

async fn run(service: Arc<Service>) {
    let result = async {
        super::native_app_launch::verify_codex_history().await?;
        let profile = service.lease.native_app("codex")?.ok_or("Missing Codex history profile")?;
        // The user's native home is observed only while this profile is the
        // managed Market connection. Restore/reconfigure can happen within one
        // Cloud owner epoch: an unmanaged profile drops its subscription and
        // waits for the explicit configuration wake instead of native events.
        let mut watcher: Option<(RecommendedWatcher, Vec<(PathBuf, RecursiveMode)>)> = None;
        let mut managed = false;
        let mut conflicts = 0;
        loop {
            service.check()?;
            let taken = service.dirty.lock().unwrap_or_else(|v| v.into_inner()).take();
            if let Some(taken) = taken {
                if taken.revalidate || !managed {
                    let status = managed_config::cli_config_get_status("codex".into()).await;
                    service.check()?;
                    managed = match status.and_then(|status| profile.validate_launch(&status)) {
                        Ok(()) => true,
                        Err(reason) => {
                            tracing::debug!(%reason, "Codex automatic history is idle until the connection is configured");
                            false
                        }
                    };
                }
                if !managed {
                    watcher = None;
                } else {
                    let resubscribed = watcher.is_none();
                    if resubscribed {
                        watcher = Some(install(&service, &profile)?);
                    }
                    // Events before a subscription are unknown: rescan.
                    let changed_files = if resubscribed { None } else { taken.changed_files.clone() };
                    match reconcile(service.clone(), changed_files).await {
                        Ok(report) => {
                            if report.conflicts != conflicts {
                                conflicts = report.conflicts;
                                tracing::warn!(conflicts, "Codex history has preserved divergent or unavailable conversations");
                            }
                            if report.more {
                                service.dirty.lock().unwrap_or_else(|v| v.into_inner()).all();
                            }
                        }
                        Err(error) if transient(&error) => {
                            service.dirty.lock().unwrap_or_else(|v| v.into_inner()).restore(taken);
                        }
                        Err(error) => tracing::warn!(reason = %error, "Codex automatic history handoff paused until its next invalidation"),
                    }
                    // Register newly created native directories. Comparing the root
                    // set avoids replacing subscriptions for every token append.
                    if watcher.as_ref().is_some_and(|w| watch_roots(&profile) != w.1) {
                        watcher = Some(install(&service, &profile)?);
                    }
                }
            }
            let remaining = service.lease.remaining().ok_or("Codex history owner expired")?;
            let pending = {
                let dirty = service.dirty.lock().unwrap_or_else(|v| v.into_inner());
                dirty.all || (managed && (dirty.metadata || !dirty.ids.is_empty()))
            };
            if !pending {
                tokio::select! {
                    _ = service.cancel.cancelled() => break,
                    _ = service.wake.notified() => {},
                    _ = tokio::time::sleep(remaining) => { continue; },
                }
            }
            // Event coalescing only. There is no wake or scan on an idle timer.
            tokio::select! {
                _ = service.cancel.cancelled() => break,
                _ = tokio::time::sleep(std::time::Duration::from_millis(750)) => {}
            }
        }
        Ok::<(), String>(())
    }
    .await;
    if let Err(error) = result {
        tracing::debug!(reason = %error, "Codex automatic history observer stopped");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn dirty_queue_is_bounded_and_refresh_has_no_work() {
        let mut dirty = Dirty::default();
        assert!(dirty.take().is_none());
        for id in 0..200 {
            dirty.id(id.to_string());
        }
        assert!(dirty.all);
        assert!(dirty.ids.is_empty());
        assert_eq!(
            dirty.take(),
            Some(Taken {
                changed_files: None,
                revalidate: true
            })
        );
        assert!(dirty.take().is_none());
    }
    #[test]
    fn only_native_rollout_and_writer_identities_are_accepted() {
        let id = "11111111-1111-7111-8111-111111111111";
        assert_eq!(
            thread_id(Path::new(&format!("rollout-date-{id}.jsonl"))).as_deref(),
            Some(id)
        );
        assert_eq!(
            thread_id(Path::new(&format!("{id}.lock"))).as_deref(),
            Some(id)
        );
        assert!(thread_id(Path::new(".coordination.lock")).is_none());
    }
    #[test]
    fn metadata_invalidation_is_not_lost_behind_an_unrelated_rollout_event() {
        let mut dirty = Dirty {
            metadata: true,
            ..Default::default()
        };
        dirty.id("thread-a".into());
        assert_eq!(
            dirty.take(),
            Some(Taken {
                changed_files: Some(vec!["thread-a".into()]),
                revalidate: true
            })
        );
    }
    #[test]
    fn rollout_events_do_not_revalidate_and_transient_failures_restore_them() {
        let mut dirty = Dirty::default();
        dirty.id("thread-a".into());
        let taken = dirty.take().unwrap();
        assert_eq!(
            taken,
            Taken {
                changed_files: Some(vec!["thread-a".into()]),
                revalidate: false
            }
        );
        assert!(dirty.take().is_none());
        dirty.restore(taken);
        assert_eq!(
            dirty.take(),
            Some(Taken {
                changed_files: Some(vec!["thread-a".into()]),
                revalidate: false
            })
        );
        assert!(transient("Native App configuration is busy"));
        assert!(transient("Codex history is already synchronizing"));
        assert!(!transient("Codex history owner retired"));
    }
}
