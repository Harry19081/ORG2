//! Explicit, selected-session handoff. UI cannot nominate roots or owners.
use crate::agent_sessions::cli::native_materializer::claude_history_handoff::{
    self, Mode, Report, Status,
};
use agent_cli::managed_config::native_app;

pub(super) async fn inspect_or_sync(selected: Option<String>, mode: Mode) -> Report {
    let result = async {
        let lease = super::owner::require().map_err(|_| Status::ScopeChanged)?;
        let profile = lease
            .native_app("claude_desktop")
            .map_err(|_| Status::ScopeChanged)?
            .ok_or(Status::Unsupported)?;
        let operation = lease
            .clone()
            .operation()
            .await
            .map_err(|_| Status::ScopeChanged)?;
        tokio::task::spawn_blocking(move || {
            let _operation = operation;
            native_app::with_existing_profile(&profile, mode == Mode::Sync, |check_profile| {
                Ok(claude_history_handoff::run(
                    &profile,
                    lease.user(),
                    selected.as_deref(),
                    mode,
                    || {
                        lease.check().map_err(|_| Status::ScopeChanged)?;
                        check_profile().map_err(|_| Status::ScopeChanged)
                    },
                    || {
                        super::native_app_launch::claude_history_writers_closed().map_err(|code| {
                            if code == "busy" {
                                Status::Busy
                            } else {
                                Status::WriterUnknown
                            }
                        })
                    },
                ))
            })
            .map_err(|_| Status::ScopeChanged)
        })
        .await
        .map_err(|_| Status::Failed)?
    }
    .await;
    result.unwrap_or_else(|status| Report {
        status,
        items: Vec::new(),
    })
}
