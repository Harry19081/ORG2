# Explicit Claude Desktop conversation handoff

The package Claude Desktop profile keeps its own configuration and transcript copy. Opening it imports missing primary conversations, but later continuations previously remained in whichever profile wrote them. App connections now offers an explicit list, selected-conversation inspection and one-conversation sync for an already paired conversation.

This transfers compatible user/assistant message payloads and completed tool results. It does **not** transfer the source environment, project instructions, runtime prompt/tool definitions, permissions, account configuration, or Desktop indexes. User/assistant UUIDs and message payloads are preserved; parent UUIDs may be redirected across omitted runtime records. It is not a lossless copy of the source execution environment.

## Boundaries and recovery

- Native code derives the current Cloud owner, package profile and primary roots. IPC accepts a list/inspect/sync mode and an optional session UUID; inspect/sync require one UUID.
- List reads only the active primary/local catalog metadata and labels paired rows **Unchecked**. It does not read all transcripts. Inspect reads only the selected pair using the same reconciliation plan used by sync. It does not create locks, backups, journals or baselines, repair configuration metadata, recover transactions, or inspect/stop processes. Identical, incompatible and conflicting histories have distinct results. Only a compatible continuation or verified recoverable journal permits the explicit sync action.
- Sync validates the selected UUID, Desktop ID and cwd in both catalogs, active account IDs, profile configuration and owner epoch before commits. Duplicate matching catalog entries are ambiguous; an unrelated unmatched Desktop ID cannot hide a valid pair.
- Claude Desktop and Claude Code must have exited. Unknown process state fails closed. The exact installed `/Applications/Claude.app/Contents/Helpers/chrome-native-host` browser bridge is excluded after local signed-binary/socket/log inspection; other Claude Helpers, copied app paths and all CLI child processes remain writer candidates. This is a narrow compatibility assumption, not OS-enforced write confinement. Kernel process inspection is a bounded snapshot, **not** a lock honored by official applications; an independently launched writer can still race after the last check. ORG2 uses adjacent nonblocking locks, checks file identity and bytes again before replacement, and never kills or launches an application from this feature.
- Symlinks, hardlinks, foreign-owned files, malformed/rewound/branched records, unknown runtime formats, incomplete tool pairs, pending queues, thinking payloads and unaudited tools are refused. New source queued text must be dequeued and exactly match a retained user message.
- Known runtime attachments are omitted only after field allowlist validation. Source/target hashes and parent-basis hashes form a persistent projection ledger. The two physical transcript baselines advance independently, supporting repeated and reverse handoffs without treating deliberate parent changes as conflicts.
- A backup and pending journal precede transcript replacement. An interrupted operation is offered for explicit recovery only when recorded source/target hashes still match. Changed files are preserved for manual inspection; no blind rollback occurs.

For recovery outside the UI, quit all Claude writers and preserve both transcripts plus the profile's `history-handoff` directory first. The backup is the selected destination's preimage. Do not replace a newer transcript with that backup without checking its subsequent history. Removing the feature does not change existing transcript files or Claude configuration; retain its journal until any pending operation is resolved.

## Resource and lifecycle audit

There is no startup scan, timer, polling, background sync or retained worker. Listing never scales transcript I/O with roster size; inspection reads only the selected pair. Each click owns a finite blocking task: at most 128 pairs, 16 MiB per transcript/output, 128 MiB file reads and a cooperative 15-second deadline. Parsing and projection check the deadline; output/ledger growth is bounded. Closing/unmounting the panel drops its owner subscription and prevents late UI publication. Owner transitions clear the preview and revoke native writes.

Architecture review covered ownership, IPC validation, filesystem boundaries, serialization/compatibility, process lifecycle, recovery and testability. Network/provider transport and database layers are unchanged. Performance verdict: bounded explicit I/O with no idle work; actual GUI latency and power usage remain native acceptance items rather than claims based on typechecking.

## UI consistency audit

| Line / element                  | Verdict          | Reason                                                                   | Suggested change |
| ------------------------------- | ---------------- | ------------------------------------------------------------------------ | ---------------- |
| List, Inspect and Sync controls | keep with reason | Shared Button props provide sizing, disabled and loading semantics       | None             |
| Conversation picker             | keep with reason | Shared Select preserves keyboard support and accessible label            | None             |
| Section shell and status        | keep with reason | Existing Section components, semantic theme classes and live status text | None             |

Fix candidates: 0; keep with reason: 3; abstractions: 0. Production source inspection found no raw button/input or clickable substitute controls. Native screenshots and interaction acceptance are pending the combined test build.

## Verification scope

Temporary-file Rust fixtures cover byte-preserving read-only preview, explicit single-UUID sync, owner/account/cwd binding, duplicate catalog pairing, conflicts, strict formats, incomplete tools/queues, identity/link checks, finite limits, independent baselines and interrupted writes. UI tests cover no mount work, explicit UUID selection, read-only/unsupported states, safe errors, logout/identity transitions and recovery actions.

Opt-in native tests use temporary HOME/config/project directories, a localhost fake SSE server and a macOS outbound-network sandbox. Two ordinary CLI resumes retain destination runtime definitions and source conversation payloads. Completed historical tools are not re-executed; a fresh Read calibrates the execution detector. These are native compatibility checks, not paid model calls or Claude Desktop GUI acceptance.

Real-profile inspection remains read-only: copied fixtures run through production reconciliation only inside temporary directories. A representative package continuation is compatible; a separate history containing `edited_text_file` remains unsupported. Large histories can exceed the stated limits. The implementation deliberately reports those limitations instead of marking all daily sessions supported.

### Runtime-format evidence

The real copied continuation exercised sandbox instructions, environment, model identity, MCP instruction deltas, skill listing, token reminders, project instructions, session context, date, remote-session metadata and prompt snapshots. Its successful body projection preserves messages while deliberately excluding that source context. A synthetic native two-resume fixture additionally exercises a `deferred_tools_delta` marker and proves it never reaches the resumed request. This is collective integration evidence, not a claim that every possible payload of every listed format was independently tested. Unknown keys or new formats require renewed review; `edited_text_file`, new thinking payloads and unaudited tools remain refused.

### Verified commands and remaining acceptance

- `cargo test --manifest-path src-tauri/Cargo.toml -p org2 --lib claude_history_handoff -- --nocapture`: 28 passed, five explicit opt-in fixtures skipped.
- The same compiled test binary with `claude_history_handoff --include-ignored --nocapture`, supplied read-only audit transcript/profile paths: **33 passed**, including all five opt-in fixtures. The real metadata list exposed all **76** paired conversations as Unchecked; inspecting the selected compatible continuation returned one Ready item (list plus inspection: 0.28 seconds in the standalone run).
- `cargo test --manifest-path src-tauri/Cargo.toml -p agent_cli --lib history_preview_status -- --nocapture`: one passed, with legacy manifest bytes unchanged.
- Compiled native test binary with `history_writer_detection --nocapture`: one passed.
- `node_modules/.bin/vitest run --config config/vitest.config.ts src/modules/MainApp/Settings/sections/HarnessConnections/ClaudeHistorySync.test.ts src/modules/MainApp/Settings/sections/HarnessConnections/AppConnectionPage.test.ts`: 21 passed.
- `node_modules/.bin/tsgo --noEmit`, affected-file ESLint, `git diff --check`, and `node scripts/quality/check-test-placement.mjs`: passed.

Actual Desktop handoff/reopen/continuation, both-direction paid requests, screenshots, resource sampling and final combined-build acceptance remain pending. None of the offline checks is presented as that GUI or billing evidence.
