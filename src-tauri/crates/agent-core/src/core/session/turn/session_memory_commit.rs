//! Cancellation-safe lifetime and durable publication for extracted summaries.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use tokio::sync::Mutex;

use crate::model_context::session_memory::extract::SessionMemoryExtraction;
use crate::model_context::session_memory::SessionMemoryState;
use crate::session::persistence;

pub(super) struct ExtractionLease {
    state: Arc<Mutex<SessionMemoryState>>,
    pub generation: u64,
    alive: Arc<AtomicBool>,
    finished: bool,
}

impl ExtractionLease {
    pub async fn begin(state: Arc<Mutex<SessionMemoryState>>) -> Self {
        let generation = {
            let mut current = state.lock().await;
            current.extraction_generation += 1;
            current.extraction_in_progress = true;
            current.extraction_generation
        };
        Self {
            state,
            generation,
            alive: Arc::new(AtomicBool::new(true)),
            finished: false,
        }
    }

    pub async fn commit(
        &self,
        session_id: String,
        draft: SessionMemoryExtraction,
        snapshot: persistence::SessionMemoryCommitSnapshot,
        cancel: Option<Arc<AtomicBool>>,
    ) -> Result<bool, String> {
        let state = self.state.clone();
        let generation = self.generation;
        let alive = self.alive.clone();
        tokio::task::spawn_blocking(move || {
            // Same lock order as compaction: runtime state, then DB writer.
            // Never hold this mutex during the provider request. The worker
            // owns both durable commit and publication even if its waiter drops.
            let mut current = state.blocking_lock();
            if current.extraction_generation != generation
                || current.content != draft.expected_content
                || current.last_summarized_seq != draft.expected_seq
                || snapshot.content != draft.expected_content
                || snapshot.last_seq != draft.expected_seq
            {
                return Ok(false);
            }
            let committed = persistence::commit_session_memory_state(
                &session_id,
                &draft.content,
                draft.last_seq,
                &snapshot,
                || {
                    !alive.load(Ordering::SeqCst)
                        || cancel
                            .as_ref()
                            .is_some_and(|flag| flag.load(Ordering::SeqCst))
                },
                || {
                    current.content = Some(draft.content.clone());
                    current.last_summarized_seq = draft.last_seq;
                    current.tokens_at_last_extraction = draft.current_tokens;
                    current.tool_calls_since_extraction = current
                        .tool_calls_since_extraction
                        .saturating_sub(draft.consumed_tool_calls);
                    current.initialized = true;
                    current.auxiliary_retry.succeeded();
                },
            )
            .map_err(|err| format!("Failed to persist session memory state: {err}"))?;
            Ok(committed)
        })
        .await
        .map_err(|err| format!("SM persist worker failed: {err}"))?
    }

    pub async fn finish(mut self) {
        let mut current = self.state.lock().await;
        if current.extraction_generation == self.generation {
            current.extraction_in_progress = false;
        }
        self.finished = true;
    }
}

impl Drop for ExtractionLease {
    fn drop(&mut self) {
        // Synchronous invalidation: a blocked writer sees this even if the
        // coordinator's token-to-atomic bridge has not been scheduled yet.
        self.alive.store(false, Ordering::SeqCst);
        if self.finished {
            return;
        }
        let state = self.state.clone();
        let generation = self.generation;
        tokio::spawn(async move {
            let mut current = state.lock().await;
            if current.extraction_generation == generation {
                current.extraction_in_progress = false;
            }
        });
    }
}
