use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;

use chrono::Utc;

use crate::canonical::FileChangeRecord;
use crate::privacy::ORGTRACK_SCHEMA_VERSION;
use crate::repo_sync::types::{
    OrgtrackAgentIdentity, OrgtrackIndex, OrgtrackIndexCommit, OrgtrackIndexFile,
    OrgtrackIndexSession, OrgtrackIndexSummary, OrgtrackReachabilityState, OrgtrackSummaryBucket,
};

pub fn build_orgtrack_index_from_file_changes(
    _repo_path: &Path,
    file_changes: Vec<FileChangeRecord>,
) -> Result<OrgtrackIndex, String> {
    let mut sessions: BTreeMap<String, SessionAccumulator> = BTreeMap::new();
    let mut files: BTreeMap<String, FileAccumulator> = BTreeMap::new();

    for change in file_changes {
        let session_row = sessions
            .entry(change.session_id.clone())
            .or_insert_with(|| SessionAccumulator {
                session_id: change.session_id.clone(),
                label: change.session_id.clone(),
                files: BTreeSet::new(),
                commits: BTreeSet::new(),
                first_edit_at: None,
                last_edit_at: None,
                agent_identity: change.metadata.clone().into(),
            });
        session_row.files.insert(change.file_path.clone());
        session_row.first_edit_at = Some(
            session_row
                .first_edit_at
                .map(|timestamp| timestamp.min(change.timestamp))
                .unwrap_or(change.timestamp),
        );
        session_row.last_edit_at = Some(
            session_row
                .last_edit_at
                .map(|timestamp| timestamp.max(change.timestamp))
                .unwrap_or(change.timestamp),
        );

        let file_row = files
            .entry(change.file_path.clone())
            .or_insert_with(|| FileAccumulator {
                path: change.file_path.clone(),
                path_hash: change.path_hash.clone(),
                sessions: BTreeSet::new(),
                commits: BTreeSet::new(),
                entries_count: 0,
            });
        file_row.sessions.insert(change.session_id);
        file_row.entries_count += 1;
    }

    let index_sessions: Vec<OrgtrackIndexSession> = sessions
        .values()
        .map(|session| {
            let files_count = session.files.len();
            let committed_files_count = 0;
            OrgtrackIndexSession {
                session_id: session.session_id.clone(),
                label: session.label.clone(),
                files_count,
                commits_count: session.commits.len(),
                committed_files_count,
                committed_rate_percent: committed_rate_percent(files_count, committed_files_count),
                first_edit_at: session.first_edit_at,
                last_edit_at: session.last_edit_at,
                agent_identity: session.agent_identity.clone(),
            }
        })
        .collect();

    let index_files: Vec<OrgtrackIndexFile> = files
        .values()
        .map(|file| OrgtrackIndexFile {
            path: file.path.clone(),
            path_hash: file.path_hash.clone(),
            sessions_count: file.sessions.len(),
            commits_count: file.commits.len(),
            entries_count: file.entries_count,
        })
        .collect();

    Ok(OrgtrackIndex {
        schema_version: ORGTRACK_SCHEMA_VERSION,
        generated_at: Utc::now().to_rfc3339(),
        exported_tier: crate::privacy::OrgtrackTier::Meta,
        derived_version: 1,
        summary: index_summary(&index_sessions, &index_files),
        sessions: index_sessions,
        files: index_files,
        commits: Vec::<OrgtrackIndexCommit>::new(),
    })
}

fn committed_rate_percent(files_count: usize, committed_files_count: usize) -> usize {
    if files_count == 0 {
        return 0;
    }
    ((committed_files_count as f64 / files_count as f64) * 100.0).round() as usize
}

fn index_summary(
    sessions: &[OrgtrackIndexSession],
    files: &[OrgtrackIndexFile],
) -> OrgtrackIndexSummary {
    let mut app_counts: BTreeMap<String, usize> = BTreeMap::new();
    let mut model_counts: BTreeMap<String, usize> = BTreeMap::new();
    for session in sessions {
        let app_type = session
            .agent_identity
            .dispatch_category
            .clone()
            .or_else(|| session.agent_identity.cli_agent_type.clone())
            .or_else(|| session.agent_identity.rust_agent_type.clone())
            .or_else(|| session.agent_identity.origin.clone())
            .unwrap_or_else(|| "unknown".to_string());
        *app_counts.entry(app_type).or_insert(0) += 1;
        if let Some(model) = &session.agent_identity.model {
            *model_counts.entry(model.clone()).or_insert(0) += 1;
        }
    }

    OrgtrackIndexSummary {
        sessions_by_app_type: bucketize(app_counts),
        models_used: bucketize(model_counts),
        total_sessions: sessions.len(),
        total_files: files.len(),
        total_commits: 0,
        total_entries: files.iter().map(|file| file.entries_count).sum(),
    }
}

fn bucketize(counts: BTreeMap<String, usize>) -> Vec<OrgtrackSummaryBucket> {
    counts
        .into_iter()
        .map(|(key, count)| OrgtrackSummaryBucket {
            label: key.clone(),
            key,
            count,
        })
        .collect()
}

struct SessionAccumulator {
    session_id: String,
    label: String,
    files: BTreeSet<String>,
    commits: BTreeSet<String>,
    first_edit_at: Option<i64>,
    last_edit_at: Option<i64>,
    agent_identity: OrgtrackAgentIdentity,
}

struct FileAccumulator {
    path: String,
    path_hash: String,
    sessions: BTreeSet<String>,
    commits: BTreeSet<String>,
    entries_count: usize,
}

pub fn empty_commit_index(commit_sha: String) -> OrgtrackIndexCommit {
    OrgtrackIndexCommit {
        commit_sha,
        files_count: 0,
        sessions_count: 0,
        reachability_state: OrgtrackReachabilityState::Unknown,
    }
}
