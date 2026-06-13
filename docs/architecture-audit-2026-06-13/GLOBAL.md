# Global Rust / Backend Architecture Audit — ORGII (`src-tauri/`)

**Date:** 2026-06-13
**Scope:** Rust backend under `src-tauri/`, prioritizing `crates/agent-core/` (providers, session, coordination, tools, model_context, interaction, init), with cross-checks into `advanced-search` and the wider workspace crate graph.
**Mode:** Read-only analysis. **No source files were modified.** Audit and fix are separate concerns.
**Methodology:** `.orgii/skills/architecture-audit/SKILL.md` — 10-layer checklist (the user-global copy at `~/.orgii/skills/architecture-audit/SKILL.md` is absent; the in-repo workspace copy was used).

---

## Executive summary — Top issues for open-source readiness

This codebase is **unusually mature**. It has been through multiple prior audit cycles (the skill's own changelog cites ORGII incidents), and it shows: near-zero dead code (1 `#[allow(dead_code)]` in the whole crate), an explicit `ARCHITECTURE.md` map, documented naming conventions, a unified session-init entry point, correct `schemars` draft07 config, and a recently-unified HTTP-error-body sanitizer. The headline incidents the skill was written around (schemars `$schema` bloat, init-parity gaps, error-body HTML leakage) are **already fixed**.

The remaining problems are **systemic patterns**, not one-off bugs. Prioritized for an external-contributor audience:

| #      | Issue                                                                                                                                                      | Severity    | Why it matters for OSS                                                                                                                                                                                                                                                                                                                                                              |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1** | **UTF-8-safe truncation re-implemented 10+ times; one site is unguarded → latent panic**                                                                   | **High**    | Same class as the cursor_native multibyte panic. `flow_awareness/types.rs:262` slices a clipboard preview at a byte index with no char-boundary guard. A canonical helper (`providers::safe_truncate::safe_truncate_utf8`) already exists but is buried in `providers/` and ignored crate-wide.                                                                                     |
| **S2** | **Model-family/capability detection scattered as substring matching across 6+ files, violating the codebase's own stated single-source-of-truth contract** | **High**    | `model_capabilities.rs` declares itself "the ONLY place family substring patterns live" and cites an enforcement test — **that test does not exist**, and vision / tokenizer / knowledge-cutoff / reasoning detection all substring-match independently. Each has a silent `else` default, so a new model ships with wrong vision support, wrong tokenizer, stale knowledge cutoff. |
| **S3** | **Dual session-status enums with lossy, un-centralized down-mapping**                                                                                      | **Medium**  | `SessionStatus` (11 variants) and `AgentSessionStatus` (5) share wire strings. Widening has a `From` impl; the lossy narrowing is left to "application code" with no single function — risk of writing `"paused"` and reading it back as `None`.                                                                                                                                    |
| **S4** | **God test-modules inlined in `mod.rs`, inconsistent with the crate's own `#[path=...]` convention**                                                       | **Low–Med** | `inbox_drain/mod.rs` is ~30 lines of code + ~1,600 lines of inline `#[cfg(test)]`. Other modules (e.g. `weixin.rs`) externalize tests via `#[path]`. The inconsistency makes file-size and module-boundary reasoning confusing for newcomers.                                                                                                                                       |
| **S5** | **Misleading parameter name `is_channel_session` fed `has_gateway`** (dimension mismatch)                                                                  | **Medium**  | In `init/mod.rs`, `build_policy_context_activator(is_channel_session: bool)` is called with `cap_flags.has_gateway`. The parameter name lies about its dimension — exactly the skill's anti-pattern #11 / planning-rule #12.                                                                                                                                                        |

Semantic overloading of `inbox` and `gateway` is real but **already documented** in-code; treated as keep-with-reason below.

---

## Layer coverage

| Layer                      | Covered?        | Notes                                                                                                                                                                                                 |
| -------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Compilation correctness | **Partial**     | Did **not** run `cargo check`/`clippy` (read-only, multi-minute cold build cost on this workspace). Inspected clippy-relevant patterns statically (unwrap/expect/panic, dead code, allow attributes). |
| 2. Dead code & dedup       | **Yes**         | Dead code near-zero; two large duplication classes found (S1, S2).                                                                                                                                    |
| 3. Naming consistency      | **Yes**         | Doc-vs-code drift: a cited enforcement test does not exist (S2).                                                                                                                                      |
| 4. Semantic overloading    | **Yes**         | `inbox`, `gateway`, dual `*Status` enums.                                                                                                                                                             |
| 5. Default branch analysis | **Yes**         | Model-family `else` branches give wrong defaults for unknown/new models (S2).                                                                                                                         |
| 6. Cross-domain leakage    | **Yes (light)** | `foundation/` is clean of variant terms; the live concern is the `is_channel_session`/`has_gateway` flag (S5).                                                                                        |
| 7. New-dev confusion       | **Yes**         | God test files (S4), dual status (S3), scattered model logic (S2).                                                                                                                                    |
| 8. Wire protocol & serde   | **Yes**         | `schemars` draft07 + `meta_schema=None` correct; error-body sanitizer unified; cursor prost/serde `.expect()`s reviewed (keep-with-reason).                                                           |
| 9. Init parity             | **Yes**         | Single `init_session` → `ensure_session_initialized`; fast-path re-entrancy; good parity.                                                                                                             |
| 10. Resolver symmetry      | **Yes**         | Status conversion is asymmetric (widening `From` exists, narrowing does not); init model resolver is symmetric and well-documented.                                                                   |

---

## S1 — UTF-8-safe truncation: 10+ re-implementations + 1 unguarded panic

A canonical helper already exists:

```6:15:src-tauri/crates/agent-core/src/core/providers/safe_truncate.rs
pub fn safe_truncate_utf8(s: &str, max_bytes: usize) -> &str {
    if s.len() <= max_bytes {
        return s;
    }
    let mut end = max_bytes;
    while !s.is_char_boundary(end) && end > 0 {
        end -= 1;
    }
    &s[..end]
}
```

…yet the same `is_char_boundary` loop (or a `char_indices` equivalent) is hand-written all over the crate, and one site omits the guard entirely.

| Line                                                                                         | Element                                     | Verdict               | Reason                                                                                                                                                                                            | Suggested change                                                        |
| -------------------------------------------------------------------------------------------- | ------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `foundation/flow_awareness/types.rs:262`                                                     | `format!("{}...", &s[..MAX_PREVIEW_CHARS])` | **fix (panic)**       | Slices at a fixed **byte** index with no `is_char_boundary` check. A clipboard preview ending in a multi-byte char at the boundary panics — identical class to the cursor_native multibyte panic. | Replace with `safe_truncate_utf8(&s, MAX_PREVIEW_CHARS)`.               |
| `core/session/prompt/helpers.rs:33` (`cap_text`)                                             | bespoke boundary loop                       | fix (dedup)           | Re-implements `safe_truncate_utf8` + a suffix.                                                                                                                                                    | Call the canonical helper, then format the suffix.                      |
| `core/session/prompt/helpers.rs:63` (`truncate_preview`)                                     | bespoke boundary loop                       | fix (dedup)           | Third copy in one file.                                                                                                                                                                           | Same.                                                                   |
| `core/session/prompt/helpers.rs:74` (`truncate_at_boundary`)                                 | boundary loop + sentence snap               | keep core, dedup head | The sentence/newline snap is genuinely extra logic; the boundary loop is not.                                                                                                                     | Build on `safe_truncate_utf8`, keep the rfind snap.                     |
| `core/model_context/summarization.rs:9` (`truncate_for_summary`)                             | `char_indices` variant                      | fix (dedup)           | Different mechanism, same intent.                                                                                                                                                                 | Replace with canonical helper.                                          |
| `specialization/policies/activation.rs:99` (`cap_text_utf8`)                                 | boundary loop                               | fix (dedup)           | Re-implementation.                                                                                                                                                                                | Canonical helper.                                                       |
| `specialization/mcp/bridge.rs:81` (`truncate_description`)                                   | `char_indices` by char count                | keep with reason      | Truncates by **char count**, not bytes (Anthropic tool-name length is char-bounded). Distinct semantics from byte-bounded helper.                                                                 | Add a `safe_truncate_chars` cousin to the shared module and route here. |
| `integrations/channels/weixin.rs:563` (`clip_utf8`)                                          | boundary loop                               | fix (dedup)           | Re-implementation.                                                                                                                                                                                | Canonical helper.                                                       |
| `integrations/channels/wecom/outbound.rs:87`                                                 | boundary loop                               | fix (dedup)           | Re-implementation (mirror of weixin).                                                                                                                                                             | Canonical helper.                                                       |
| `core/tools/impls/web/control_external_browser/actions.rs:321` (`truncate_on_char_boundary`) | boundary loop                               | fix (dedup)           | Re-implementation.                                                                                                                                                                                | Canonical helper.                                                       |
| `foundation/utils/pill_resolver.rs:308`, `core/coordination/work_item_scheduler.rs:350`      | `&s[..end]` after local boundary loop       | fix (dedup)           | Two more guarded copies.                                                                                                                                                                          | Canonical helper.                                                       |

**Sweep verdict:** This is a textbook "fix the class, not the instance" finding. Promote `safe_truncate_utf8` (+ a char-count cousin) into a crate-wide util (`foundation::utils`), delete the ~10 local copies, and grep for any remaining `&...[..` byte slice over a `&str` to find stragglers. The single unguarded site (`flow_awareness/types.rs:262`) is the only one that can panic today.

---

## S2 — Model-family / capability detection scattered + unenforced contract

`model_capabilities.rs` states the intended invariant explicitly:

```21:24:src-tauri/crates/agent-core/src/core/providers/model_capabilities.rs
//! @[MODEL LAUNCH]: when a new model family ships, add ONE row to
//! [`FAMILY_RULES`]. Do not add substring checks anywhere else — the
//! `no_substring_capability_checks_outside_this_module` test in this file
//! is the enforcement point.
```

The referenced test **does not exist** anywhere in the crate (grep for `no_substring_capability_checks` returns only this comment). And model-derived behavior is decided by independent substring tables in at least five other production sites — none of which `model_capabilities::resolve` covers, each with a silent default for unknown/new models.

| Line                                                      | Element                                                        | Verdict             | Reason                                                                                                                                                             | Suggested change                                                                                                        |
| --------------------------------------------------------- | -------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `core/providers/model_capabilities.rs:23`                 | cited enforcement test                                         | **fix (doc drift)** | Doc claims a test guards the invariant; no such test exists. Either write it or stop claiming it (Layer 3/7).                                                      | Add the test (a compile-time/`grep`-based test or a `#[test]` scanning the module set), or correct the doc.             |
| `core/turn_executor/screenshot.rs:29` (`is_vision_model`) | `contains("gpt-4o") \|\| contains("claude-3") \|\| …`          | **fix**             | Vision is a _capability_ — belongs in `ModelCapabilities`. The `else → false` silently strips images for any unrecognized vision model (e.g. a new Gemini/GPT id). | Add `supports_vision: bool` to `ModelCapabilities`; resolve here.                                                       |
| `core/model_context/tokenizer.rs:42`                      | `starts_with("gpt-4o"/"gpt-5"/"o1"/"o3")`                      | fix                 | Tokenizer family is model-derived; unknown models silently get the default tokenizer → wrong token counts → wrong compaction triggers.                             | Add `tokenizer_family` to the family table.                                                                             |
| `core/session/prompt/section_builders.rs:769`             | `contains("claude-sonnet-4-6") \|\| …` knowledge-cutoff ladder | fix                 | Hard-coded cutoff dates per claude substring; a new model falls through to a stale default cutoff in the system prompt.                                            | Add `knowledge_cutoff` to the family table.                                                                             |
| `core/providers/openai_compat/types.rs:41`                | `starts_with("gpt-5"/"o1"/"o3")` reasoning detect              | fix                 | Reasoning detection duplicated vs `model_capabilities` thinking resolution + the KeyVault `reasoning` layer.                                                       | Route through `model_capabilities::resolve`.                                                                            |
| `core/providers/openai_responses/mod.rs:27`               | `contains("gpt-5")`                                            | fix                 | Fourth independent gpt-5 substring.                                                                                                                                | Same.                                                                                                                   |
| `core/providers/model_hints.rs:36,50`                     | family → provider-id guess                                     | keep with reason    | This is the _intended_ legacy table the module doc says it replaced for context-window/thinking; remaining uses are provider-routing hints.                        | Confirm it no longer decides context-window/thinking (those moved to `model_capabilities`); if clean, leave + document. |

**Sweep verdict:** Grow `ModelCapabilities` to cover vision, tokenizer family, knowledge cutoff, and reasoning, then collapse the five scattered substring matchers into `model_capabilities::resolve(...)`. Write the enforcement test the doc already promises. This is the single highest-leverage correctness fix for "what happens when someone adds a new model" (skill planning-rule #7).

---

## S3 — Dual session-status representation, asymmetric conversion

```16:24:src-tauri/crates/agent-core/src/core/session/types/enums.rs
/// ## Relationship with `AgentSessionStatus`
/// The `AgentSessionStatus` in `persistence::db_helpers` is a simplified subset
/// (5 states vs 11 here) used for database storage. This design:
/// - Maps detailed states (Pending, WaitingForUser, etc.) to coarser DB states
/// When persisting, application code should map this to `AgentSessionStatus`.
```

| Line                                                               | Element                                           | Verdict                      | Reason                                                                                                                                                                                                                                                                                                                                     | Suggested change                                                                                                                                                                                                                    |
| ------------------------------------------------------------------ | ------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/session/types/enums.rs:127`                                  | `impl From<AgentSessionStatus> for SessionStatus` | keep                         | Widening (5→11) is lossless and correctly centralized.                                                                                                                                                                                                                                                                                     | —                                                                                                                                                                                                                                   |
| `core/session/types/enums.rs:24` (doc) + absence of a narrowing fn | `SessionStatus` → `AgentSessionStatus`            | **fix (Layer 10 asymmetry)** | The _lossy_ 11→5 direction is delegated to "application code" with no single function. Both enums emit the same wire strings (`idle`/`running`/…), so a `SessionStatus::Paused.as_str()` (`"paused"`) written to a column later read by `AgentSessionStatus::parse` returns `None`. The narrowing decision must live in exactly one place. | Add `impl From<SessionStatus> for AgentSessionStatus` (or `SessionStatus::to_db()`), make all persistence writes go through it, and verify no `SessionStatus::as_str()` value is written into an `AgentSessionStatus`-typed column. |
| `db_helpers/mod.rs:203` & `session/types/enums.rs:27`              | two `*Status` enums w/ overlapping strings        | keep with reason             | The coarse/fine split is a deliberate, documented design (avoids DB migrations for UI-only states).                                                                                                                                                                                                                                        | Keep, but make the narrowing function the only bridge and reference it from both doc blocks.                                                                                                                                        |

---

## S4 — God test-modules inlined in `mod.rs` (module-org consistency)

The crate has a clear convention of externalizing large test suites (e.g. `weixin.rs` ends with `#[path = "tests/weixin_tests.rs"] mod tests;`). Several central modules violate it by inlining huge test bodies, which inflates `mod.rs` line counts and blurs the "what does this module export" boundary.

| Line                                                           | Element                                                          | Verdict          | Reason                                                                                                                                                   | Suggested change                                                           |
| -------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `core/session/turn/processor/inbox_drain/mod.rs:40`            | `#[cfg(test)] mod tests` (~1,600 lines in a 1,651-line `mod.rs`) | **fix (org)**    | `mod.rs` should be a thin façade (it is — ~30 lines of re-exports) but the inline test body makes it the largest file in the crate and hides the façade. | Move to `inbox_drain/tests/` via `#[path]`, matching the crate convention. |
| `core/interaction/plan_approval/mod.rs` (1,337 ln, 60 unwraps) | inline test module                                               | fix (org)        | Same pattern; the 60 `unwrap`s are test-only but inflate static scans.                                                                                   | Externalize tests.                                                         |
| `core/providers/cursor_native/request.rs:614`, `tools.rs:749`  | inline test modules (~400+ ln each)                              | keep with reason | Co-located with tightly-coupled wire-encoding internals; moving them buys less.                                                                          | Optional; lower priority than the two above.                               |

---

## S5 — `is_channel_session` parameter fed `has_gateway` (dimension/name mismatch)

```59:69:src-tauri/crates/agent-core/src/init/mod.rs
fn build_policy_context_activator(
    workspace_root: &Path,
    agent_id: &str,
    is_channel_session: bool,
    sovereign_prompt: bool,
) -> Option<Arc<crate::policies::activation::SessionScopedContextActivator>> {
    let policy_set = if is_channel_session || sovereign_prompt {
        crate::policies::load_enabled_policy_set_for_os_agent(agent_id)
    } else {
        crate::policies::load_enabled_policy_set(workspace_root, agent_id)
```

```582:587:src-tauri/crates/agent-core/src/init/mod.rs
    let policy_context_activator = build_policy_context_activator(
        &workspace_root,
        &resolved.agent_id,
        cap_flags.has_gateway,
        resolved.sovereign_prompt,
    );
```

| Line                       | Element                                              | Verdict                    | Reason                                                                                                                                                                                                                                                                   | Suggested change                                                                                                                                                                                                    |
| -------------------------- | ---------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `init/mod.rs:62` vs `:585` | param `is_channel_session` ← `cap_flags.has_gateway` | **fix (naming/dimension)** | The parameter name asserts a "message source" dimension but is fed a "capability" value. The skill's anti-pattern #11 is the exact prior incident where `is_channel_session` was used to drive workspace resolution. A future reader will assume the two are equivalent. | Rename the parameter to its real meaning (e.g. `use_os_agent_policy_set` or `has_gateway`), or pass an explicitly-named boolean. Verify `has_gateway` is the intended predicate for the OS-agent policy-set branch. |

---

## Layer 8 — Wire protocol & serde (clean, with one keep-with-reason)

| Line                                                      | Element                                                                    | Verdict          | Reason                                                                                                                                                                                                                                                                                 |
| --------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/tools/params.rs:69`                                 | `SchemaSettings::draft07().with(meta_schema=None)`                         | keep             | Correct fix for the historical `openapi3()` `$schema` bloat incident. No `openapi3` usage remains.                                                                                                                                                                                     |
| `core/providers/http_error_body.rs` + `safe_truncate.rs`  | shared error-body sanitizer                                                | keep             | Already unified; all provider clients route through `clean_error_message`. The duplication the prompt referenced has been resolved.                                                                                                                                                    |
| `core/providers/cursor_native/request.rs:447,578,591,610` | `serde_json::to_vec(...).expect(...)` / `prost ...encode(...).expect(...)` | keep with reason | Encoding a `json!` literal or a prost message into a pre-`encoded_len()`-sized `Vec` is infallible in practice; failure would indicate a logic bug, so panicking is acceptable. Worth a one-line `// infallible: pre-sized buffer` comment for OSS readers, but not a real panic risk. |

---

## Positives worth preserving (so the next pass doesn't re-flag)

- **Dead code is effectively zero** (1 `#[allow(dead_code)]` crate-wide). Do not run a dead-code sweep expecting finds here.
- **Init parity is solid**: one `init_session` → `ensure_session_initialized` path with a documented fast-path; the E2E-endpoint registration gap from the skill's history is gone.
- **`error swallowing` is rare**: `unwrap_or_default()` appears scattered but low, and several call sites have explicit comments explaining why a silent default would be wrong (e.g. `prompt/helpers.rs` project-slug listing).
- **Naming-collision discipline is enforced in-code**: `agent_inbox.rs` and `db-clients` both carry "NOT to be confused with…" module docs. Keep this convention.

---

## Recommended fix ordering (if/when a fix PR is opened — out of scope here)

1. **S1 panic site** (`flow_awareness/types.rs:262`) — one-line, prevents a crash. Then the truncation-dedup sweep.
2. **S2** — grow `ModelCapabilities`, collapse the 5 substring matchers, write the promised enforcement test.
3. **S3** — add the single narrowing conversion; audit persistence writes.
4. **S5** — rename the misleading parameter.
5. **S4** — externalize the two largest inline test modules.

Each is independently landable and independently verifiable with `cargo check -p agent_core`.
