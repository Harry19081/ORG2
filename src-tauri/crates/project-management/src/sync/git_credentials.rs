//! Git credential resolution from the connection store.
//!
//! Provides the canonical lookup for HTTPS Git operations (clone, push,
//! GitHub REST/GraphQL calls). Walks `ADAPTER_GITHUB` rows in
//! `connection_store`, returns the first one whose token can be used as
//! an HTTPS bearer.
//!
//! SSH connections (`SOURCE_SSH`) are skipped here: the stored value is
//! a private-key path, not an HTTP credential. Clone/push fall back to
//! SSH transport for those remotes via the system `git` config.

use serde::Serialize;
use tauri::command;

use super::connection_store::{self, ADAPTER_GITHUB};
use super::connection_token_store::{self, SOURCE_SSH};

/// HTTPS Git credential resolved from the connection store.
#[derive(Debug, Clone, Serialize)]
pub struct GitCredential {
    /// Connection ID the token came from (for logging / row attribution).
    pub connection_id: String,
    /// Username to pair with the bearer for `git` HTTPS auth. GitHub
    /// accepts the fixed `x-access-token` username for OAuth/PAT bearers.
    pub username: String,
    /// HTTPS bearer token.
    pub token: String,
    /// `SOURCE_*` from `connection_token_store` (`pat`, `oauth_*`, `scan`).
    pub source: String,
}

/// Find the first usable HTTPS Git credential.
///
/// Scans `ADAPTER_GITHUB` connections newest-first (per
/// `connection_store::list` ordering) and returns the first one whose
/// token store entry is not an SSH key reference. Returns `Ok(None)`
/// when no HTTPS credential is on file.
pub fn find_https_credential() -> Result<Option<GitCredential>, String> {
    for connection in connection_store::list()? {
        if connection.adapter_id != ADAPTER_GITHUB {
            continue;
        }
        let Some(record) = connection_token_store::get(&connection.id)? else {
            continue;
        };
        if record.source == SOURCE_SSH {
            continue;
        }
        return Ok(Some(GitCredential {
            connection_id: connection.id,
            username: "x-access-token".to_string(),
            token: record.access_token,
            source: record.source,
        }));
    }
    Ok(None)
}

/// Tauri command — exposed so the `git` operations layer can look up a
/// credential for a specific remote URL. The `remote_url` is currently
/// only used to short-circuit non-HTTPS remotes; the resolver itself is
/// remote-agnostic (we keep a single token per Git account today).
#[command]
pub async fn git_credential_for_remote(
    remote_url: String,
) -> Result<Option<GitCredential>, String> {
    let trimmed = remote_url.trim();
    if trimmed.starts_with("git@") || trimmed.starts_with("ssh://") {
        return Ok(None);
    }
    find_https_credential()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sync::connection_store::{
        create, CreateConnectionRequest, ADAPTER_GITHUB, ADAPTER_LINEAR, AUTH_METHOD_PAT,
        AUTH_METHOD_SSH,
    };
    use crate::sync::connection_token_store::{
        save, ConnectionTokenRecord, SOURCE_PAT, SOURCE_SSH,
    };
    use test_helpers::test_env;

    #[test]
    fn returns_first_git_pat_token() {
        let _guard = test_env::sandbox();

        let linear = create(CreateConnectionRequest {
            adapter_id: ADAPTER_LINEAR.to_string(),
            label: "Linear".to_string(),
            auth_method: AUTH_METHOD_PAT.to_string(),
            account_email: None,
        })
        .expect("create linear connection");
        save(&linear.id, ConnectionTokenRecord::pat("linear-token")).expect("save linear token");

        let git = create(CreateConnectionRequest {
            adapter_id: ADAPTER_GITHUB.to_string(),
            label: "GitHub PAT".to_string(),
            auth_method: AUTH_METHOD_PAT.to_string(),
            account_email: None,
        })
        .expect("create git connection");
        save(&git.id, ConnectionTokenRecord::pat("ghp_test")).expect("save git token");

        let credential = find_https_credential()
            .expect("lookup ok")
            .expect("credential present");
        assert_eq!(credential.connection_id, git.id);
        assert_eq!(credential.username, "x-access-token");
        assert_eq!(credential.token, "ghp_test");
        assert_eq!(credential.source, SOURCE_PAT);
    }

    #[test]
    fn skips_ssh_only_connection() {
        let _guard = test_env::sandbox();

        let ssh = create(CreateConnectionRequest {
            adapter_id: ADAPTER_GITHUB.to_string(),
            label: "SSH".to_string(),
            auth_method: AUTH_METHOD_SSH.to_string(),
            account_email: None,
        })
        .expect("create ssh connection");
        save(
            &ssh.id,
            ConnectionTokenRecord {
                access_token: "/Users/me/.ssh/id_ed25519".to_string(),
                refresh_token: None,
                expires_at_unix: None,
                source: SOURCE_SSH.to_string(),
            },
        )
        .expect("save ssh path");

        assert!(find_https_credential().expect("lookup ok").is_none());
    }

    #[test]
    fn returns_none_when_empty() {
        let _guard = test_env::sandbox();
        assert!(find_https_credential().expect("lookup ok").is_none());
    }
}
