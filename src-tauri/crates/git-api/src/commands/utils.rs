/**
 * Git Utilities
 *
 * Shared helper functions used across git command modules.
 *
 * Delegates to the shared git_util module for command execution with
 * pre_exec FD safety. This module provides additional convenience wrappers.
 */
use std::path::Path;

// Re-export from shared git_util module
pub use git::util::{
    is_transient_error, operation_name_from_args, run_git, run_git_with_retry,
    run_git_with_retry_friendly, user_friendly_error, DEFAULT_RETRIES,
};

// `get_current_branch` lives in `git::branches` so the `git` core can call it
// without depending on `api::*`. Re-exported here for existing callers.
pub use git::branches::get_current_branch;

/// Get ahead/behind counts for a branch with retry logic
pub fn get_ahead_behind_counts(
    repo_path: &Path,
    branch: Option<&str>,
) -> Result<(u32, u32), String> {
    let branch_name = match branch {
        Some(b) => b.to_string(),
        None => get_current_branch(repo_path)?,
    };

    // Get upstream tracking branch
    let upstream_arg = format!("{}@{{upstream}}", branch_name);
    let upstream_output =
        run_git_with_retry(repo_path, &["rev-parse", "--abbrev-ref", &upstream_arg], 3)?;

    if !upstream_output.status.success() {
        return Ok((0, 0)); // No upstream set
    }

    let upstream = String::from_utf8_lossy(&upstream_output.stdout)
        .trim()
        .to_string();

    let rev_range = format!("{}...{}", branch_name, upstream);
    let output = run_git_with_retry(
        repo_path,
        &["rev-list", "--left-right", "--count", &rev_range],
        3,
    )?;

    if !output.status.success() {
        return Ok((0, 0));
    }

    let counts = String::from_utf8_lossy(&output.stdout);
    let parts: Vec<&str> = counts.trim().split('\t').collect();

    if parts.len() != 2 {
        return Ok((0, 0));
    }

    let ahead = parts[0].parse::<u32>().unwrap_or(0);
    let behind = parts[1].parse::<u32>().unwrap_or(0);

    Ok((ahead, behind))
}

/// Get list of conflicted files
pub fn get_conflicted_files(repo_path: &Path) -> Vec<String> {
    match run_git(repo_path, &["diff", "--name-only", "--diff-filter=U"]) {
        Ok(output) if output.status.success() => String::from_utf8_lossy(&output.stdout)
            .lines()
            .map(|s| s.to_string())
            .collect(),
        _ => vec![],
    }
}

/// Run a git command and return success/failure with message
/// Uses retry logic for transient errors.
pub fn run_git_command(repo_path: &Path, args: &[&str]) -> Result<String, String> {
    let output = run_git(repo_path, args)?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

/// File operations accept literal repository paths, never options or Git
/// pathspec expressions. A literal directory (including the explicit "."
/// bulk-operation sentinel) still selects its descendants.
pub fn literal_pathspec_args<'a>(command: &[&'a str], paths: &[&'a str]) -> Vec<&'a str> {
    let mut args = Vec::with_capacity(command.len() + paths.len() + 2);
    args.push("--literal-pathspecs");
    args.extend_from_slice(command);
    args.push("--");
    args.extend_from_slice(paths);
    args
}

pub fn run_git_path_operation(
    repo_path: &Path,
    command: &[&str],
    paths: &[&str],
) -> Result<(), String> {
    let output = run_git(repo_path, &literal_pathspec_args(command, paths))?;
    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}
