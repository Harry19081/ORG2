use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ApprovalState {
    ApprovalPending,
    Validated,
    Included,
    Rejected,
    Superseded,
}

impl Default for ApprovalState {
    fn default() -> Self {
        Self::ApprovalPending
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TrustLevel {
    LocalDraft,
    ContributorClaim,
    MaintainerReviewed,
    TrustedAutomation,
    Official,
}

impl Default for TrustLevel {
    fn default() -> Self {
        Self::LocalDraft
    }
}
