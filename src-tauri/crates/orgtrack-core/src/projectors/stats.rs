use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

use crate::canonical::{FileChangeRecord, SessionRecord};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CoreSessionSummary {
    pub session_id: String,
    pub title: String,
    pub source: String,
    pub workspace_path: Option<String>,
    pub files_changed: usize,
    pub related_commits: usize,
    pub committed_rate_percent: usize,
    pub model: Option<String>,
    pub key_source: Option<String>,
}

pub fn session_summaries(
    sessions: Vec<SessionRecord>,
    file_changes: Vec<FileChangeRecord>,
) -> Vec<CoreSessionSummary> {
    let mut files_by_session: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
    for change in file_changes {
        files_by_session
            .entry(change.session_id)
            .or_default()
            .insert(change.file_path);
    }

    sessions
        .into_iter()
        .map(|session| {
            let files_changed = files_by_session
                .get(&session.session_id)
                .map(BTreeSet::len)
                .unwrap_or(0);
            CoreSessionSummary {
                session_id: session.session_id,
                title: session.title,
                source: session.source,
                workspace_path: session.workspace_path,
                files_changed,
                related_commits: 0,
                committed_rate_percent: 0,
                model: session.metadata.model,
                key_source: session.metadata.key_source,
            }
        })
        .collect()
}
