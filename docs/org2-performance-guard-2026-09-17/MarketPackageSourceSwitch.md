# Package source switch: snapshot before native child creation

## Failure and source invariant

The private f1f40ad55 desktop artifact completed two Claude Code calls. Switching the same conversation to another Package created `cliagent-1789657228377-ee35ddf83ae148908527eaad45a7b3dd`, then failed before dispatch. The frontend log at local 2026-09-17 08:00:28.492 reports `QueuedConversationRecoveryPendingError: provider-native conversation changed while its canonical timeline was being read`. Read-only SQLite inspection found pending status, no native transcript binding, no turn intent and zero chunks. The prior source session was completed with two completed turn intents. The source selections differed. This is a local preparation failure; it does not establish a provider or settlement failure.

The canonical child catalog is authoritative. The no-compatible-runtime path previously created a native child before reading its source timeline. That child immediately entered the catalog with a null native revision, making its own canonical snapshot unstable on every attempt. Its already-published runner receipt retained the queue recovery state.

The fix takes the consistent source snapshot before creating a fresh execution, while the singleton durable queue holds its existing root lock. The new child cannot contaminate that snapshot. Native materialization, source identity checks, owner authorization, round-trip validation and provider dispatch retain their existing order after creation. Other creation paths already receive frozen timelines. Missing or changing native history still fails closed; no child is globally ignored and null revisions are not treated as empty history.

## Timing, lifecycle and limits

The tradeoff is later publication of the native pending row for large histories. The durable delivery already exists in `preparing` state. `withCanonicalConversationTurnLock` holds its Web Lock across the complete awaited execution; it has no lease timeout. No concrete `prepareUserIntent` starts during the snapshot, so its 60-second dispatch dead-man is not armed. After creation, `confirmUserIntentPreparation` still promotes the generation before native materialization. No timer, cache, background scan or subscription is added.

An already-created empty child is not repaired by this source fix. Stop/Retry cannot manufacture its missing transcript; the normal delete-session handler can delete an individually addressable CLI child, but a reliable GUI route to this particular internal child has not been verified. No test database or history was changed. Preserve the failed fixture and verify new source switching on a fresh root; do not claim this repairs the old Sending state or automatically deletes it.

## Verification

- Continuation, canonical snapshot and ConversationContinuation regressions: 4 files, 108 tests passed.
- The new regression uses the real canonical snapshot loader and the native catalog boundary: a created child is immediately visible but its native revision stays null until materialization. While a deferred snapshot is pending, no child or provider send exists. A successful snapshot carries the original history and the newly selected Package into exactly one created execution and one dispatch.
- Failed snapshots now assert no created child, lifecycle mutation or provider send. Existing source propagation tests fail at materialization after creation so they still exercise the actual source write boundary.
- Full `tsgo --noEmit --pretty false`, changed-file ESLint and `git diff --check` passed.
- Independent source review approved the change. New-source GUI switch/restart and resource measurements remain pending; earlier f1 runtime evidence does not validate this source.

## Architecture review

| Layer                     | Verdict   | Evidence                                                                        |
| ------------------------- | --------- | ------------------------------------------------------------------------------- |
| 1 Compilation             | pass      | Full TypeScript check and changed-file lint                                     |
| 2 Ownership/deduplication | fix       | Root queue still owns one execution; snapshot precedes publication              |
| 3 Naming                  | keep      | Existing snapshot/child terminology; creation comment corrected                 |
| 4 Domain semantics        | keep      | Preparing child is not provider acceptance or durable history                   |
| 5 Defaults                | keep      | Null/unstable native revisions still fail closed                                |
| 6 Boundaries              | fix       | Source read completes before the native catalog write                           |
| 7 Discoverability         | fix       | Comment records the concrete self-contamination hazard                          |
| 8 Wire protocol           | unchanged | No RPC/schema changes                                                           |
| 9 Init parity             | unchanged | No startup or instance-path changes                                             |
| 10 Resolver symmetry      | keep      | CLI and SDE fresh creation share the same snapshot boundary; reuse is unchanged |

## Performance and lifecycle review

| Area               | Verdict | Evidence                                                       | Change or reason kept              | Verification                                              |
| ------------------ | ------- | -------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------- |
| Background work    | keep    | Existing root lock and demand-triggered read                   | No timers or extra reads           | Source trace and single-read regression                   |
| Memory             | keep    | One existing timeline retained for materialization             | No new registry/cache/copy         | Frozen timeline passed by reference                       |
| Scope/isolation    | keep    | Root lock plus unchanged runtime/source/owner checks           | No ambient credential fallback     | Exact Package source and model assertions                 |
| Rendering/hot path | fix     | Pending native child previously caused repeated recovery reads | Publish only after stable snapshot | Deferred-read regression; runtime performance not claimed |

| Provider    | Raw transition                                | App/UI state          | Topology/boundary                | Expected invariant                                              | Observed evidence                                       |
| ----------- | --------------------------------------------- | --------------------- | -------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------- |
| Claude Code | Switch Package after completed turns          | Existing f1 root open | Isolated Instance 89             | One new execution after complete old history                    | Actual failure and zero accepted intents recorded above |
| Claude Code | Pending native child becomes materialized     | Unit catalog fixture  | Actual canonical snapshot loader | No self-read before materialization; one dispatch               | Regression passed                                       |
| Claude Code | Source switch on fixed artifact, then restart | GUI                   | Isolated desktop                 | Successful selected-source call without replay or double charge | Not run in this change                                  |
| Codex / SDE | Fresh Package creation                        | Unit boundary         | Source write/materialization     | Preserve selected source without Account Key fallback           | Existing regression passed; no new GUI claim            |
| All         | Idle/hidden/close/delete                      | Runtime               | Resource lifecycle               | No added background resource                                    | Source inspection only; no new CPU/RSS claim            |
