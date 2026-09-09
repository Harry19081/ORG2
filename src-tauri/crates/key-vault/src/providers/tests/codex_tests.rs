use crate::providers::codex::app_server::{
    cleanup_temporary_codex_home, read_temporary_codex_auth, write_temporary_codex_home,
};
use crate::providers::codex::{is_oauth_auth_error, CodexValidator};

#[tokio::test]
async fn temporary_codex_home_never_receives_refresh_token() {
    let codex_home =
        write_temporary_codex_home("current-access-token", Some("eyJ.test-id-token.payload"))
            .await
            .unwrap();

    let auth = read_temporary_codex_auth(&codex_home).await.unwrap();
    assert_eq!(
        auth.pointer("/tokens/access_token")
            .and_then(|value| value.as_str()),
        Some("current-access-token")
    );
    assert!(auth.pointer("/tokens/refresh_token").unwrap().is_null());

    cleanup_temporary_codex_home(&codex_home, "test").await;
}

#[test]
fn oauth_auth_errors_bypass_the_disposable_app_server_fallback() {
    assert!(is_oauth_auth_error(
        "Codex usage API unauthorized: HTTP 401"
    ));
    assert!(is_oauth_auth_error("Codex usage API forbidden: HTTP 403"));
    assert!(!is_oauth_auth_error(
        "Codex usage API response did not include quota windows"
    ));
}

#[test]
fn test_validate_format_jwt() {
    let validator = CodexValidator::new();
    let (valid, _) = validator.validate_format("eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.test");
    assert!(valid);
}

#[test]
fn test_validate_format_api_key() {
    let validator = CodexValidator::new();
    let (valid, _) = validator.validate_format("sk-proj-abc123");
    assert!(valid);
}

#[test]
fn test_validate_format_empty() {
    let validator = CodexValidator::new();
    let (valid, _) = validator.validate_format("");
    assert!(!valid);
}
