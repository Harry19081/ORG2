# Remote session pages audit

| Line                  | Element           | Verdict          | Reason                                                         | Suggested change |
| --------------------- | ----------------- | ---------------- | -------------------------------------------------------------- | ---------------- |
| SessionsScreen.tsx:61 | Load more / retry | keep with reason | Shared Button exposes loading and disables offline interaction | None             |
| SessionsScreen.tsx:57 | Limit message     | keep with reason | Explicit bound disclosure; no grouping/filter UI is restored   | None             |

Totals: fix 0; keep with reason 2; abstract 0. Light/dark/physical-device screenshots were not captured.

## Architecture findings — not ready

Audited ingress snapshot → RPC adapter → provider pagination → flat list (ownership, types/wire, state machine, transformations, bounds). Provider history ingestion, database schema migrations and unrelated tooling were skipped because unchanged. Optional workspace metadata preserves older callers; no persistent migration. Rollback reverts additive fields and pagination together; old clients ignore new fields and new clients stop after one page if hasMore is absent.

**P1: filtered snapshot offsets are inconsistent.** In `session.rs`, snapshot is skipped by raw offset, then filtered and limited, but nextOffset advances by limit instead of raw consumed rows. Example [idle,A-running,idle,B-running,C-running], limit 2: first page returns A/B; offset 2 returns B/C. This is a producing-boundary bug, not a UI-filter problem. The current UI requests the unfiltered list, but the RPC running filter is affected. Require source-level regression and corrected cursor semantics before ready. No persisted data was modified or cleaned.

**P2: parent roster refresh is not single-flight.** Concurrent invalidations issue duplicate requests; a generation guard only discards stale completion. See runtime audit in #1380.

| Area               | Verdict | Evidence                                                            | Change or reason kept                     | Verification                                |
| ------------------ | ------- | ------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------- |
| Background work    | fix     | Parent hook starts a request per invalidation                       | Needs single-flight/coalescing            | Static trace; not fixed here                |
| Memory             | keep    | UI stops advertising more after offset 1000; server limit is capped | No eager full history load                | Unit coverage only; physical RSS unmeasured |
| Scope/isolation    | keep    | Client identity and generation checked after calls                  | Old transport cannot overwrite new roster | Parent tests                                |
| Rendering/hot path | keep    | Flat list retained, no grouping/sort introduced                     | User-requested filter removal preserved   | SessionsScreen regression                   |

Verification: targeted SessionsScreen test passed; full Rust desktop adapter tests/build and device measurements have not run. Narrow protocol-crate tests from the parent do not validate this adapter. Performance verdict: fail — duplicate invalidations remain, plus filtered pagination correctness is blocked. This is a Draft inventory of existing changes, not a release approval.
