# ORGII E2E Testing

ORGII keeps two separate E2E surfaces. Do not use one as proof for the other.

1. **Core UI E2E** — `tests/e2e/specs/core/`, driven by WebDriverIO against the debug-built Tauri app.
2. **Rust runtime E2E** — `src-tauri/crates/e2e-test/`, a Rust HTTP client against debug-only `/agent/test/*` endpoints.

A Rust HTTP scenario can prove runtime state. It does not prove a user can see, click, or recover through the rendered UI. If a feature has a button, card, menu item, wizard field, status pill, or visible chat behavior, it needs rendered UI coverage.

## Core UI E2E policy

`tests/e2e` is the final UI regression suite. Keep it small and clean.

Rules:

- Extend an existing core spec before creating a new one.
- Do not put historical audits, migration sweeps, subsystem experiments, or one-off debug specs under `tests/e2e`.
- Every UI spec must perform a real rendered action or assert a real rendered result. Debug helpers may seed state, but cannot be the only proof.
- Provider capacity failures, especially Gemini 429/rate-limit/capacity errors, are infra/provider issues unless ORGII mishandles the rendered error or runtime state.
- OAuth refresh failures with permanent invalid-token messages are account health blockers. ORGII should record the failure and disable the account immediately; UI E2E should report them separately from product regressions and continue through configured account/model fallback chains when available.

## Anti-false-prosperity policy

A green E2E result is not accepted unless it proves the production behavior being claimed.

- Do not mark a scenario `PASS` when the critical action is replaced by a frontend mock, synthetic success flag, debug-only responder, or helper that bypasses the production command/event path.
- Debug helpers may establish deterministic preconditions, but the user-visible action under test must still use the production click/command/dispatcher path.
- Do not use corrective follow-up prompts, extra retry prompts, or stronger second instructions to make an agent pass after the original user path failed. The first-path failure is the product signal.
- Do not count a matrix run as proof for multiple labels unless each requested label produced independent evidence. Combined fallback output is not per-label proof.
- Do not promote old green rows after prompt text, harness setup, account fallback, or product semantics changed. Rerun only the affected rows and record current-code evidence.
- For interactive cards, assert the full lifecycle: rendered reason/body, actionable button, production response command, backend/runtime state change, and final rendered state. A pill text change alone is not enough.
- For mode/tool claims, assert session-scoped effective tools (`agent_list_effective_tools_for_session`, `/agent/test/effective-tools/:session_id`, or `__e2e.listEffectiveToolsForSession`) rather than global registry or historical renderability.
- Treat provider quota/capacity blocks as `BLOCKED`, not `PASS`; never route around them silently to manufacture green coverage.

## Workspace fixture policy

Core UI E2E must not depend on `yorg_frontend`, `yoyo-evolve`, or any external local project.

The WDIO runner creates a self-contained git fixture repo by default:

- Path: `/tmp/orgii-e2e-workspace-repo`
- Rebuilt at runner startup
- Contains `README.md`, `package.json`, `src/math.ts`, and an initial git commit
- Safe for agent mutation tests

Only set `E2E_REPO_PATH` when intentionally overriding with another sandbox git repo. The runner must reject explicit paths that do not exist, are not git repos, or lack the baseline files.

Session launch specs should pass the fixture `repoPath` through the same session configure/launch caller path the user uses. Do not add a separate `before` hook that only calls `ensureRepoSelected`; that helper can time out before the app is fully settled and can mask the real launch path with WebDriver harness failures.

Recommended isolated UI run when the developer app may already be using `1998`:

```bash
E2E_ISOLATED_RUN=1 \
E2E_ORGII_HOME="/tmp/orgii-e2e-home" \
E2E_FRONTEND_PORT=21998 \
E2E_WEBDRIVER_PORT=24444 \
E2E_IDE_SERVER_PORT=23847 \
npm test
```

