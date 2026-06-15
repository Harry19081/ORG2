use std::path::Path;

use chrono::Utc;
use orgtrack_sync::{
    canonical_json::canonical_json, content_record_id, GraphEdgeType, GraphNodeType, SyncRecord,
};
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use serde_json::Value;

use crate::project::{project_record_to_graph, GraphEdgeUpsert, GraphNodeUpsert};
use crate::query::{GraphDirection, GraphNeighbor};
use crate::schema::initialize_schema;

pub struct GraphStore {
    connection: Connection,
}

impl GraphStore {
    pub fn open(path: impl AsRef<Path>) -> Result<Self, String> {
        let connection =
            Connection::open(path).map_err(|err| format!("open orgtrack graph: {err}"))?;
        initialize_schema(&connection)
            .map_err(|err| format!("initialize orgtrack graph: {err}"))?;
        Ok(Self { connection })
    }

    pub fn open_memory() -> Result<Self, String> {
        let connection =
            Connection::open_in_memory().map_err(|err| format!("open orgtrack graph: {err}"))?;
        initialize_schema(&connection)
            .map_err(|err| format!("initialize orgtrack graph: {err}"))?;
        Ok(Self { connection })
    }

    pub fn import_record(&self, record: &SyncRecord) -> Result<(), String> {
        let imported_at = Utc::now().to_rfc3339();
        let payload_json =
            canonical_json(record).map_err(|err| format!("serialize sync record: {err}"))?;
        let approval_state = enum_label(&record.approval_state)?;
        let trust_level = enum_label(&record.trust_level)?;
        self.connection
            .execute(
                "INSERT INTO orgtrack_sync_records (
                    record_id, schema, entity_id, approval_state, trust_level, source_ref,
                    payload_json, imported_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
                 ON CONFLICT(record_id) DO UPDATE SET
                    schema = excluded.schema,
                    entity_id = excluded.entity_id,
                    approval_state = excluded.approval_state,
                    trust_level = excluded.trust_level,
                    source_ref = excluded.source_ref,
                    payload_json = excluded.payload_json,
                    imported_at = excluded.imported_at",
                params![
                    record.record_id,
                    record.schema,
                    record.entity_id,
                    approval_state,
                    trust_level,
                    record.source_ref,
                    payload_json,
                    imported_at,
                ],
            )
            .map_err(|err| format!("upsert sync record: {err}"))?;

        let projected =
            project_record_to_graph(record).map_err(|err| format!("project sync record: {err}"))?;
        for graph_node in projected.nodes {
            self.upsert_node(&graph_node)?;
        }
        for graph_edge in projected.edges {
            self.upsert_edge(&graph_edge)?;
        }
        Ok(())
    }

    pub fn upsert_node(&self, node: &GraphNodeUpsert) -> Result<String, String> {
        let node_id = node_id(&node.node_type, &node.stable_key)?;
        let updated_at = Utc::now().to_rfc3339();
        let node_type = enum_label(&node.node_type)?;
        let payload_json = canonical_json(&node.payload_json)
            .map_err(|err| format!("serialize graph node payload: {err}"))?;
        self.connection
            .execute(
                "INSERT INTO orgtrack_graph_nodes (
                    node_id, node_type, stable_key, payload_json, updated_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT(node_type, stable_key) DO UPDATE SET
                    payload_json = excluded.payload_json,
                    updated_at = excluded.updated_at",
                params![
                    node_id,
                    node_type,
                    node.stable_key,
                    payload_json,
                    updated_at
                ],
            )
            .map_err(|err| format!("upsert graph node: {err}"))?;
        Ok(node_id)
    }

