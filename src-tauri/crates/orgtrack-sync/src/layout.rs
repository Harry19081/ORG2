pub const SCHEMA_VERSION: &str = "v1";
pub const DEFAULT_METADATA_BRANCH: &str = "orgtrack/project";
pub const MANIFEST_FILE: &str = "manifest.json";
pub const OBJECTS_DIR: &str = "objects";
pub const INDEXES_DIR: &str = "indexes";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MetadataBranchLayout {
    pub branch_name: String,
    pub schema_version: String,
}

impl Default for MetadataBranchLayout {
    fn default() -> Self {
        Self {
            branch_name: DEFAULT_METADATA_BRANCH.to_string(),
            schema_version: SCHEMA_VERSION.to_string(),
        }
    }
}

impl MetadataBranchLayout {
    pub fn object_path(&self, schema_family: &str, record_id: &str) -> String {
        let hash = record_id.strip_prefix("sha256:").unwrap_or(record_id);
        let prefix = hash.get(0..2).unwrap_or("00");
        format!("{OBJECTS_DIR}/{schema_family}/{prefix}/{record_id}.json")
    }

    pub fn manifest_path(&self) -> &'static str {
        MANIFEST_FILE
    }

    pub fn index_path(&self, index_name: &str) -> String {
        format!("{INDEXES_DIR}/{index_name}.json")
    }
}

#[cfg(test)]
mod tests {
    use super::MetadataBranchLayout;

    #[test]
    fn object_path_uses_hash_prefix() {
        let layout = MetadataBranchLayout::default();

        assert_eq!(
            layout.object_path("session", "sha256:abcdef"),
            "objects/session/ab/sha256:abcdef.json"
        );
    }
}
