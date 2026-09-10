# Codex resend rollout identity

## Finding and owning boundary

Read-only inspection of native Codex data found 12 rollout files for one thread. Their filenames include both `rollout-<timestamp>-<thread UUID>` and `rollout-<timestamp>-<thread UUID>_<rollout UUID>`. Every inspected `session_meta.payload.id` retained the original thread UUID; the native threads table points to the latest rotated file. These are physical generations of one thread, not independent forks. No personal transcript content, identifiers, or absolute user paths are included here.

ORGII discovery used each file stem as a separate imported cache key. The metadata parser did not persist top-level continuation identity, the Codex sync omitted continuation election, and filename extraction confused the final rollout UUID with the thread UUID. The producing path is `discover_codex_app_records` → metadata parsing → `sync_source_cache_from_conn` → imported session listing/exact lookup.

The source invariant is now one listable representative per native Codex thread. Fresh parses derive identity from `session_meta.id`; existing cached rows and older resumed watermarks recover it from the native filename contract. The existing continuation election and exact-ID lookup enforce the same verdict. True forks retain their own `session_meta.id`, regardless of shared prompt content or `forked_from_id`.

The same thread decoder now serves title-index lookup and CLI resume planning. Managed ledger UUIDs recognize rotated file keys, and native cache-path lookup recognizes the persisted thread identity.

## Historical remediation and compatibility

Repair updates only derived cache metadata/listability during ordinary sync. It preserves all native files, historical cache rows, session IDs, and incremental watermarks. The parser version is unchanged: large rollouts are not forced through a cold parse just to add identity. A local inspected rollout was about 3.5 GiB, making that constraint material. Warm rescans are tested to perform zero additional SQLite row changes.

No schema, dependency, network protocol, or user configuration changes. Reverting the code and rebuilding the derived cache restores the previous projection; raw history needs no recovery. Existing active/revealed-row handling consumes the established continuation lineage field.

## Claude Code check

Inspected 189 local top-level Claude JSONL files. Some copied/continued files preserve earlier session metadata and first-message UUIDs. The existing Claude parser already records first-user and compact-boundary UUIDs and invokes continuation election. A regression fixture replaces the first user message UUID in the same source file and verifies repeated authoritative cache upserts retain one visible session with the replacement content. No Claude production change was needed. This does not claim every Claude rewrite or explicit fork mode was exercised live.

## Verification

Rebased only this fix onto the latest `develop`; resolved the appended Claude-test conflict by retaining both tests. Reran the Rust suite, scoped Clippy and all three sidebar/cloud test files after integration.

- `cargo test --manifest-path src-tauri/Cargo.toml -p orgtrack_core --lib --quiet`: 644 passed, 8 ignored, 0 failed after rebasing onto the latest develop.
- `cargo test --manifest-path src-tauri/Cargo.toml -p orgtrack_core resend --lib --quiet`: 3 passed after adding the zero-write warm-scan assertion.
- `cargo clippy --manifest-path src-tauri/Cargo.toml -p orgtrack_core --lib --tests -- -D warnings`: passed.
- `./node_modules/.bin/vitest run --config config/vitest.config.ts src/store/session/sessionAtom/__tests__/sidebarLoaders.test.ts src/scaffold/NavigationSidebar/connectors/useSessionMenuItems/__tests__/continuationVisibility.test.ts src/features/Org2Cloud/org2CloudSyncEngine.vanishedSweep.test.ts`: 32 passed. Existing Vite/Jotai deprecation warnings remain.
- `git diff --check`: passed.
- Changed Rust files formatted directly with `rustfmt --edition 2021 --config skip_children=true`; crate-wide format check reports pre-existing formatting in untouched modules, which was not swept into this fix.
- Initial test attempts caught a test-fixture NOT NULL violation and a Clippy test assertion warning; corrected and rerun. An initial Vitest invocation omitted the repository config and failed alias resolution; the command above uses the required config and passes.
- No frontend source changed; no TypeScript typecheck was required. Full Tauri build, actual resend clicks against this new binary, CPU/RSS measurements, and live cloud topology tests were not run. An available desktop test instance is running other work and is not this worktree's binary.

## Lifecycle review

| Area               | Verdict | Evidence                                                                 | Change or reason kept                                                                                        | Verification                                                               |
| ------------------ | ------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Background work    | keep    | Existing source sync owns discovery, metadata parsing, and cache updates | No timer, worker, retry loop, subscription, or extra filesystem scan; add source-local cache repair/election | Repeated sync and reopen tests; zero-write warm scan                       |
| Memory             | keep    | Repair streams cached rows; managed IDs remain scoped to one sync        | Adds only discovered rotated aliases to the transient ID set; uses existing election structures              | Code trace; no live RSS claim                                              |
| Scope/isolation    | keep    | Every query is scoped to `codex_app` in the supplied connection          | No global cache or change to provider roots                                                                  | Isolated on-disk cache fixture; independent fork and managed-binding tests |
| Rendering/hot path | keep    | No rendering or streaming-delta code changed                             | Reuse established lineage projection and revealed-row handling                                               | 32 sidebar/cloud unit tests                                                |

| Provider    | Raw transition                                                               | App/UI state                              | Topology/boundary                                      | Expected invariant                                                          | Observed evidence                       |
| ----------- | ---------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------- | --------------------------------------- |
| Codex       | Create → rotated same-thread rollout                                         | Old ID queried before and after live sync | Isolated raw files → production discovery/parser/cache | One visible thread; old exact lookup suppressed; historical lookup retained | Passed regression fixture               |
| Codex       | Independent fork with same prompt                                            | Both source files present                 | Same local ingest boundary                             | Fork remains independent                                                    | Passed regression fixture               |
| Codex       | Legacy metadata repair → repeated scan → connection reopen                   | Existing cached identity retained         | On-disk cache                                          | Stable lineage, row count and watermark; zero warm-scan writes              | Passed regression fixture               |
| Codex       | Managed binding added after discovery                                        | Cached rotated file                       | Native ownership and resume/path/title resolution      | Managed mirror hidden; real thread UUID used                                | Passed regression fixture               |
| Claude Code | First user UUID replaced in same file → repeated upsert                      | Same canonical cache ID                   | Raw parser → authoritative cache writer                | One session with replacement content                                        | Passed new fixture                      |
| Both        | Actual resend in rebuilt Tauri; visible/hidden/closed; cloud upload/download | Active/open/pinned/restart                | Live UI and machine topology                           | One visible conversation and bounded resources                              | Not run; existing UI unit coverage only |

## Architecture review

Covered compilation, duplicate decoders, naming/semantic separation of thread and rollout, malformed-input defaults, provider scope, local serialization, production/test sync initialization parity, and lookup/resume symmetry (layers 1–10). Network wire inspection was inapplicable because no network payload changed. This is a scoped bug-fix review, not a repository-wide architecture audit.

Performance verdict: blocked — runtime CPU/RSS and rebuilt Tauri lifecycle measurements were not executed. Source-boundary regression tests pass; no unmeasured performance improvement is claimed.
