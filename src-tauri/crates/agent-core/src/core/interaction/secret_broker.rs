//! Secret broker — out-of-band capture and short-lived storage of
//! user-supplied plaintext secrets (API keys, passwords, OAuth tokens).
//!
//! # Threat model
//!
//! The ADE Manager helps users set up `.env` files. Naively this would mean
//! the user pastes a secret into chat, the LLM reads it, and then the
//! plaintext lives forever in:
//!
//!   * the LLM provider's request logs (Anthropic / OpenAI / OpenRouter),
//!   * our own local chat transcript (`agent_sessions.db`),
//!   * any prompt-cache that captured the turn.
//!
//! The broker breaks every link in that chain:
//!
//!   1. The agent calls `manage_secrets { action: "request", … }`. The tool
//!      broadcasts `agent:secret_request` to the frontend, which pops a
//!      modal with `<input type="password">`. The plaintext is captured in
//!      the renderer process only.
//!   2. The frontend invokes a Tauri command (`secret_capture_submit`)
//!      that hands the plaintext directly to this broker. The plaintext
//!      goes into a `Zeroizing<String>` (wiped on drop) and gets a fresh
//!      opaque token of the form `secret-<base64-uuid>`.
//!   3. The tool returns `{{secret:<token>}}` to the LLM — never the
//!      plaintext. The LLM may now use the token in subsequent tool calls
//!      (today: only `write_env_file`).
//!   4. When `write_env_file` consumes the template, it asks the broker to
//!      resolve each `{{secret:…}}` to plaintext at write time. The
//!      resolved buffer is written to disk and immediately dropped.
//!
//! # Per-session ownership
//!
//! The broker is owned by `AgentSession` (next to `QuestionManager`). When
//! the session terminates, all `Zeroizing<String>` buffers are dropped,
//! overwriting the plaintext in memory.

use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::time::{Duration, Instant};

use tokio::sync::{oneshot, Mutex};
use tracing::{info, warn};
use uuid::Uuid;
use zeroize::Zeroizing;

use crate::tools::names as tool_names;

use super::finalize::{finalize_interaction_event, FinalizedStatus};

/// Default lifetime for a captured secret. After this elapses without use,
/// the slot is purged (the next consumer of the token sees `Resolve::Expired`).
///
/// 15 minutes is comfortably longer than a typical "ask the agent to set
/// up `.env`" sub-task but short enough that a forgotten secret does not
/// linger in memory indefinitely.
pub const DEFAULT_SECRET_TTL: Duration = Duration::from_secs(60 * 15);

/// The opaque token shape the LLM sees. Always prefixed so we can grep
/// transcripts for accidental leaks and so `write_env_file` can do a
/// cheap `contains("{{secret:")` pre-check before regex resolution.
const TOKEN_PREFIX: &str = "secret-";

/// Outcome of an `ask` waiting on the user's modal submission.
#[derive(Debug)]
pub enum SecretCapture {
    /// User submitted a secret. The token is the placeholder safe to hand
    /// to the LLM; the plaintext stays in the broker.
    Submitted { token: String },
    /// User cancelled the modal without entering anything.
    Cancelled,
}

/// Outcome of resolving a token back to plaintext.
pub enum Resolve {
    /// Token is live; here is the plaintext (zeroized when dropped).
    Plaintext(Zeroizing<String>),
    /// Token shape is correct but the slot was not present (already
    /// consumed via `take`, discarded, or expired).
    Expired,
    /// Token shape is malformed or unknown.
    Unknown,
}

/// What `peek_metadata` returns for the UI / the LLM-facing status report.
#[derive(Debug, Clone, serde::Serialize)]
pub struct SecretMetadata {
    pub token: String,
    /// Short, human-friendly label the agent gave the secret when it was
    /// requested (e.g. `"OPENAI_API_KEY"`). Safe to surface to the LLM.
    pub label: String,
    /// Coarse-grained category as declared by the agent
    /// (`"api_key" | "password" | "oauth_token" | "other"`). Display-only.
    pub kind: String,
    /// Approximate number of seconds until the slot expires. The LLM is
    /// shown this so it knows whether to ask the user to re-enter.
    pub expires_in_secs: u64,
    /// Length of the plaintext (display only, never the contents).
    pub length: usize,
}

