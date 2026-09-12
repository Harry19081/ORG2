# Session memory growth baseline

## Problem and authoritative boundary

`agent_sessions` stored summary text and sequence but not the context-token baseline. Restoring a summary used a zero baseline, so a small post-restart turn could appear to contain an entire context of new growth. Compaction could retain an obsolete large runtime baseline, preventing future updates.

## Invariant and compatibility

Persist the nullable `sm_tokens_at_last_extraction` with the summary and sequence in the guarded commit from #1663. Restore all three. Legacy summaries keep their content and sequence; the first observed context establishes the missing baseline without an LLM request. Explicit compaction clears the baseline; a lower observed context also establishes a new baseline. Subsequent extraction requires the configured growth above it.

The additive nullable column is necessary for existing user databases. Existing migration machinery adds it without rewriting historical messages. Old binaries ignore the column; rollback is a code revert, leaving this harmless nullable column in place. No historical cleanup or credential change is required. Baselines are observations, not reconstructed historical token counts; legacy first-turn growth is deliberately not estimated.

## Resource ownership and lifecycle

| Resource/state                             | Behavior                                                   | Evidence / limitation                                                      |
| ------------------------------------------ | ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| Normal completed turn                      | In-memory baseline check only                              | Regression installs rejecting DB trigger and normal turn succeeds          |
| Legacy restore, compaction, context shrink | One guarded metadata update, no LLM request                | SQLite regression; writer admission bounded by inherited one-second budget |
| Summary completion                         | Content, sequence and baseline commit together             | Durable commit and reload regression                                       |
| Write failure / stale generation           | Preserve prior baseline and retry on a later turn          | Injected DB failure and inherited commit-generation tests                  |
| Active/idle/hidden                         | No timer or polling added; work comes from completed turns | Static call-chain inspection; packaged whole-app measurements pending      |
| Cancellation/shutdown                      | Reuses extraction lease invalidation                       | #1663 worker cancellation tests; no new recurring resource                 |
| Account switch/network                     | Metadata does not select models or clear retry state       | No new provider-specific behavior; live account switching not retested     |

## Architecture coverage

Reviewed persistence ownership, restore/compaction parity, state transitions, concurrency, API callers, and failure propagation. UI rendering, wire format and provider selection are unchanged. Production automatic and manual compaction both invalidate the baseline. This does not rewrite all generic compaction failure bookkeeping.

## Verification

Targeted session-memory and persistence tests plus strict Clippy are run for this change; exact outcomes are recorded in the PR. Whole-app CPU/RSS and packaged restart/compaction acceptance remain pending until separately measured. No runtime performance improvement is inferred from unit tests.

Performance verdict: bounded demand-driven metadata work by inspection; whole-app acceptance not yet closed.
