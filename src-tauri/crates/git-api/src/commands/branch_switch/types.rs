use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Strategy {
    Leave,
    Bring,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Outcome {
    Switched,
    SwitchedWithConflicts,
    Blocked,
    RecoveryRequired,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwitchTarget {
    pub branch: String,
    #[serde(default)]
    pub create: bool,
    pub start_point: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Blocked {
    pub code: String,
    pub message: String,
    pub worktree_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Preparation {
    pub current_branch: String,
    pub target_branch: String,
    pub fingerprint: String,
    pub changed_files: Vec<String>,
    pub default_strategy: Strategy,
    pub same_branch: bool,
    pub blocked: Option<Blocked>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecuteRequest {
    pub target: SwitchTarget,
    pub fingerprint: String,
    pub strategy: Strategy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwitchResult {
    pub outcome: Outcome,
    pub current_branch: String,
    pub message: String,
    pub snapshot_id: Option<String>,
    pub conflicts: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SnapshotPhase {
    Saving,
    Saved,
    Switching,
    Applying,
    Brought,
    Restoring,
    Restored,
    NeedsResolution,
}

/// An additive recovery journal; the Git stash remains usable by older apps/CLI.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snapshot {
    pub id: String,
    pub source_branch: String,
    pub source_head: String,
    pub worktree_path: String,
    pub target_branch: String,
    pub created_at: String,
    pub files: Vec<String>,
    pub oid: Option<String>,
    pub phase: SnapshotPhase,
}

#[derive(Debug, Serialize)]
pub struct SavedPage {
    pub snapshots: Vec<Snapshot>,
    pub next_cursor: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RestoreRequest {
    pub id: String,
}
