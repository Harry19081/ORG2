use super::{result, state::*, types::*};
use std::{collections::BTreeMap, path::Path};

pub fn list_saved(path: &Path, cursor: Option<&str>) -> Result<SavedPage, String> {
    let repo = open(path)?;
    let dir = directory(&repo);
    if !dir.exists() {
        return Ok(SavedPage {
            snapshots: vec![],
            next_cursor: None,
        });
    }
    // Retain one page in memory even for a long-lived repository.
    let mut page = BTreeMap::new();
    for entry in std::fs::read_dir(dir).map_err(|e| e.to_string())? {
        let path = entry.map_err(|e| e.to_string())?.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let Some(id) = path.file_stem().and_then(|s| s.to_str()) else {
            continue;
        };
        if cursor.is_some_and(|cursor| id <= cursor) {
            continue;
        }
        page.insert(id.to_owned(), ());
        if page.len() > 51 {
            page.pop_last();
        }
    }
    let next_cursor = if page.len() > 50 {
        page.pop_last();
        page.last_key_value().map(|(k, _)| k.clone())
    } else {
        None
    };
    let snapshots = page
        .keys()
        .map(|id| load(&repo, id))
        .collect::<Result<Vec<_>, _>>()?;
    Ok(SavedPage {
        snapshots,
        next_cursor,
    })
}

pub fn restore(path: &Path, id: &str) -> Result<SwitchResult, String> {
    let repo = open(path)?;
    let _lock = lock(&repo)?;
    let mut s = load(&repo, id)?;
    let (files, _, block) = status(&repo)?;
    if let Some(block) = block {
        return Ok(result(&repo, Outcome::Blocked, block.message, Some(&s)));
    }
    if !files.is_empty() {
        return Ok(result(
            &repo,
            Outcome::Blocked,
            "Commit or save your current changes before restoring saved work".into(),
            Some(&s),
        ));
    }
    if branch(&repo) != s.source_branch
        || repo
            .workdir()
            .map(|p| p.to_string_lossy().into_owned())
            .as_deref()
            != Some(&s.worktree_path)
    {
        return Ok(result(
            &repo,
            Outcome::Blocked,
            format!(
                "Return to {} in its original worktree before restoring these changes",
                s.source_branch
            ),
            Some(&s),
        ));
    }
    if matches!(s.phase, SnapshotPhase::Restored | SnapshotPhase::Brought) {
        return Ok(result(
            &repo,
            Outcome::Blocked,
            "These changes were already applied. The recovery copy is retained for inspection"
                .into(),
            Some(&s),
        ));
    }
    let oid = s
        .oid
        .clone()
        .ok_or("No completed snapshot was found. Inspect the working tree before retrying")?;
    // Never replay a partially applied operation without inspecting/resolving it.
    if matches!(
        s.phase,
        SnapshotPhase::Applying | SnapshotPhase::Restoring | SnapshotPhase::NeedsResolution
    ) {
        return Ok(result(&repo, Outcome::RecoveryRequired, "This snapshot may have been partially applied. Inspect its diff and the Git history before manual recovery".into(), Some(&s)));
    }
    s.phase = SnapshotPhase::Restoring;
    save(&repo, &s)?;
    match git(path, &["stash", "apply", "--index", &oid]) {
        Ok(_) => {
            s.phase = SnapshotPhase::Restored;
            save(&repo, &s)?;
            Ok(result(
                &repo,
                Outcome::Switched,
                "Saved changes restored".into(),
                Some(&s),
            ))
        }
        Err(error) => {
            s.phase = SnapshotPhase::NeedsResolution;
            save(&repo, &s)?;
            Ok(result(
                &repo,
                Outcome::RecoveryRequired,
                format!("Some changes need resolution: {error}. The recovery copy is retained"),
                Some(&s),
            ))
        }
    }
}

/// Branch-local availability must consider every page, without retaining the journal.
pub fn has_saved(path: &Path, source_branch: &str) -> Result<bool, String> {
    let repo = open(path)?;
    let dir = directory(&repo);
    if !dir.exists() {
        return Ok(false);
    }
    for entry in std::fs::read_dir(dir).map_err(|e| e.to_string())? {
        let path = entry.map_err(|e| e.to_string())?.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let Some(id) = path.file_stem().and_then(|s| s.to_str()) else {
            continue;
        };
        let s = load(&repo, id)?;
        if s.source_branch == source_branch
            && !matches!(s.phase, SnapshotPhase::Brought | SnapshotPhase::Restored)
            && std::fs::canonicalize(&s.worktree_path).ok()
                == repo.workdir().and_then(|p| std::fs::canonicalize(p).ok())
        {
            return Ok(true);
        }
    }
    Ok(false)
}

pub fn preview(path: &Path, id: &str) -> Result<String, String> {
    let repo = open(path)?;
    let s = load(&repo, id)?;
    let oid = s.oid.ok_or("No completed snapshot was found")?;
    let commit = repo
        .find_commit(git2::Oid::from_str(&oid).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    let base = commit
        .parent(0)
        .and_then(|c| c.tree())
        .map_err(|e| e.to_string())?;
    let index = commit
        .parent(1)
        .and_then(|c| c.tree())
        .map_err(|e| e.to_string())?;
    let working = commit.tree().map_err(|e| e.to_string())?;
    let untracked = commit.parent(2).and_then(|c| c.tree()).ok();
    let mut text = String::new();
    const LIMIT: usize = 128 * 1024;
    for (label, old, new) in [
        ("Staged changes", Some(&base), Some(&index)),
        ("Unstaged changes", Some(&index), Some(&working)),
        ("New files", None, untracked.as_ref()),
    ] {
        if new.is_none() {
            continue;
        }
        text.push_str(&format!("\n{label}\n"));
        let mut options = git2::DiffOptions::new();
        options.max_size(1024 * 1024);
        let diff = repo
            .diff_tree_to_tree(old, new, Some(&mut options))
            .map_err(|e| e.to_string())?;
        let printed = diff.print(git2::DiffFormat::Patch, |_, _, line| {
            if text.len() + line.content().len() > LIMIT {
                return false;
            }
            if matches!(line.origin(), '+' | '-' | ' ') {
                text.push(line.origin());
            }
            text.push_str(&String::from_utf8_lossy(line.content()));
            true
        });
        if printed.is_err() {
            text.push_str(
                "\nPreview truncated; inspect the recovery commit with Git for the full diff\n",
            );
            break;
        }
    }
    text.push_str(&format!("\nRecovery commit: {oid}\nInspect tracked changes with: git diff {oid}^1 {oid}\nInspect new files with: git ls-tree -r {oid}^3"));
    Ok(text)
}