WDIO managed runs must not kill or reuse a developer's active ORGII app by default. The runner should fail fast if its managed ports are occupied unless `E2E_ALLOW_PORT_CLEANUP=1` is explicitly set. When `E2E_FRONTEND_PORT` differs from `1998`, the WDIO runner must make that real by building the webdriver debug app against a temporary Tauri `devUrl` pointing at the requested port, then restoring `src-tauri/tauri.conf.json` exactly. Merely starting webpack on a non-1998 port is false isolation because an unpatched debug app still loads `http://localhost:1998`.

## Rust runtime E2E policy

`e2e-test` is a deterministic runtime contract suite, not a second UI suite and not a live-provider platform matrix. Keep it much smaller than the historical audit-era suite.

Keep:

- Backend/runtime invariants not covered by rendered UI E2E.
- Deterministic debug-endpoint coverage for memory, learning, permissions, worktree, session recovery, housekeeping, LSP, gateway/sync/MCP contracts, subagent dispatch, and tool execution invariants.
- Tool-policy and agent-definition contracts that are hard to observe from UI alone, especially positive/negative schema or policy assertions. Use the session-scoped effective-tools surface (`agent_list_effective_tools_for_session`, `/agent/test/effective-tools/:session_id`, or `__e2e.listEffectiveToolsForSession`) rather than global `list_all_tools` or registry-only `/agent/test/tool-schemas/:session_id` when asserting what a running agent can actually see in a mode-filtered prompt.
- Scenarios with stable setup, stable assertions, and explicit teardown/isolation.

Delete or move out:

- Historical phase/audit scenarios whose invariant is already covered by a canonical scenario.
- Long-running live-LLM scenarios that mainly duplicate UI/platform matrix behavior.
- Provider-specific smoke tests that are better covered by core UI matrix rows.
- Memory/learning tests that only prove the model can recall rendered text; keep state/DB/policy pins instead.
- Plan lifecycle tests that assert user-visible card/button behavior; keep only backend policy/snapshot invariants in Rust.
- Scenarios whose only assertion is `HTTP 200` or loose text without a stable invariant.
- Dead helper modules/functions not registered in `main.rs` and not called by a registered scenario.

When cleaning Rust E2E:

1. Inspect `src-tauri/crates/e2e-test/src/main.rs` scenario registry.
2. Count groups with `cargo run -p e2e-test -- --list` or a local registry parser.
3. Remove entries only when their invariant is duplicated, obsolete, flaky by design, or moved to UI E2E.
4. Delete the module/function after removing the registry entry.
5. Run `cargo check -p e2e-test` and `cargo fmt`.

## Choosing the right layer

| Claim                                  | Required coverage                                                                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Runtime state/tool behavior is correct | Rust `e2e-test` or deterministic debug endpoint                                                                                    |
| Tauri command shape is correct         | Command call plus TypeScript contract/type check                                                                                   |
| Card/button/menu/slash action works    | WDIO rendered-app test                                                                                                             |
| Configurable UI field works            | Five-layer alignment plus rendered submit-path coverage                                                                            |
| Unsupported feature is gone            | Negative UI assertion and/or backend action-list assertion                                                                         |
| Provider returns 429/capacity          | classify as provider capacity unless ORGII mishandles it                                                                           |
| Agent has the right tools              | session-scoped effective-tools API plus backend schema/policy negative+positive test; add UI smoke only when the tools are visible |

## Commands

Rust runtime:

```bash
cd src-tauri
cargo run -p e2e-test -- --list
cargo run -p e2e-test -- --scenario plan-mode-denies-writes
cargo run -p e2e-test -- --group memory
cargo check -p e2e-test
cargo fmt -p e2e-test
```

Core UI:

```bash
cd tests/e2e
npm test
npm test -- --spec './specs/core/session-plan-ui.spec.mjs'
E2E_CONTROL_SCENARIOS=plan-update npm test -- --spec './specs/core/session-controls-ui.spec.mjs'
E2E_CONTROL_SCENARIOS=plan-edit-resend npm test -- --spec './specs/core/session-controls-ui.spec.mjs'
```

