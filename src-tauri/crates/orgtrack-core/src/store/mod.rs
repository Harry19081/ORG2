use crate::canonical::{ActivityRecord, CommitLinkRecord, FileChangeRecord, ScanCheckpoint, SessionRecord};

pub trait RecordStore {
    fn upsert_session(&self, record: &SessionRecord) -> Result<(), String>;
    fn append_activity(&self, record: &ActivityRecord) -> Result<(), String>;
    fn upsert_file_change(&self, record: &FileChangeRecord) -> Result<(), String>;
    fn upsert_commit_link(&self, record: &CommitLinkRecord) -> Result<(), String>;
    fn list_commit_links(&self) -> Result<Vec<CommitLinkRecord>, String>;
    fn get_checkpoint(&self, source: &str) -> Result<Option<ScanCheckpoint>, String>;
    fn put_checkpoint(&self, checkpoint: &ScanCheckpoint) -> Result<(), String>;
    fn list_sessions(&self, workspace_path: Option<&str>) -> Result<Vec<SessionRecord>, String>;
    fn list_file_changes(&self, workspace_path: Option<&str>) -> Result<Vec<FileChangeRecord>, String>;
}

#[cfg(feature = "sqlite")]
pub mod sqlite;