struct PendingCapture {
    sender: oneshot::Sender<SecretCapture>,
    session_id: String,
    tool_call_id: Option<String>,
    label: String,
    kind: String,
}

struct StoredSecret {
    plaintext: Zeroizing<String>,
    label: String,
    kind: String,
    expires_at: Instant,
}

/// Per-session broker for out-of-band secret capture.
///
/// Construction mirrors `QuestionManager`: the `cancel_flag` is shared with
/// the owning `AgentSession` so the Stop button unblocks any pending
/// `await_with_cancel` wait on a capture request.
pub struct SecretBroker {
    /// Active modal round-trips keyed by `request_id`.
    pending: Arc<Mutex<HashMap<String, PendingCapture>>>,
    /// Captured plaintext keyed by opaque token. Drops here zeroize.
    secrets: Arc<Mutex<HashMap<String, StoredSecret>>>,
    cancel_flag: Arc<AtomicBool>,
    ttl: Duration,
}

impl SecretBroker {
    /// Build a broker with no cancel-flag wiring. Used by call sites that
    /// don't own an `AgentSession` (tests, gateway). Stop integration is
    /// then a no-op for that broker.
    pub fn new() -> Self {
        Self::with_cancel_flag(Arc::new(AtomicBool::new(false)))
    }

    pub fn with_cancel_flag(cancel_flag: Arc<AtomicBool>) -> Self {
        Self {
            pending: Arc::new(Mutex::new(HashMap::new())),
            secrets: Arc::new(Mutex::new(HashMap::new())),
            cancel_flag,
            ttl: DEFAULT_SECRET_TTL,
        }
    }

    /// Override the default TTL. Mainly used by tests.
    pub fn with_ttl(mut self, ttl: Duration) -> Self {
        self.ttl = ttl;
        self
    }

    pub fn cancel_flag(&self) -> Arc<AtomicBool> {
        Arc::clone(&self.cancel_flag)
    }

    /// Initiate a capture round-trip. The returned `Receiver` resolves when
    /// the user submits the modal (`SecretCapture::Submitted`) or cancels
    /// (`SecretCapture::Cancelled`). The caller (the `manage_secrets`
    /// tool) wraps the receiver in `await_with_cancel` so the Stop button
    /// also unblocks the wait.
    ///
    /// The label/kind are user-facing strings the frontend shows in the
    /// modal — they are also surfaced to the LLM on `status`/`list` actions
    /// so the agent can disambiguate multiple outstanding secrets without
    /// ever seeing the plaintext.
    pub async fn ask(
        &self,
        session_id: &str,
        request_id: &str,
        label: &str,
        kind: &str,
        prompt: &str,
        tool_call_id: Option<&str>,
    ) -> oneshot::Receiver<SecretCapture> {
        let (sender, receiver) = oneshot::channel();

        self.pending.lock().await.insert(
            request_id.to_string(),
            PendingCapture {
                sender,
                session_id: session_id.to_string(),
                tool_call_id: tool_call_id.map(str::to_string),
                label: label.to_string(),
                kind: kind.to_string(),
            },
        );

        let payload = serde_json::json!({
            "requestId": request_id,
            "sessionId": session_id,
            "toolCallId": tool_call_id,
            "label": label,
            "kind": kind,
            "prompt": prompt,
        });

        crate::bus::broadcast_event("agent:secret_request", payload);

        info!(
            "[secret] Asked for secret label='{}' kind='{}' (request={})",
            label, kind, request_id
        );

        receiver
    }

    /// Frontend submitted plaintext. We mint a token, store the zeroizing
    /// buffer, resolve the pending oneshot, and emit a structured
    /// finalized event with `{ token, label, length }` — never the value.
    pub async fn submit(&self, request_id: &str, plaintext: String) {
        let Some(entry) = self.pending.lock().await.remove(request_id) else {
            warn!("[secret] No pending capture for request_id={}", request_id);
            return;
        };

        let length = plaintext.len();
        let token = mint_token();
        let stored = StoredSecret {
            plaintext: Zeroizing::new(plaintext),
            label: entry.label.clone(),
            kind: entry.kind.clone(),
            expires_at: Instant::now() + self.ttl,
        };
        self.secrets.lock().await.insert(token.clone(), stored);

        finalize_interaction_event(
            &entry.session_id,
            entry.tool_call_id.as_deref(),
            tool_names::MANAGE_SECRETS,
            FinalizedStatus::Answered,
            &format!(
                "User provided '{}' ({} chars). Use placeholder {{{{secret:{}}}}} in subsequent tool calls.",
                entry.label, length, token
            ),
            serde_json::json!({
                "token": token,
                "label": entry.label,
                "kind": entry.kind,
                "length": length,
            }),
        );

        if entry
            .sender
            .send(SecretCapture::Submitted { token })
            .is_err()
        {
            warn!(
                "[secret] Capture {} resolved but tool was no longer waiting",
                request_id
            );
        } else {
            info!(
                "[secret] Captured '{}' for request {}",
                entry.label, request_id
            );
        }
    }

