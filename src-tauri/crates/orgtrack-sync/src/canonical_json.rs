use std::collections::BTreeMap;

use serde::Serialize;
use serde_json::{Map, Value};

pub fn canonical_json<T: Serialize>(value: &T) -> Result<String, serde_json::Error> {
    let value = serde_json::to_value(value)?;
    let sorted = sort_value(value);
    serde_json::to_string(&sorted)
}

fn sort_value(value: Value) -> Value {
    match value {
        Value::Array(items) => Value::Array(items.into_iter().map(sort_value).collect()),
        Value::Object(map) => {
            let sorted = map
                .into_iter()
                .map(|(key, value)| (key, sort_value(value)))
                .collect::<BTreeMap<_, _>>();
            Value::Object(Map::from_iter(sorted))
        }
        other => other,
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::canonical_json;

    #[test]
    fn canonical_json_sorts_nested_object_keys() {
        let value = json!({"z": 1, "a": {"b": 2, "a": 3}});
        let canonical = canonical_json(&value).expect("canonical json");

        assert_eq!(canonical, r#"{"a":{"a":3,"b":2},"z":1}"#);
    }
}
