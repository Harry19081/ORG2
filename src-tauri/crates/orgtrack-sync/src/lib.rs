pub mod approval;
pub mod canonical_json;
pub mod ids;
pub mod layout;
pub mod records;
pub mod redaction;

pub use approval::{ApprovalState, TrustLevel};
pub use ids::{content_record_id, EntityId, RecordId};
pub use layout::{MetadataBranchLayout, DEFAULT_METADATA_BRANCH, SCHEMA_VERSION};
pub use records::{
    AiBlameEdgeRecord, AttemptRecord, CommitNoteRecord, FileNoteRecord, GraphEdgeType,
    GraphNodeType, LessonRecord, ProjectRecord, PullRequestRecord, SessionEvidenceRecord,
    SessionTrajectoryRecord, SyncRecord, SyncRecordPayload, ValidationRecord, WorkItemRecord,
};
pub use redaction::{redact_secrets, RedactionReport};
