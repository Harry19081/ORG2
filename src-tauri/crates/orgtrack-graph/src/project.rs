use orgtrack_sync::{
    AiBlameEdgeRecord, GraphEdgeType, GraphNodeType, SyncRecord, SyncRecordPayload,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphNodeUpsert {
    pub node_type: GraphNodeType,
    pub stable_key: String,
    pub payload_json: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphEdgeUpsert {
    pub from_node_type: GraphNodeType,
    pub from_stable_key: String,
    pub to_node_type: GraphNodeType,
    pub to_stable_key: String,
    pub edge_type: GraphEdgeType,
    pub confidence: f32,
    pub payload_json: Value,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectedGraphRecord {
    pub nodes: Vec<GraphNodeUpsert>,
    pub edges: Vec<GraphEdgeUpsert>,
}

pub fn project_record_to_graph(
    record: &SyncRecord,
) -> Result<ProjectedGraphRecord, serde_json::Error> {
    match &record.payload {
        SyncRecordPayload::Project(project) => Ok(ProjectedGraphRecord {
            nodes: vec![node(
                GraphNodeType::Project,
                project.project_id.clone(),
                serde_json::to_value(project)?,
            )],
            edges: Vec::new(),
        }),
        SyncRecordPayload::WorkItem(work_item) => {
            let mut projected = ProjectedGraphRecord {
                nodes: vec![node(
                    GraphNodeType::WorkItem,
                    work_item.work_item_id.clone(),
                    serde_json::to_value(work_item)?,
                )],
                edges: Vec::new(),
            };
            if let Some(project_id) = &work_item.project_id {
                projected.nodes.push(node(
                    GraphNodeType::Project,
                    project_id.clone(),
                    json!({ "projectId": project_id }),
                ));
                projected.edges.push(edge(
                    GraphNodeType::Project,
                    project_id.clone(),
                    GraphNodeType::WorkItem,
                    work_item.work_item_id.clone(),
                    GraphEdgeType::Contains,
                    json!({ "sourceRecordId": record.record_id }),
                ));
            }
            for session_id in &work_item.linked_session_ids {
                projected.nodes.push(node(
                    GraphNodeType::Session,
                    session_id.clone(),
                    json!({ "sessionId": session_id }),
                ));
                projected.edges.push(edge(
                    GraphNodeType::WorkItem,
                    work_item.work_item_id.clone(),
                    GraphNodeType::Session,
                    session_id.clone(),
                    GraphEdgeType::LinksTo,
                    json!({ "sourceRecordId": record.record_id }),
                ));
            }
            for commit_sha in &work_item.linked_commit_shas {
                projected.nodes.push(node(
                    GraphNodeType::Commit,
                    commit_sha.clone(),
                    json!({ "commitSha": commit_sha }),
                ));
                projected.edges.push(edge(
                    GraphNodeType::WorkItem,
                    work_item.work_item_id.clone(),
                    GraphNodeType::Commit,
                    commit_sha.clone(),
                    GraphEdgeType::LinksTo,
                    json!({ "sourceRecordId": record.record_id }),
                ));
            }
            for pull_request_id in &work_item.linked_pull_requests {
                projected.nodes.push(node(
                    GraphNodeType::PullRequest,
                    pull_request_id.clone(),
                    json!({ "pullRequestId": pull_request_id }),
                ));
                projected.edges.push(edge(
                    GraphNodeType::WorkItem,
                    work_item.work_item_id.clone(),
                    GraphNodeType::PullRequest,
                    pull_request_id.clone(),
                    GraphEdgeType::LinksTo,
                    json!({ "sourceRecordId": record.record_id }),
                ));
            }
            Ok(projected)
        }
        SyncRecordPayload::SessionEvidence(session) => {
            let mut projected = ProjectedGraphRecord {
                nodes: vec![node(
                    GraphNodeType::Session,
                    session.session_id.clone(),
                    serde_json::to_value(session)?,
                )],
                edges: Vec::new(),
            };
            if let Some(work_item_id) = &session.work_item_id {
                projected.nodes.push(node(
                    GraphNodeType::WorkItem,
                    work_item_id.clone(),
                    json!({ "workItemId": work_item_id }),
                ));
                projected.edges.push(edge(
                    GraphNodeType::WorkItem,
                    work_item_id.clone(),
                    GraphNodeType::Session,
                    session.session_id.clone(),
                    GraphEdgeType::LinksTo,
                    json!({ "sourceRecordId": record.record_id }),
                ));
            }
            for commit_sha in &session.linked_commit_shas {
                projected.nodes.push(node(
                    GraphNodeType::Commit,
                    commit_sha.clone(),
                    json!({ "commitSha": commit_sha }),
                ));
                projected.edges.push(edge(
                    GraphNodeType::Session,
                    session.session_id.clone(),
                    GraphNodeType::Commit,
                    commit_sha.clone(),
                    GraphEdgeType::Produced,
                    json!({ "sourceRecordId": record.record_id }),
                ));
            }
            Ok(projected)
        }
        SyncRecordPayload::SessionTrajectory(trajectory) => Ok(ProjectedGraphRecord {
            nodes: vec![
                node(
                    GraphNodeType::SessionTrajectory,
                    trajectory.trajectory_id.clone(),
                    serde_json::to_value(trajectory)?,
                ),
                node(
                    GraphNodeType::Session,
                    trajectory.session_id.clone(),
                    json!({ "sessionId": trajectory.session_id }),
                ),
            ],
            edges: vec![edge(
                GraphNodeType::Session,
                trajectory.session_id.clone(),
                GraphNodeType::SessionTrajectory,
                trajectory.trajectory_id.clone(),
                GraphEdgeType::Contains,
                json!({ "sourceRecordId": record.record_id }),
            )],
        }),
        SyncRecordPayload::CommitNote(commit) => {
            let mut projected = ProjectedGraphRecord {
                nodes: vec![node(
                    GraphNodeType::Commit,
                    commit.commit_sha.clone(),
                    serde_json::to_value(commit)?,
                )],
                edges: Vec::new(),
            };
            for session_id in &commit.linked_session_ids {
                projected.nodes.push(node(
                    GraphNodeType::Session,
                    session_id.clone(),
                    json!({ "sessionId": session_id }),
                ));
                projected.edges.push(edge(
                    GraphNodeType::Session,
                    session_id.clone(),
                    GraphNodeType::Commit,
                    commit.commit_sha.clone(),
                    GraphEdgeType::Produced,
                    json!({ "sourceRecordId": record.record_id }),
                ));
            }
            for work_item_id in &commit.linked_work_item_ids {
                projected.nodes.push(node(
                    GraphNodeType::WorkItem,
                    work_item_id.clone(),
                    json!({ "workItemId": work_item_id }),
                ));
                projected.edges.push(edge(
                    GraphNodeType::WorkItem,
                    work_item_id.clone(),
                    GraphNodeType::Commit,
                    commit.commit_sha.clone(),
                    GraphEdgeType::LinksTo,
                    json!({ "sourceRecordId": record.record_id }),
                ));
            }
            for file_path in &commit.file_paths {
                projected.nodes.push(node(
                    GraphNodeType::File,
                    file_path.clone(),
                    json!({ "filePath": file_path }),
                ));
                projected.edges.push(edge(
                    GraphNodeType::Commit,
                    commit.commit_sha.clone(),
                    GraphNodeType::File,
                    file_path.clone(),
                    GraphEdgeType::Modified,
                    json!({ "sourceRecordId": record.record_id }),
                ));
            }
            Ok(projected)
        }
        SyncRecordPayload::FileNote(file_note) => {
            let mut projected = ProjectedGraphRecord {
                nodes: vec![node(
                    GraphNodeType::File,
                    file_note.file_path.clone(),
                    serde_json::to_value(file_note)?,
                )],
                edges: Vec::new(),
            };
            if let Some(commit_sha) = &file_note.commit_sha {
                projected.nodes.push(node(
                    GraphNodeType::Commit,
                    commit_sha.clone(),
                    json!({ "commitSha": commit_sha }),
                ));
                projected.edges.push(edge(
                    GraphNodeType::Commit,
                    commit_sha.clone(),
                    GraphNodeType::File,
                    file_note.file_path.clone(),
                    GraphEdgeType::Modified,
                    json!({ "sourceRecordId": record.record_id }),
                ));
            }
            Ok(projected)
        }
        SyncRecordPayload::PullRequest(pull_request) => {
            let mut projected = ProjectedGraphRecord {
                nodes: vec![node(
                    GraphNodeType::PullRequest,
                    pull_request.pull_request_id.clone(),
                    serde_json::to_value(pull_request)?,
                )],
                edges: Vec::new(),
            };
            for commit_sha in &pull_request.linked_commit_shas {
                projected.nodes.push(node(
                    GraphNodeType::Commit,
                    commit_sha.clone(),
                    json!({ "commitSha": commit_sha }),
                ));
                projected.edges.push(edge(
                    GraphNodeType::PullRequest,
                    pull_request.pull_request_id.clone(),
                    GraphNodeType::Commit,
                    commit_sha.clone(),
                    GraphEdgeType::Contains,
                    json!({ "sourceRecordId": record.record_id }),
                ));
            }
            Ok(projected)
        }
        SyncRecordPayload::Attempt(attempt) => Ok(ProjectedGraphRecord {
            nodes: vec![node(
                GraphNodeType::Attempt,
                attempt.attempt_id.clone(),
                serde_json::to_value(attempt)?,
            )],
            edges: Vec::new(),
        }),
        SyncRecordPayload::Lesson(lesson) => {
            let mut projected = ProjectedGraphRecord {
                nodes: vec![node(
                    GraphNodeType::Lesson,
                    lesson.lesson_id.clone(),
                    serde_json::to_value(lesson)?,
                )],
                edges: Vec::new(),
            };
            for attempt_id in &lesson.related_attempt_ids {
                projected.nodes.push(node(
                    GraphNodeType::Attempt,
                    attempt_id.clone(),
                    json!({ "attemptId": attempt_id }),
                ));
                projected.edges.push(edge(
                    GraphNodeType::Attempt,
                    attempt_id.clone(),
                    GraphNodeType::Lesson,
                    lesson.lesson_id.clone(),
                    GraphEdgeType::DerivedLesson,
                    json!({ "sourceRecordId": record.record_id }),
                ));
            }
            for file_path in &lesson.related_file_paths {
                projected.nodes.push(node(
                    GraphNodeType::File,
                    file_path.clone(),
                    json!({ "filePath": file_path }),
                ));
                projected.edges.push(edge(
                    GraphNodeType::Lesson,
                    lesson.lesson_id.clone(),
                    GraphNodeType::File,
                    file_path.clone(),
                    GraphEdgeType::Explains,
                    json!({ "sourceRecordId": record.record_id }),
                ));
            }
            Ok(projected)
        }
        SyncRecordPayload::Edge(edge_record) => Ok(project_edge_record(edge_record)),
        SyncRecordPayload::Validation(validation) => Ok(ProjectedGraphRecord {
            nodes: vec![
                node(
                    GraphNodeType::Validation,
                    validation.validation_id.clone(),
                    serde_json::to_value(validation)?,
                ),
                node(
                    GraphNodeType::SyncRecord,
                    validation.target_record_id.clone(),
                    json!({ "recordId": validation.target_record_id }),
                ),
            ],
            edges: vec![edge(
                GraphNodeType::Validation,
                validation.validation_id.clone(),
                GraphNodeType::SyncRecord,
                validation.target_record_id.clone(),
                GraphEdgeType::Validates,
                json!({ "sourceRecordId": record.record_id }),
            )],
        }),
    }
}

fn node(node_type: GraphNodeType, stable_key: String, payload_json: Value) -> GraphNodeUpsert {
    GraphNodeUpsert {
        node_type,
        stable_key,
        payload_json,
    }
}

fn edge(
    from_node_type: GraphNodeType,
    from_stable_key: String,
    to_node_type: GraphNodeType,
    to_stable_key: String,
    edge_type: GraphEdgeType,
    payload_json: Value,
) -> GraphEdgeUpsert {
    GraphEdgeUpsert {
        from_node_type,
        from_stable_key,
        to_node_type,
        to_stable_key,
        edge_type,
        confidence: 1.0,
        payload_json,
    }
}

fn project_edge_record(edge_record: &AiBlameEdgeRecord) -> ProjectedGraphRecord {
    ProjectedGraphRecord {
        nodes: vec![
            node(
                edge_record.from_node_type.clone(),
                edge_record.from_stable_key.clone(),
                json!({ "stableKey": edge_record.from_stable_key }),
            ),
            node(
                edge_record.to_node_type.clone(),
                edge_record.to_stable_key.clone(),
                json!({ "stableKey": edge_record.to_stable_key }),
            ),
        ],
        edges: vec![GraphEdgeUpsert {
            from_node_type: edge_record.from_node_type.clone(),
            from_stable_key: edge_record.from_stable_key.clone(),
            to_node_type: edge_record.to_node_type.clone(),
            to_stable_key: edge_record.to_stable_key.clone(),
            edge_type: edge_record.edge_type.clone(),
            confidence: edge_record.confidence,
            payload_json: edge_record.metadata.clone(),
        }],
    }
}