    pub fn upsert_edge(&self, edge: &GraphEdgeUpsert) -> Result<String, String> {
        let from_node_id = node_id(&edge.from_node_type, &edge.from_stable_key)?;
        let to_node_id = node_id(&edge.to_node_type, &edge.to_stable_key)?;
        let edge_id = edge_id(
            &from_node_id,
            &to_node_id,
            &edge.edge_type,
            &edge.payload_json,
        )?;
        let updated_at = Utc::now().to_rfc3339();
        let edge_type = enum_label(&edge.edge_type)?;
        let payload_json = canonical_json(&edge.payload_json)
            .map_err(|err| format!("serialize graph edge payload: {err}"))?;
        self.connection
            .execute(
                "INSERT INTO orgtrack_graph_edges (
                    edge_id, from_node_id, to_node_id, edge_type, confidence, payload_json, updated_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                 ON CONFLICT(from_node_id, to_node_id, edge_type) DO UPDATE SET
                    confidence = excluded.confidence,
                    payload_json = excluded.payload_json,
                    updated_at = excluded.updated_at",
                params![
                    edge_id,
                    from_node_id,
                    to_node_id,
                    edge_type,
                    edge.confidence as f64,
                    payload_json,
                    updated_at,
                ],
            )
            .map_err(|err| format!("upsert graph edge: {err}"))?;
        Ok(edge_id)
    }

    pub fn neighbors(
        &self,
        node_type: GraphNodeType,
        stable_key: &str,
        direction: GraphDirection,
        edge_type: Option<GraphEdgeType>,
    ) -> Result<Vec<GraphNeighbor>, String> {
        let current_node_id = node_id(&node_type, stable_key)?;
        match direction {
            GraphDirection::Outgoing => self.neighbors_outgoing(&current_node_id, edge_type),
            GraphDirection::Incoming => self.neighbors_incoming(&current_node_id, edge_type),
            GraphDirection::Both => {
                let mut neighbors = self.neighbors_outgoing(&current_node_id, edge_type.clone())?;
                neighbors.extend(self.neighbors_incoming(&current_node_id, edge_type)?);
                Ok(neighbors)
            }
        }
    }

    pub fn record_count(&self) -> Result<usize, String> {
        self.connection
            .query_row("SELECT COUNT(*) FROM orgtrack_sync_records", [], |row| {
                row.get::<_, i64>(0)
            })
            .map(|count| count as usize)
            .map_err(|err| format!("count sync records: {err}"))
    }

    fn neighbors_outgoing(
        &self,
        current_node_id: &str,
        edge_type: Option<GraphEdgeType>,
    ) -> Result<Vec<GraphNeighbor>, String> {
        let edge_type_label = edge_type.as_ref().map(enum_label).transpose()?;
        self.query_neighbors(
            "e.from_node_id = ?1 AND (?2 IS NULL OR e.edge_type = ?2)",
            current_node_id,
            edge_type_label.as_deref(),
            "e.to_node_id",
        )
    }

    fn neighbors_incoming(
        &self,
        current_node_id: &str,
        edge_type: Option<GraphEdgeType>,
    ) -> Result<Vec<GraphNeighbor>, String> {
        let edge_type_label = edge_type.as_ref().map(enum_label).transpose()?;
        self.query_neighbors(
            "e.to_node_id = ?1 AND (?2 IS NULL OR e.edge_type = ?2)",
            current_node_id,
            edge_type_label.as_deref(),
            "e.from_node_id",
        )
    }

    fn query_neighbors(
        &self,
        predicate: &str,
        current_node_id: &str,
        edge_type: Option<&str>,
        neighbor_column: &str,
    ) -> Result<Vec<GraphNeighbor>, String> {
        let sql = format!(
            "SELECT
                n.node_id, n.node_type, n.stable_key, n.payload_json,
                e.edge_id, e.edge_type, e.confidence, e.payload_json
             FROM orgtrack_graph_edges e
             JOIN orgtrack_graph_nodes n ON n.node_id = {neighbor_column}
             WHERE {predicate}
             ORDER BY e.updated_at DESC"
        );
        let mut statement = self
            .connection
            .prepare(&sql)
            .map_err(|err| format!("prepare graph neighbor query: {err}"))?;
        let rows = statement
            .query_map(params![current_node_id, edge_type], |row| {
                let node_payload_text: String = row.get(3)?;
                let edge_payload_text: String = row.get(7)?;
                Ok(GraphNeighbor {
                    node_id: row.get(0)?,
                    node_type: serde_json::from_str::<GraphNodeType>(&quoted(
                        row.get::<_, String>(1)?,
                    ))
                    .map_err(|err| rusqlite::Error::ToSqlConversionFailure(Box::new(err)))?,
                    stable_key: row.get(2)?,
                    node_payload: serde_json::from_str(&node_payload_text)
                        .map_err(|err| rusqlite::Error::ToSqlConversionFailure(Box::new(err)))?,
                    edge_id: row.get(4)?,
                    edge_type: serde_json::from_str::<GraphEdgeType>(&quoted(
                        row.get::<_, String>(5)?,
                    ))
                    .map_err(|err| rusqlite::Error::ToSqlConversionFailure(Box::new(err)))?,
                    confidence: row.get::<_, f64>(6)? as f32,
                    edge_payload: serde_json::from_str(&edge_payload_text)
                        .map_err(|err| rusqlite::Error::ToSqlConversionFailure(Box::new(err)))?,
                })
            })
            .map_err(|err| format!("query graph neighbors: {err}"))?;

        let mut neighbors = Vec::new();
        for row in rows {
            neighbors.push(row.map_err(|err| format!("read graph neighbor: {err}"))?);
        }
        Ok(neighbors)
    }

