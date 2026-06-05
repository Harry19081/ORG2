use super::*;
use serde_json::json;
use tempfile::tempdir;

#[test]
fn read_document_missing_file_returns_none() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("sticky-notes.json");
    let result = read_document(&path).expect("missing file is not an error");
    assert!(result.is_none());
}

#[test]
fn read_document_invalid_json_returns_err_and_preserves_file() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("sticky-notes.json");
    std::fs::write(&path, "{ not valid json").unwrap();

    let err = read_document(&path).expect_err("invalid json must be surfaced");
    assert!(err.contains("Failed to parse"), "got: {}", err);

    let on_disk = std::fs::read_to_string(&path).unwrap();
    assert_eq!(on_disk, "{ not valid json");
}

#[test]
fn write_then_read_round_trips() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("sticky-notes.json");
    let original = json!({
        "version": 1,
        "sections": [
            { "id": "s1", "title": "Inbox", "noteIds": ["n1"] }
        ],
        "notes": {
            "n1": { "id": "n1", "title": "Hello", "body": "world", "color": "yellow" }
        }
    });

    write_document(&path, &original).expect("write succeeds");
    let loaded = read_document(&path)
        .expect("read succeeds")
        .expect("file exists");
    assert_eq!(loaded, original);
}

#[test]
fn write_document_replaces_existing_file_atomically() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("sticky-notes.json");
    std::fs::write(&path, "{\"old\":true}").unwrap();

    let new_doc = json!({ "version": 1, "notes": {} });
    write_document(&path, &new_doc).expect("write replaces existing");

    let loaded = read_document(&path).unwrap().unwrap();
    assert_eq!(loaded, new_doc);

    // Tmp file must not linger after a successful save.
    let tmp = path.with_extension("json.tmp");
    assert!(!tmp.exists(), "tmp file should be renamed away");
}
