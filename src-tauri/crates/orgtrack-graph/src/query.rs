use orgtrack_sync::{GraphEdgeType, GraphNodeType};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GraphDirection {
    Outgoing,
    Incoming,
    Both,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphNeighbor {
    pub node_id: String,
    pub node_type: GraphNodeType,
    pub stable_key: String,
    pub node_payload: Value,
    pub edge_id: String,
    pub edge_type: GraphEdgeType,
    pub confidence: f32,
    pub edge_payload: Value,
}
