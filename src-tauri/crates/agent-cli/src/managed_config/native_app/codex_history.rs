//! Automatic local Codex history handoff. Configuration and authentication stay
//! in their original profiles. Native rollout bytes and frozen fork prefixes
//! are preserved; a native settings event binds continuation to the target.
mod files;
mod routing;
mod store;
#[cfg(test)]
mod tests;

use super::NativeAppProfile;
use files::{Stamp, WriterLock};
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    io::Read,
    path::{Path, PathBuf},
};
use store::ThreadRecord;

const MAX_LEDGER_BYTES: u64 = 16 * 1024 * 1024;
const MAX_ANCESTORS: usize = 64;
const BATCH: usize = 16;

#[derive(Default, Debug)]
pub struct Report {
    pub copied: usize,
    pub busy: usize,
    pub conflicts: usize,
    pub more: bool,
}
/// A conversation that cannot be shared is re-evaluated on every pass, but the
/// operator is told once per distinct reason, and again only after it healed.
fn attention_log() -> std::sync::MutexGuard<'static, BTreeMap<String, String>> {
    static LAST: std::sync::Mutex<BTreeMap<String, String>> =
        std::sync::Mutex::new(BTreeMap::new());
    LAST.lock().unwrap_or_else(|v| v.into_inner())
}
fn attention(id: &str, message: &'static str, reason: &str) {
    let mut last = attention_log();
    if last.len() > 10_000 {
        last.clear();
    }
    if last.get(id).is_some_and(|previous| previous == reason) {
        return;
    }
    last.insert(id.to_owned(), reason.to_owned());
    tracing::warn!(thread_id = %id, reason = %reason, "{message}");
}
fn healed(id: &str) {
    attention_log().remove(id);
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Version {
    path: PathBuf,
    file: Stamp,
    metadata: String,
}
fn version(home: &Path, row: &ThreadRecord) -> Result<Version, String> {
    Ok(Version {
        path: files::relative_rollout(home, &row.rollout_path)?,
        file: files::stamp(&row.rollout_path)?,
        metadata: row.metadata_hash.clone(),
    })
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Pair {
    primary: Version,
    package: Version,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct PendingFile {
    source: PathBuf,
    source_stamp: Stamp,
    destination: PathBuf,
    before: Option<Stamp>,
    staged: PathBuf,
    after: Stamp,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Dependency {
    relative: PathBuf,
    stamp: Stamp,
    rollout_id: String,
    cutoff: u64,
    ordinal: u64,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Pending {
    id: String,
    to_package: bool,
    source: Version,
    target: Option<Version>,
    files: Vec<PendingFile>,
    rollout_ids: Vec<String>,
    lock_ids: Vec<String>,
    snapshot: PathBuf,
    dependencies: Vec<Dependency>,
    route_config: Option<Stamp>,
    provider: String,
    model: String,
}
#[derive(Default, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Ledger {
    version: u8,
    pairs: BTreeMap<String, Pair>,
    pending: BTreeMap<String, Pending>,
}

fn read_ledger(path: &Path) -> Result<Ledger, String> {
    files::regular_path(path, true)?;
    if !path.exists() {
        return Ok(Ledger {
            version: 2,
            ..Default::default()
        });
    }
    let mut bytes = Vec::new();
    fs::File::open(path)
        .map_err(|_| "Cannot read Codex history journal")?
        .take(MAX_LEDGER_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "Cannot read Codex history journal")?;
    if bytes.len() as u64 > MAX_LEDGER_BYTES {
        return Err("Codex history journal exceeds limit".into());
    }
    let ledger: Ledger =
        serde_json::from_slice(&bytes).map_err(|_| "Invalid Codex history journal")?;
    if ledger.version != 2 || ledger.pairs.len() > 10_000 || ledger.pending.len() > 128 {
        return Err("Unsupported Codex history journal".into());
    }
    Ok(ledger)
}
fn save(path: &Path, ledger: &Ledger) -> Result<(), String> {
    files::regular_path(path, true)?;
    let bytes = serde_json::to_vec(ledger).map_err(|_| "Cannot encode Codex history journal")?;
    if bytes.len() as u64 > MAX_LEDGER_BYTES {
        return Err("Codex history journal exceeds limit".into());
    }
    super::super::file_io::write_sensitive_file_atomic(path, &bytes)?;
    files::sync_directory(path.parent().ok_or("Missing history journal directory")?)
}

fn config_stamp(home: &Path) -> Result<Option<Stamp>, String> {
    let path = home.join("config.toml");
    files::regular_path(&path, true)?;
    path.exists().then(|| files::stamp(&path)).transpose()
}

/// Read only the explicit native route. Default model resolution remains the
/// native app-server's responsibility, shared by bootstrap and reconciliation.
pub fn configured_route(home: &Path) -> Result<(Option<String>, String), String> {
    let path = home.join("config.toml");
    files::regular_path(&path, true)?;
    let mut text = String::new();
    if path.exists() {
        fs::File::open(path)
            .map_err(|_| "Cannot inspect Codex local route")?
            .take(4 * 1024 * 1024 + 1)
            .read_to_string(&mut text)
            .map_err(|_| "Cannot inspect Codex local route")?;
    }
    if text.len() > 4 * 1024 * 1024 {
        return Err("Codex local configuration exceeds limit".into());
    }
    let value: toml::Table =
        toml::from_str(&text).map_err(|_| "Invalid Codex local configuration")?;
    let token = |key: &str, limit: usize| -> Result<Option<String>, String> {
        value
            .get(key)
            .map(|value| {
                value
                    .as_str()
                    .filter(|v| {
                        !v.is_empty() && v.len() <= limit && !v.chars().any(char::is_control)
                    })
                    .map(str::to_owned)
                    .ok_or_else(|| "Invalid Codex local route".to_string())
            })
            .transpose()
    };
    Ok((
        token("model", 512)?,
        token("model_provider", 256)?.unwrap_or_else(|| "openai".into()),
    ))
}

fn route(home: &Path, resolved_model: &str) -> Result<(String, String), String> {
    let (model, provider) = configured_route(home)?;
    let model = model
        .or_else(|| (!resolved_model.is_empty()).then(|| resolved_model.to_owned()))
        .ok_or("Resolve the native Codex default model before sharing history")?;
    Ok((provider, model))
}

struct Segment {
    id: String,
    path: PathBuf,
    stable_id: String,
    cutoff: Option<u64>,
    cutoff_ordinal: Option<u64>,
}
fn lineage(home: &Path, row: &ThreadRecord) -> Result<Vec<Segment>, String> {
    let mut path = row.rollout_path.clone();
    let mut result = Vec::new();
    let mut seen = BTreeSet::new();
    let mut inventory = None;
    let mut cutoff = None;
    let mut cutoff_ordinal = None;
    loop {
        files::relative_rollout(home, &path)?;
        let id = path
            .file_stem()
            .and_then(|v| v.to_str())
            .and_then(|v| v.get(v.len().checked_sub(36)?..))
            .filter(|v| files::valid_id(v))
            .ok_or("Unsupported Codex rollout identity")?
            .to_owned();
        if !seen.insert(id.clone()) || result.len() == MAX_ANCESTORS {
            return Err("Codex history lineage cycles or exceeds limit".into());
        }
        let head = files::head(&path)?;
        let stable_id = head["payload"]["id"]
            .as_str()
            .ok_or("Missing Codex thread identity")?
            .to_owned();
        if result.is_empty() && stable_id != row.id {
            return Err("Codex rollout belongs to another thread".into());
        }
        if cutoff.is_some_and(|end| end > fs::metadata(&path).map(|v| v.len()).unwrap_or(0)) {
            return Err("Codex fork references an incomplete ancestor".into());
        }
        result.push(Segment {
            id,
            path,
            stable_id,
            cutoff,
            cutoff_ordinal,
        });
        let base = &head["payload"]["history_base"];
        if base.is_null() {
            break;
        }
        let id = base["thread_id"]
            .as_str()
            .filter(|v| files::valid_id(v))
            .ok_or("Invalid Codex fork ancestor")?;
        cutoff = Some(
            base["end_byte_offset"]
                .as_u64()
                .ok_or("Invalid Codex fork cutoff")?,
        );
        cutoff_ordinal = Some(
            base["end_ordinal_exclusive"]
                .as_u64()
                .ok_or("Invalid Codex fork ordinal")?,
        );
        if inventory.is_none() {
            inventory = Some(files::inventory(home)?);
        }
        path = inventory
            .as_ref()
            .and_then(|v| v.get(id))
            .ok_or("Codex fork ancestor is missing")?
            .clone();
    }
    result.reverse();
    Ok(result)
}

fn locks(homes: &[&Path], segments: &[Segment]) -> Result<Vec<WriterLock>, String> {
    let mut keys = BTreeSet::new();
    for home in homes {
        for segment in segments {
            keys.insert((home.to_path_buf(), segment.stable_id.clone()));
            keys.insert((home.to_path_buf(), segment.id.clone()));
        }
    }
    keys.into_iter()
        .map(|(home, id)| WriterLock::acquire(&home, &id))
        .collect()
}

fn same_prefix(source: &Path, target: &Path, count: u64) -> Result<bool, String> {
    use std::io::Read;
    let mut a = fs::File::open(source).map_err(|_| "Cannot inspect Codex history ancestor")?;
    let mut b = fs::File::open(target).map_err(|_| "Cannot inspect Codex history ancestor")?;
    let mut count = count;
    let mut left = [0_u8; 65536];
    let mut right = [0_u8; 65536];
    while count > 0 {
        let n = count.min(left.len() as u64) as usize;
        a.read_exact(&mut left[..n])
            .map_err(|_| "Incomplete Codex history ancestor")?;
        if b.read_exact(&mut right[..n]).is_err() || left[..n] != right[..n] {
            return Ok(false);
        }
        count -= n as u64;
    }
    Ok(true)
}

/// The caller supplies an authenticated owner fence and holds the existing
/// managed-profile lock. Missing native databases mean first launch has not
/// initialized its store yet; filesystem creation will request another pass.
pub fn reconcile(
    profile: &NativeAppProfile,
    ids: Option<&[String]>,
    check: impl Fn() -> Result<(), String>,
) -> Result<Report, String> {
    reconcile_with_models(profile, ids, ["", ""], check)
}

/// Defaults must be resolved by the installed native app-server, never inferred
/// from a different provider. Explicit local config still takes precedence.
pub fn reconcile_with_models(
    profile: &NativeAppProfile,
    ids: Option<&[String]>,
    native_defaults: [&str; 2],
    check: impl Fn() -> Result<(), String>,
) -> Result<Report, String> {
    reconcile_changes(profile, ids, native_defaults, None, check)
}

/// `changed_files = Some(ids)` is for reliable filesystem invalidations:
/// metadata-only events still inspect the catalog, but do not stat unchanged
/// known rollouts. Startup and watcher rescan must pass `None`.
pub fn reconcile_changes(
    profile: &NativeAppProfile,
    ids: Option<&[String]>,
    native_defaults: [&str; 2],
    changed_files: Option<&[String]>,
    check: impl Fn() -> Result<(), String>,
) -> Result<Report, String> {
    profile.validate("codex")?;
    let primary = app_paths::native_transcript_home_dir().join(".codex");
    reconcile_at_with_models(
        &primary,
        &profile.home(),
        &profile.root().join("codex-history/state.json"),
        ids,
        native_defaults,
        changed_files,
        check,
    )
}

#[cfg(test)]
fn reconcile_at(
    primary: &Path,
    package: &Path,
    journal: &Path,
    ids: Option<&[String]>,
    check: impl Fn() -> Result<(), String>,
) -> Result<Report, String> {
    reconcile_at_with_models(primary, package, journal, ids, ["", ""], None, check)
}

fn reconcile_at_with_models(
    primary: &Path,
    package: &Path,
    journal: &Path,
    ids: Option<&[String]>,
    native_defaults: [&str; 2],
    changed_files: Option<&[String]>,
    check: impl Fn() -> Result<(), String>,
) -> Result<Report, String> {
    check()?;
    for home in [primary, package] {
        files::regular_path(home, true)?;
        if !home.join("state_5.sqlite").is_file() || !home.join("thread_history_1.sqlite").is_file()
        {
            return Ok(Report::default());
        }
    }
    let parent = journal
        .parent()
        .ok_or("Missing Codex history journal directory")?;
    files::create_directories(parent)?;
    files::regular_path(parent, false)?;
    let lock_path = parent.join("sync.lock");
    files::regular_path(&lock_path, true)?;
    let lock = fs::OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(lock_path)
        .map_err(|_| "Cannot open Codex history coordinator")?;
    fs2::FileExt::try_lock_exclusive(&lock)
        .map_err(|_| "Codex history is already synchronizing")?;
    let mut ledger = read_ledger(journal)?;
    let mut report = Report::default();
    // Recover each thread independently. A target that diverged after a crash
    // retains its journal and originals without blocking unrelated history.
    for id in ledger.pending.keys().cloned().collect::<Vec<_>>() {
        check()?;
        let pending = ledger.pending.get(&id).unwrap();
        let target = if pending.to_package { package } else { primary };
        let recovery = pending
            .lock_ids
            .iter()
            .map(|id| WriterLock::acquire(target, id))
            .collect::<Result<Vec<_>, _>>()
            .and_then(|_locks| finish(primary, package, journal, &mut ledger, &id, &check));
        match recovery {
            Ok(()) => {
                healed(&id);
                report.copied += 1;
            }
            Err(error) if error == "busy" => report.busy += 1,
            Err(error) => {
                check()?;
                report.conflicts += 1;
                attention(&id, "Codex history recovery preserved pending data", &error);
            }
        }
    }
    let left = store::list_threads(primary, ids)?
        .into_iter()
        .map(|v| (v.id.clone(), v))
        .collect::<BTreeMap<_, _>>();
    let right = store::list_threads(package, ids)?
        .into_iter()
        .map(|v| (v.id.clone(), v))
        .collect::<BTreeMap<_, _>>();
    let ids = left
        .keys()
        .chain(right.keys())
        .cloned()
        .collect::<BTreeSet<_>>();
    let changed_files =
        changed_files.map(|ids| ids.iter().map(String::as_str).collect::<BTreeSet<_>>());
    // The primary profile is never probed with a native process. Until it
    // states a model, conversations returning to it wait for that route.
    let primary_route_pending =
        native_defaults[0].is_empty() && configured_route(primary)?.0.is_none();
    let mut dependencies = 0;
    // UUIDv7 recency ordering brings recent conversations into view first.
    for id in ids.into_iter().rev() {
        check()?;
        if ledger.pending.contains_key(&id) {
            continue;
        }
        if let Some(changed) = changed_files
            .as_ref()
            .filter(|changed| !changed.contains(id.as_str()))
        {
            if let (Some(base), Some(left), Some(right)) =
                (ledger.pairs.get(&id), left.get(&id), right.get(&id))
            {
                let raw_changed = |row: &ThreadRecord| {
                    row.rollout_path
                        .file_stem()
                        .and_then(|v| v.to_str())
                        .and_then(|v| v.get(v.len().checked_sub(36)?..))
                        .is_some_and(|raw| changed.contains(raw))
                };
                if !raw_changed(left)
                    && !raw_changed(right)
                    && left.metadata_hash == base.primary.metadata
                    && right.metadata_hash == base.package.metadata
                    && left.rollout_path == primary.join(&base.primary.path)
                    && right.rollout_path == package.join(&base.package.path)
                {
                    continue;
                }
            }
        }
        let l = left.get(&id).map(|v| version(primary, v)).transpose();
        let r = right.get(&id).map(|v| version(package, v)).transpose();
        let (Ok(l), Ok(r)) = (l, r) else {
            report.conflicts += 1;
            continue;
        };
        let direction = match (ledger.pairs.get(&id), &l, &r) {
            (None, Some(_), None) => Some(true),
            (None, None, Some(_)) => Some(false),
            (Some(base), Some(l), Some(r)) if l == &base.primary && r == &base.package => None,
            (Some(base), Some(l), Some(r)) if l != &base.primary && r == &base.package => {
                Some(true)
            }
            (Some(base), Some(l), Some(r)) if l == &base.primary && r != &base.package => {
                Some(false)
            }
            // Missing previously shared data is not permission to resurrect it,
            // and divergent edits are never reconciled by last-writer-wins.
            _ => {
                report.conflicts += 1;
                None
            }
        };
        let Some(to_package) = direction else {
            continue;
        };
        if !to_package && primary_route_pending {
            report.busy += 1;
            continue;
        }
        if report.copied >= BATCH {
            report.more = true;
            break;
        }
        if ledger.pending.len() >= 128 {
            report.conflicts += 1;
            continue;
        }
        let (source_home, target_home, source_row, target_row) = if to_package {
            (primary, package, left.get(&id).unwrap(), right.get(&id))
        } else {
            (package, primary, right.get(&id).unwrap(), left.get(&id))
        };
        match prepare_copy(
            source_home,
            target_home,
            source_row,
            target_row,
            to_package,
            native_defaults[usize::from(to_package)],
            journal,
            &check,
        ) {
            Ok((pending, _locks)) => {
                // Keep destination writer locks continuously through durable
                // publication. Loaded sources use a validated read snapshot.
                ledger.pending.insert(id.clone(), pending);
                save(journal, &ledger)?;
                match finish(primary, package, journal, &mut ledger, &id, &check) {
                    Ok(()) => {
                        healed(&id);
                        report.copied += 1;
                    }
                    Err(error) => {
                        check()?;
                        report.conflicts += 1;
                        attention(
                            &id,
                            "Codex history publication retained for recovery",
                            &error,
                        );
                    }
                }
            }
            Err(error) if error == "busy" => report.busy += 1,
            Err(error) if error == "dependency" => dependencies += 1,
            Err(error) => {
                check()?;
                report.conflicts += 1;
                attention(&id, "Codex history handoff needs attention", &error);
            }
        }
    }
    // Retry dependencies only after actual progress; a busy parent is woken by
    // its native writer-lock event, never by a periodic retry.
    report.more |= dependencies > 0 && report.copied > 0;
    Ok(report)
}

#[allow(clippy::too_many_arguments)]
fn prepare_copy(
    source_home: &Path,
    target_home: &Path,
    source: &ThreadRecord,
    target: Option<&ThreadRecord>,
    to_package: bool,
    native_default: &str,
    journal: &Path,
    check: &impl Fn() -> Result<(), String>,
) -> Result<(Pending, Vec<WriterLock>), String> {
    let before = version(source_home, source)?;
    let segments = lineage(source_home, source)?;
    for segment in &segments {
        if segment.stable_id != source.id
            && !store::list_threads(source_home, Some(std::slice::from_ref(&segment.stable_id)))?
                .is_empty()
            && store::list_threads(target_home, Some(std::slice::from_ref(&segment.stable_id)))?
                .is_empty()
        {
            return Err("dependency".into());
        }
    }
    // Never write a loaded destination. A loaded source is read-only here:
    // it can be snapshotted only at a complete native projection frontier.
    let mut native_locks = locks(&[target_home], &segments)?;
    let source_loaded = match locks(&[source_home], &segments) {
        Ok(locks) => {
            native_locks.extend(locks);
            false
        }
        Err(error) if error == "busy" => true,
        Err(error) => return Err(error),
    };
    check()?;
    if version(source_home, source)? != before {
        return Err(if source_loaded {
            "busy"
        } else {
            "Codex source changed before snapshot"
        }
        .into());
    }
    let route_config = config_stamp(target_home)?;
    let (provider, default_model) = route(target_home, native_default)?;
    let (model, permission, approval) = if let Some(target) = target {
        let settings = target.routing_settings()?;
        (
            if settings.1 == provider {
                settings.0.unwrap_or(default_model)
            } else {
                default_model
            },
            settings.2,
            settings.3,
        )
    } else {
        (
            default_model,
            routing::conservative_permission_profile(),
            routing::conservative_approval_policy(),
        )
    };
    let prepared = store::prepare(
        source_home,
        &source.id,
        &segments.iter().map(|s| s.id.clone()).collect::<Vec<_>>(),
    )?;
    if prepared.record().metadata_hash != source.metadata_hash {
        return Err(if source_loaded {
            "busy"
        } else {
            "Codex source metadata changed"
        }
        .into());
    }
    let captured_files = segments
        .iter()
        .map(|segment| files::stamp(&segment.path))
        .collect::<Result<Vec<_>, _>>()?;
    if source_loaded {
        if source.history_mode != "paginated" || !prepared.completed_rollouts()? {
            return Err("busy".into());
        }
        for (segment, stamp) in segments.iter().zip(&captured_files) {
            let projection = prepared
                .projections()
                .iter()
                .find(|p| p.rollout_id == segment.id)
                .ok_or("Missing source projection")?;
            let next = files::tail(&segment.path)?["ordinal"]
                .as_u64()
                .and_then(|v| v.checked_add(1));
            if projection
                .next_byte_offset
                .and_then(|v| u64::try_from(v).ok())
                != Some(stamp.len)
                || projection.next_ordinal.and_then(|v| u64::try_from(v).ok()) != next
                || next.is_none()
            {
                return Err("busy".into());
            }
        }
    }
    for projection in prepared.projections() {
        let segment = segments
            .iter()
            .find(|s| s.id == projection.rollout_id)
            .ok_or("Unknown Codex history projection")?;
        let size = files::stamp(&segment.path)?.len;
        if projection
            .next_byte_offset
            .is_some_and(|offset| offset < 0 || offset as u64 > size)
        {
            return Err("Codex history projection is ahead of its durable rollout".into());
        }
        if let Some(ordinal) = files::tail(&segment.path)?["ordinal"].as_u64() {
            if projection
                .next_ordinal
                .is_some_and(|next| next < 0 || next as u64 > ordinal.saturating_add(1))
            {
                return Err(
                    "Codex history projection ordinal is ahead of its durable rollout".into(),
                );
            }
        }
    }
    let mut staged = Vec::new();
    let mut dependencies = Vec::new();
    for segment in &segments {
        check()?;
        let relative = files::relative_rollout(source_home, &segment.path)?;
        let destination = target_home.join(relative);
        files::regular_path(&destination, true)?;
        let is_current = segment.path == source.rollout_path;
        if !is_current && destination.exists() {
            if !same_prefix(
                &segment.path,
                &destination,
                segment.cutoff.ok_or("Missing Codex ancestor cutoff")?,
            )? {
                return Err("Codex fork ancestor differs between profiles".into());
            }
            let checkpoints = store::checkpoints(target_home, std::slice::from_ref(&segment.id))?;
            if checkpoints.first().is_none_or(|p| {
                p.next_byte_offset.is_none_or(|offset| {
                    offset < 0 || (offset as u64) < segment.cutoff.unwrap_or(0)
                }) || p.next_ordinal.is_none_or(|ordinal| {
                    ordinal < 0 || (ordinal as u64) < segment.cutoff_ordinal.unwrap_or(0)
                })
            }) {
                return Err(
                    "Codex fork ancestor projection has not reached its immutable prefix".into(),
                );
            }
            dependencies.push(Dependency {
                relative: files::relative_rollout(target_home, &destination)?,
                stamp: files::stamp(&destination)?,
                rollout_id: segment.id.clone(),
                cutoff: segment.cutoff.ok_or("Missing ancestor cutoff")?,
                ordinal: segment.cutoff_ordinal.ok_or("Missing ancestor ordinal")?,
            });
            continue;
        }
        let before_stamp = destination
            .exists()
            .then(|| files::stamp(&destination))
            .transpose()?;
        if is_current && target.is_none() && before_stamp.is_some() {
            return Err("Unregistered Codex history already exists at destination".into());
        }
        let source_stamp = files::stamp(&segment.path)?;
        let temporary = files::stage_with_check(&segment.path, &destination, check)?;
        if is_current {
            let tail = files::tail(temporary.path())?;
            let ordinal = if source.history_mode == "paginated" {
                Some(
                    tail["ordinal"]
                        .as_u64()
                        .and_then(|v| v.checked_add(1))
                        .ok_or("Invalid Codex history ordinal")?,
                )
            } else {
                None
            };
            let event = routing::settings_event(
                &source.id,
                &model,
                &provider,
                &source.cwd,
                &permission,
                &approval,
                ordinal,
            )?;
            files::append(temporary.path(), &event)?;
        }
        if files::stamp(&segment.path)? != source_stamp {
            return Err(if source_loaded {
                "busy"
            } else {
                "Codex source changed while staging"
            }
            .into());
        }
        let after = files::stamp(temporary.path())?;
        staged.push((
            temporary,
            PendingFile {
                source: segment.path.clone(),
                source_stamp,
                destination,
                before: before_stamp,
                staged: PathBuf::new(),
                after,
            },
        ));
    }
    check()?;
    let snapshots = journal
        .parent()
        .ok_or("Missing history journal")?
        .join("snapshots");
    files::regular_path(&snapshots, true)?;
    files::create_directories(&snapshots)?;
    let snapshot_dir = tempfile::Builder::new()
        .prefix("handoff-")
        .tempdir_in(&snapshots)
        .map_err(|_| "Cannot create history snapshot directory")?;
    let snapshot = snapshot_dir.path().join("snapshot.sqlite");
    prepared.persist_snapshot(&snapshot, check)?;
    if source_loaded {
        // The source may have appended, reverted, renamed, or advanced its SQL
        // projection while copying. No artifact is published in that case.
        let fresh = store::prepare(
            source_home,
            &source.id,
            &segments.iter().map(|s| s.id.clone()).collect::<Vec<_>>(),
        )?;
        if fresh.record().metadata_hash != prepared.record().metadata_hash
            || fresh.record().rollout_path != prepared.record().rollout_path
            || fresh.projections() != prepared.projections()
            || !fresh.completed_rollouts()?
        {
            return Err("busy".into());
        }
        for (segment, stamp) in segments.iter().zip(&captured_files) {
            if files::stamp(&segment.path)? != *stamp {
                return Err("busy".into());
            }
        }
    }
    let mut files = Vec::new();
    for (temporary, mut entry) in staged {
        entry.staged = temporary
            .into_temp_path()
            .keep()
            .map_err(|_| "Cannot retain staged Codex history")?;
        files::sync_directory(
            entry
                .staged
                .parent()
                .ok_or("Missing staged history directory")?,
        )?;
        files.push(entry);
    }
    let _retained = snapshot_dir.keep();
    files::sync_directory(&snapshots)?;
    Ok((
        Pending {
            id: source.id.clone(),
            to_package,
            source: before,
            target: target.map(|r| version(target_home, r)).transpose()?,
            files,
            rollout_ids: segments.iter().map(|s| s.id.clone()).collect(),
            lock_ids: segments
                .iter()
                .flat_map(|s| [s.id.clone(), s.stable_id.clone()])
                .collect::<BTreeSet<_>>()
                .into_iter()
                .collect(),
            snapshot,
            dependencies,
            route_config,
            provider,
            model,
        },
        native_locks,
    ))
}

fn finish(
    primary: &Path,
    package: &Path,
    journal: &Path,
    ledger: &mut Ledger,
    id: &str,
    check: &impl Fn() -> Result<(), String>,
) -> Result<(), String> {
    let pending = ledger
        .pending
        .get(id)
        .ok_or("Missing Codex history operation")?
        .clone();
    let (source_home, target_home) = if pending.to_package {
        (primary, package)
    } else {
        (package, primary)
    };
    let snapshots = journal
        .parent()
        .ok_or("Missing history journal")?
        .join("snapshots");
    let valid_relative = |path: &Path| {
        path.is_relative()
            && matches!(path.components().next(), Some(std::path::Component::Normal(v)) if v == "sessions" || v == "archived_sessions")
            && path
                .components()
                .all(|v| matches!(v, std::path::Component::Normal(_)))
            && path.extension().is_some_and(|v| v == "jsonl")
    };
    if !valid_relative(&pending.source.path)
        || pending
            .target
            .as_ref()
            .is_some_and(|v| !valid_relative(&v.path))
        || pending.id != id
        || !files::valid_id(id)
        || pending.files.is_empty()
        || pending.files.len() > MAX_ANCESTORS
        || pending.rollout_ids.len() > MAX_ANCESTORS
        || pending.lock_ids.len() > MAX_ANCESTORS * 2
        || pending.dependencies.len() > MAX_ANCESTORS
        || !pending.lock_ids.iter().any(|v| v == id)
        || pending
            .snapshot
            .file_name()
            .is_none_or(|v| v != "snapshot.sqlite")
        || pending.snapshot.parent().and_then(Path::parent) != Some(snapshots.as_path())
        || !pending
            .snapshot
            .parent()
            .and_then(Path::file_name)
            .and_then(|v| v.to_str())
            .is_some_and(|v| v.starts_with("handoff-"))
    {
        return Err("Invalid Codex history recovery journal".into());
    }
    if config_stamp(target_home)? != pending.route_config {
        return Err("Codex destination route changed during pending handoff".into());
    }
    // An already-present ancestor was deliberately not overwritten. Recovery
    // must confirm it still exists and covers the child's frozen lineage.
    for dependency in &pending.dependencies {
        check()?;
        if !valid_relative(&dependency.relative)
            || !pending.rollout_ids.contains(&dependency.rollout_id)
            || !pending.lock_ids.contains(&dependency.rollout_id)
            || files::stamp(&target_home.join(&dependency.relative))? != dependency.stamp
        {
            return Err("Codex fork ancestor changed during pending handoff".into());
        }
        let checkpoints =
            store::checkpoints(target_home, std::slice::from_ref(&dependency.rollout_id))?;
        if checkpoints.first().is_none_or(|p| {
            p.next_byte_offset
                .is_none_or(|v| v < 0 || (v as u64) < dependency.cutoff)
                || p.next_ordinal
                    .is_none_or(|v| v < 0 || (v as u64) < dependency.ordinal)
        }) {
            return Err("Codex fork ancestor projection changed during pending handoff".into());
        }
    }
    let prepared = store::PreparedThread::from_snapshot(&pending.snapshot)?;
    let source = prepared.record();
    if source.id != id
        || source.metadata_hash != pending.source.metadata
        || source.rollout_path != source_home.join(&pending.source.path)
    {
        return Err("Codex history snapshot disagrees with its journal".into());
    }
    let existing = store::list_threads(target_home, Some(std::slice::from_ref(&pending.id)))?.pop();
    let expected = existing.as_ref().map(|v| v.metadata_hash.as_str());
    if expected != pending.target.as_ref().map(|v| v.metadata.as_str())
        && expected != Some(source.metadata_hash.as_str())
    {
        return Err("Codex destination metadata changed during pending handoff".into());
    }
    let destination = target_home.join(&pending.source.path);
    for entry in &pending.files {
        check()?;
        let relative = entry
            .source
            .strip_prefix(source_home)
            .map_err(|_| "Invalid Codex history source path")?;
        let rollout_id = entry
            .source
            .file_stem()
            .and_then(|v| v.to_str())
            .and_then(|v| v.get(v.len().checked_sub(36)?..))
            .ok_or("Invalid Codex history identity")?;
        if !matches!(relative.components().next(), Some(std::path::Component::Normal(v)) if v == "sessions" || v == "archived_sessions")
            || relative.extension().is_none_or(|v| v != "jsonl")
            || !pending.rollout_ids.iter().any(|v| v == rollout_id)
            || !pending.lock_ids.iter().any(|v| v == rollout_id)
            || entry.destination != target_home.join(relative)
            || entry.staged.parent() != entry.destination.parent()
            || !entry
                .staged
                .file_name()
                .and_then(|v| v.to_str())
                .is_some_and(|v| v.starts_with(".tmp"))
        {
            return Err("Invalid Codex history journal path".into());
        }
        files::regular_path(&entry.destination, true)?;
        let current = entry
            .destination
            .exists()
            .then(|| files::stamp(&entry.destination))
            .transpose()?;
        if current
            .as_ref()
            .is_some_and(|stamp| stamp.published_from(&entry.after))
        {
            continue;
        }
        if current != entry.before {
            return Err("Codex destination changed during pending handoff".into());
        }
        if files::stamp(&entry.staged)? != entry.after {
            return Err("Staged Codex history changed".into());
        }
        // Preserve the replaced destination for recovery, outside native discovery.
        if entry.destination.exists() {
            let backup = journal.parent().unwrap().join("backups").join(
                entry
                    .destination
                    .file_name()
                    .ok_or("Invalid Codex rollout")?,
            );
            files::publish(
                files::stage_with_check(&entry.destination, &backup, check)?,
                &backup,
            )?;
        }
        check()?;
        fs::rename(&entry.staged, &entry.destination)
            .map_err(|_| "Cannot publish Codex history")?;
        fs::File::open(entry.destination.parent().unwrap())
            .and_then(|v| v.sync_all())
            .map_err(|_| "Cannot flush Codex history")?;
    }
    check()?;
    let imported = pending
        .files
        .iter()
        .filter_map(|entry| entry.source.file_stem().and_then(|v| v.to_str()))
        .filter_map(|stem| stem.get(stem.len().checked_sub(36)?..))
        .map(str::to_owned)
        .collect::<Vec<_>>();
    if config_stamp(target_home)? != pending.route_config {
        return Err("Codex destination route changed before history publication".into());
    }
    let target = prepared.apply(
        target_home,
        &destination,
        &imported,
        &pending.provider,
        &pending.model,
        expected,
        check,
    )?;
    check()?;
    // Archive/revert moves the current pointer. Retain the old artifact as an
    // immutable ancestor when its rollout id differs; otherwise remove the
    // duplicate discovery path by moving it into the recovery backup directory.
    if let Some(old) = &pending.target {
        let old_path = target_home.join(&old.path);
        if old_path != destination
            && old_path.file_name() == destination.file_name()
            && old_path.exists()
        {
            files::relative_rollout(target_home, &old_path)?;
            if files::stamp(&old_path)? != old.file {
                return Err("Codex old rollout changed during archive".into());
            }
            check()?;
            let backup = journal
                .parent()
                .unwrap()
                .join("backups")
                .join(old_path.file_name().unwrap());
            files::regular_path(&backup, true)?;
            files::create_directories(backup.parent().unwrap())?;
            fs::rename(&old_path, &backup)
                .map_err(|_| "Cannot retain archived Codex history backup")?;
            files::sync_directory(old_path.parent().unwrap())?;
            files::sync_directory(backup.parent().unwrap())?;
        }
    }
    let source_version = pending.source.clone();
    let target_version = version(target_home, &target)?;
    let pair = if pending.to_package {
        Pair {
            primary: source_version,
            package: target_version,
        }
    } else {
        Pair {
            primary: target_version,
            package: source_version,
        }
    };
    check()?;
    ledger.pairs.insert(pending.id.clone(), pair);
    ledger.pending.remove(&pending.id);
    save(journal, ledger)?;
    // Cleanup only after the ledger no longer needs the immutable snapshot.
    let _ = fs::remove_file(&pending.snapshot);
    let _ = fs::remove_dir(pending.snapshot.parent().unwrap());
    Ok(())
}