    /// Frontend cancelled the modal.
    pub async fn cancel(&self, request_id: &str) {
        let Some(entry) = self.pending.lock().await.remove(request_id) else {
            return;
        };

        finalize_interaction_event(
            &entry.session_id,
            entry.tool_call_id.as_deref(),
            tool_names::MANAGE_SECRETS,
            FinalizedStatus::Rejected,
            "The user dismissed the secret-capture dialog.",
            serde_json::json!({
                "label": entry.label,
                "kind": entry.kind,
            }),
        );

        let _ = entry.sender.send(SecretCapture::Cancelled);
        info!("[secret] Capture {} dismissed by user", request_id);
    }

    /// Stop-button / TTL termination of a still-pending capture.
    pub async fn cancel_pending(&self, request_id: &str, status: FinalizedStatus) {
        let Some(entry) = self.pending.lock().await.remove(request_id) else {
            return;
        };

        let content = match status {
            FinalizedStatus::Cancelled => {
                "The user stopped the session before submitting the secret."
            }
            FinalizedStatus::TimedOut => "The secret-capture dialog timed out.",
            FinalizedStatus::Answered | FinalizedStatus::Rejected => {
                "The secret-capture dialog was terminated."
            }
        };

        finalize_interaction_event(
            &entry.session_id,
            entry.tool_call_id.as_deref(),
            tool_names::MANAGE_SECRETS,
            status,
            content,
            serde_json::json!({
                "label": entry.label,
                "kind": entry.kind,
            }),
        );

        drop(entry.sender);
        info!(
            "[secret] Pending capture {} terminated (status={:?})",
            request_id, status
        );
    }

    /// Privileged read — hand the consumer a zeroizing copy of the plaintext.
    ///
    /// This is the **only** path that exposes plaintext to Rust code after
    /// capture. Today it is called from `write_env_file` exclusively. If a
    /// second consumer is added it must be reviewed against the threat
    /// model in this file's docstring.
    pub async fn resolve(&self, token: &str) -> Resolve {
        if !token.starts_with(TOKEN_PREFIX) {
            return Resolve::Unknown;
        }
        self.purge_expired().await;
        let map = self.secrets.lock().await;
        match map.get(token) {
            Some(slot) => Resolve::Plaintext(Zeroizing::new(slot.plaintext.as_str().to_owned())),
            None => Resolve::Expired,
        }
    }

    /// Like `resolve`, but also removes the slot. Use this when a secret
    /// is expected to be single-use (e.g. `write_env_file` with
    /// `consume_tokens: true`).
    pub async fn take(&self, token: &str) -> Resolve {
        if !token.starts_with(TOKEN_PREFIX) {
            return Resolve::Unknown;
        }
        self.purge_expired().await;
        let mut map = self.secrets.lock().await;
        match map.remove(token) {
            Some(slot) => {
                let pt = slot.plaintext.as_str().to_owned();
                Resolve::Plaintext(Zeroizing::new(pt))
            }
            None => Resolve::Expired,
        }
    }

    /// Discard a token without consuming it (agent explicitly retired it).
    pub async fn discard(&self, token: &str) -> bool {
        self.secrets.lock().await.remove(token).is_some()
    }

    /// Wipe every captured secret. Called from `AgentSession` shutdown so
    /// the `Zeroizing` drops fire deterministically rather than waiting on
    /// the next allocator pass.
    pub async fn purge_all(&self) {
        self.secrets.lock().await.clear();
        self.pending.lock().await.clear();
    }

