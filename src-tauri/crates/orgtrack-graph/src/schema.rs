use rusqlite::Connection;

pub fn initialize_schema(connection: &Connection) -> rusqlite::Result<()> {
    connection.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS orgtrack_sync_records (
            record_id TEXT PRIMARY KEY,
            schema TEXT NOT NULL,
            entity_id TEXT,
            approval_state TEXT NOT NULL,
            trust_level TEXT NOT NULL,
            source_ref TEXT,
            payload_json TEXT NOT NULL,
            imported_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_orgtrack_sync_records_schema
            ON orgtrack_sync_records(schema);
        CREATE INDEX IF NOT EXISTS idx_orgtrack_sync_records_entity
            ON orgtrack_sync_records(entity_id);
        CREATE INDEX IF NOT EXISTS idx_orgtrack_sync_records_approval
            ON orgtrack_sync_records(approval_state);

        CREATE TABLE IF NOT EXISTS orgtrack_graph_nodes (
            node_id TEXT PRIMARY KEY,
            node_type TEXT NOT NULL,
            stable_key TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(node_type, stable_key)
        );

        CREATE INDEX IF NOT EXISTS idx_orgtrack_graph_nodes_type_key
            ON orgtrack_graph_nodes(node_type, stable_key);

        CREATE TABLE IF NOT EXISTS orgtrack_graph_edges (
            edge_id TEXT PRIMARY KEY,
            from_node_id TEXT NOT NULL,
            to_node_id TEXT NOT NULL,
            edge_type TEXT NOT NULL,
            confidence REAL NOT NULL,
            payload_json TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(from_node_id) REFERENCES orgtrack_graph_nodes(node_id) ON DELETE CASCADE,
            FOREIGN KEY(to_node_id) REFERENCES orgtrack_graph_nodes(node_id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_orgtrack_graph_edges_from_type
            ON orgtrack_graph_edges(from_node_id, edge_type);
        CREATE INDEX IF NOT EXISTS idx_orgtrack_graph_edges_to_type
            ON orgtrack_graph_edges(to_node_id, edge_type);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_orgtrack_graph_edges_unique
            ON orgtrack_graph_edges(from_node_id, to_node_id, edge_type);
        ",
    )
}
