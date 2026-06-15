use serde::Serialize;
use sha2::{Digest, Sha256};

use crate::canonical_json::canonical_json;

pub type RecordId = String;
pub type EntityId = String;

pub fn content_record_id<T: Serialize>(
    schema: &str,
    payload: &T,
) -> Result<RecordId, serde_json::Error> {
    let canonical = canonical_json(&(schema, payload))?;
    let digest = Sha256::digest(canonical.as_bytes());
    Ok(format!("sha256:{}", to_hex(&digest)))
}

fn to_hex(bytes: &[u8]) -> String {
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push_str(&format!("{byte:02x}"));
    }
    output
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::content_record_id;

    #[test]
    fn content_record_id_is_stable_for_equivalent_json() {
        let left = json!({"b": 2, "a": 1});
        let right = json!({"a": 1, "b": 2});

        assert_eq!(
            content_record_id("orgtrack.test.v1", &left).expect("left id"),
            content_record_id("orgtrack.test.v1", &right).expect("right id")
        );
    }
}
