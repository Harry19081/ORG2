use crate::canonical::{ActivityKind, ActivityRecord};
use crate::privacy::{OrgtrackTier, ORGTRACK_SCHEMA_VERSION};

#[derive(Debug, Clone)]
pub struct ActivityRecordInput {
    pub record_id: String,
    pub source: String,
    pub source_event_id: Option<String>,
    pub session_id: Option<String>,
    pub timestamp: String,
    pub event_type: String,
    pub workspace_path: Option<String>,
    pub file_path: Option<String>,
    pub language: Option<String>,
    pub lines_added: i32,
    pub lines_removed: i32,
    pub metadata_json: Option<String>,
    pub tier: OrgtrackTier,
}

pub fn activity_record_from_input(input: ActivityRecordInput) -> ActivityRecord {
    ActivityRecord {
        schema_version: ORGTRACK_SCHEMA_VERSION,
        record_id: input.record_id,
        source: input.source,
        source_event_id: input.source_event_id,
        session_id: input.session_id,
        timestamp: input.timestamp,
        kind: activity_kind_from_event_type(&input.event_type),
        workspace_path: input.workspace_path,
        file_path: input.file_path,
        language: input.language,
        lines_added: input.lines_added,
        lines_removed: input.lines_removed,
        metadata_json: input.metadata_json,
        tier: input.tier,
    }
}

pub fn activity_kind_from_event_type(event_type: &str) -> ActivityKind {
    match event_type {
        "file_edit" => ActivityKind::FileEdit,
        "file_create" => ActivityKind::FileCreate,
        "file_delete" => ActivityKind::FileDelete,
        "terminal_command" => ActivityKind::TerminalCommand,
        "agent_action" => ActivityKind::AgentAction,
        "focus_gained" => ActivityKind::FocusGained,
        "focus_lost" => ActivityKind::FocusLost,
        _ => ActivityKind::Heartbeat,
    }
}