    pub fn node_exists(&self, node_type: GraphNodeType, stable_key: &str) -> Result<bool, String> {
        let node_type = enum_label(&node_type)?;
        self.connection
            .query_row(
                "SELECT 1 FROM orgtrack_graph_nodes WHERE node_type = ?1 AND stable_key = ?2",
                params![node_type, stable_key],
                |_| Ok(true),
            )
            .optional()
            .map(|value| value.unwrap_or(false))
            .map_err(|err| format!("check graph node: {err}"))
    }
}

fn node_id(node_type: &GraphNodeType, stable_key: &str) -> Result<String, String> {
    content_record_id(
        "orgtrack.graph.node.v1",
        &serde_json::json!({ "nodeType": node_type, "stableKey": stable_key }),
    )
    .map_err(|err| format!("hash graph node id: {err}"))
}

fn edge_id(
    from_node_id: &str,
    to_node_id: &str,
    edge_type: &GraphEdgeType,
    payload_json: &Value,
) -> Result<String, String> {
    content_record_id(
        "orgtrack.graph.edge.v1",
        &serde_json::json!({
            "fromNodeId": from_node_id,
            "toNodeId": to_node_id,
            "edgeType": edge_type,
            "payload": payload_json,
        }),
    )
    .map_err(|err| format!("hash graph edge id: {err}"))
}

fn enum_label<T: Serialize>(value: &T) -> Result<String, String> {
    match serde_json::to_value(value).map_err(|err| format!("serialize enum label: {err}"))? {
        Value::String(label) => Ok(label),
        other => Err(format!("expected enum string, got {other}")),
    }
}

fn quoted(value: String) -> String {
    serde_json::to_string(&value).unwrap_or_else(|_| "null".to_string())
}

#[cfg(test)]
mod tests {
    use orgtrack_sync::{
        ApprovalState, CommitNoteRecord, SyncRecord, SyncRecordPayload, TrustLevel,
    };
    use serde_json::json;

    use super::*;

    #[test]
    fn imports_commit_note_and_queries_file_neighbors() {
        let store = GraphStore::open_memory().expect("open graph store");
        let record = SyncRecord {
            schema: "orgtrack.commitNote.v1".to_string(),
            record_id: "record-1".to_string(),
            entity_id: Some("commit-a".to_string()),
            approval_state: ApprovalState::Included,
            trust_level: TrustLevel::Official,
            actor_id: Some("maintainer".to_string()),
            source_ref: Some("orgtrack/project".to_string()),
            created_at: "2026-06-15T00:00:00Z".to_string(),
            payload: SyncRecordPayload::CommitNote(CommitNoteRecord {
                commit_sha: "commit-a".to_string(),
                repo_url: None,
                summary: Some("change files".to_string()),
                linked_session_ids: vec!["session-a".to_string()],
                linked_work_item_ids: Vec::new(),
                file_paths: vec!["src/lib.rs".to_string()],
                metadata: json!({}),
            }),
        };

        store.import_record(&record).expect("import record");
        let neighbors = store
            .neighbors(
                GraphNodeType::Commit,
                "commit-a",
                GraphDirection::Outgoing,
                Some(GraphEdgeType::Modified),
            )
            .expect("query neighbors");

        assert_eq!(store.record_count().expect("record count"), 1);
        assert_eq!(neighbors.len(), 1);
        assert_eq!(neighbors[0].stable_key, "src/lib.rs");
    }
}