## Result-driven orchestration regressions

Rendered orchestration tests must start from the final user result and durable end-state, not from implementation breadcrumbs. A test that creates rows/cards but would still pass when a run stops with incomplete work is a false positive.

For Agent Org / multi-member / queue scenarios, every complex spec should state or encode:

- Final user outcome: what the org/team should have achieved.
- Final DB invariants: run status converged; all completed tasks are actually completed; open work is visibly blocked/abandoned; no `in_progress` task lacks an owner.
- Final UI evidence: resident member sessions are visible and switchable in the left sidebar, member transcripts open, and task board status does not contradict run/session state.
- Runtime path evidence: production launch, task tools, member wake/drain, inbox delivery, and member-session messaging paths ran; debug helpers only seed or inspect.
- Anti-false-positive checks: scenario-named tasks, passive inbox rows, synthetic cards, or a second corrective prompt do not count as success.
- Latest-session evidence: after a user reports a stuck or contradictory Agent Org run, inspect the newest run/session/task/inbox durable state and the latest terminal/app log before claiming the fix is verified. Do not infer success from an older green scenario or from a different synthetic run.

A Rust runtime E2E that posts protocol messages or calls debug endpoints is not proof that Agent Org works in the app. Rendered Agent Org acceptance must drive the production launch path from the UI, wait for production wake/drain/member-session turns, and then assert both UI and durable DB finality. Unit tests and Rust E2E can pin regressions, but they cannot be used as the sole evidence for “Agent Org advances correctly.”

Minimum failure cases that a valid Agent Org spec must catch:

- A `running` run with `pending` / `in_progress` tasks, no active member session, and no unread inbox work to wake/drain.
- A ready assigned `pending` task whose dependencies are all completed, but whose owner has no unread `TaskAssigned` inbox row and no active member turn.
- Unread org inbox rows that remain unread after the owner/member production session has gone idle/completed a turn.
- `status = "in_progress"` with `owner = null`, or `status = "in_progress"` set by the coordinator for another member rather than by the owning member's claim/drain path.
- A `completed` run that still has `pending` or `in_progress` tasks.
- Member sessions visible in the coordinator overview but absent from the left sidebar.
- Multiple org members sharing the same `agent_id` / `agent_definition_id` while inbox delivery, wake, drain, task owner, and task-tool authorization are only keyed by `agent_id`.
- A run that appears visually populated but cannot make forward progress from the original user prompt without a corrective second prompt.

## Plan, rewind, and streaming regressions

Rendered plan tests must pin the caller path, not only derived UI helpers:

- Rewind/edit-resend must invalidate stale queued turns and cancel the active turn before sending the replacement message.
- Plan update/edit-resend tests must assert no duplicate pending/drafting cards, only the latest plan is buildable, and stale revisions remain visible only as archived history when appropriate.
- Plan card diagnostics must distinguish surfaces by `data-plan-surface`: `transcript` cards in chat history, `current` cards in the pending review bar, and communication-side preview cards.
- Stop/Send button E2E clicks must be atomic with the expected `data-state`.
- Long-running debug HTTP endpoints must be called from the WDIO Node process, not through `browser.executeAsyncScript(fetch(...))`.
- Streaming marker assertions must wait for the full expected marker, not only for assistant text to become non-empty or change.

## Hard rules

- Never change product business semantics to make an E2E pass. E2E fixes should wire the existing backend/runtime path, assert the current UI contract, or expose a real product bug.
- Never run mutation-capable UI E2E against `yorg_frontend`.
- Never claim “E2E passed” after only running unit tests, focused module tests, `cargo check`, or Rust protocol/debug-endpoint scenarios. Name the exact surface that passed: unit, Rust runtime E2E, or Core UI E2E.
- Never add a rendered UI claim to Rust-only coverage.
- Never add a debug endpoint that tests only a helper when the bug is in the caller path.
- Never preserve an obsolete scenario just because it once caught a phase bug; keep the invariant, not the phase artifact.