    /// LLM-safe view of currently captured secrets.
    pub async fn list(&self) -> Vec<SecretMetadata> {
        self.purge_expired().await;
        let now = Instant::now();
        self.secrets
            .lock()
            .await
            .iter()
            .map(|(token, slot)| SecretMetadata {
                token: token.clone(),
                label: slot.label.clone(),
                kind: slot.kind.clone(),
                expires_in_secs: slot.expires_at.saturating_duration_since(now).as_secs(),
                length: slot.plaintext.as_str().len(),
            })
            .collect()
    }

    async fn purge_expired(&self) {
        let now = Instant::now();
        let mut map = self.secrets.lock().await;
        map.retain(|_, slot| slot.expires_at > now);
    }
}

impl Default for SecretBroker {
    fn default() -> Self {
        Self::new()
    }
}

fn mint_token() -> String {
    // Uuid v4 → base64 strips the dashes and is shorter, but plain hyphenated
    // form is fine: the LLM doesn't care, and `{{secret:<uuid>}}` is easy to
    // search for in logs if a leak ever happens.
    format!("{}{}", TOKEN_PREFIX, Uuid::new_v4())
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn submit_then_resolve_round_trip() {
        let broker = SecretBroker::new();
        let receiver = broker
            .ask(
                "session-1",
                "req-1",
                "OPENAI_API_KEY",
                "api_key",
                "Paste your key",
                None,
            )
            .await;

        broker
            .submit("req-1", "sk-test-1234567890".to_string())
            .await;

        let outcome = receiver.await.unwrap();
        let token = match outcome {
            SecretCapture::Submitted { token } => token,
            SecretCapture::Cancelled => panic!("expected submitted"),
        };
        assert!(token.starts_with("secret-"));

        match broker.resolve(&token).await {
            Resolve::Plaintext(pt) => assert_eq!(pt.as_str(), "sk-test-1234567890"),
            _ => panic!("expected plaintext"),
        }
    }

    #[tokio::test]
    async fn take_consumes_the_slot() {
        let broker = SecretBroker::new();
        let receiver = broker
            .ask("s", "r", "label", "api_key", "prompt", None)
            .await;
        broker.submit("r", "secretvalue".into()).await;
        let token = match receiver.await.unwrap() {
            SecretCapture::Submitted { token } => token,
            _ => panic!(),
        };

        match broker.take(&token).await {
            Resolve::Plaintext(pt) => assert_eq!(pt.as_str(), "secretvalue"),
            _ => panic!("expected plaintext on first take"),
        }
        assert!(matches!(broker.take(&token).await, Resolve::Expired));
    }

    #[tokio::test]
    async fn cancel_yields_cancelled() {
        let broker = SecretBroker::new();
        let receiver = broker
            .ask("s", "r", "label", "password", "prompt", None)
            .await;
        broker.cancel("r").await;
        assert!(matches!(receiver.await.unwrap(), SecretCapture::Cancelled));
    }

    #[tokio::test]
    async fn unknown_token_is_rejected_before_lock() {
        let broker = SecretBroker::new();
        assert!(matches!(
            broker.resolve("not-a-secret").await,
            Resolve::Unknown
        ));
        assert!(matches!(
            broker.resolve("secret-garbage").await,
            Resolve::Expired
        ));
    }

    #[tokio::test]
    async fn expired_secrets_are_purged() {
        let broker = SecretBroker::new().with_ttl(Duration::from_millis(20));
        let receiver = broker
            .ask("s", "r", "label", "api_key", "prompt", None)
            .await;
        broker.submit("r", "value".into()).await;
        let token = match receiver.await.unwrap() {
            SecretCapture::Submitted { token } => token,
            _ => panic!(),
        };
        tokio::time::sleep(Duration::from_millis(50)).await;
        assert!(matches!(broker.resolve(&token).await, Resolve::Expired));
    }

    #[tokio::test]
    async fn list_never_exposes_plaintext() {
        let broker = SecretBroker::new();
        let receiver = broker
            .ask("s", "r", "OPENAI_API_KEY", "api_key", "prompt", None)
            .await;
        broker.submit("r", "sk-very-secret-value".into()).await;
        let _ = receiver.await.unwrap();

        let list = broker.list().await;
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].label, "OPENAI_API_KEY");
        assert_eq!(list[0].length, "sk-very-secret-value".len());
        let serialized = serde_json::to_string(&list).unwrap();
        assert!(!serialized.contains("sk-very-secret-value"));
    }
}
