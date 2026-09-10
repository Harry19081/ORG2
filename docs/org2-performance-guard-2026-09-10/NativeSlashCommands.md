# Native slash commands in ORG2

The Chat composer now distinguishes ORG2 controls, provider operations, and provider-reported skills. The native transcript remains authoritative; the command catalog is disposable metadata. This change does not emulate every interactive terminal screen.

## Command behavior

| Surface                         | Command                                                   | Behavior                                                                                                                                                       |
| ------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chat and single-session creator | `/model`, `/effort`, `/fast`                              | Open ORG2's model/variant selector. These are selector shortcuts, not automatic fast-mode toggles. Arguments are rejected rather than silently ignored.        |
| Chat and single-session creator | `/plan`                                                   | Save planning mode before the next message. An existing session also accepts `/plan <prompt>`; a creator requires selecting the mode first.                    |
| Existing chat                   | `/rename <name>`, `/status`                               | Persist the session name; show its current name/model/mode/repository.                                                                                         |
| Chat and single-session creator | `/new`, `/clear`, `/resume`                               | Open a fresh session composer or the existing session search. Clearing starts a new conversation and does not delete history.                                  |
| Chat and single-session creator | `/settings`, `/config`, `/mcp`, `/login`, `/diff`         | Open ORG2's existing settings, integrations, accounts or source-control surface.                                                                               |
| Codex                           | `/compact`                                                | `thread/compact/start` on the same native thread, with normal interruption and completion handling. The installed protocol does not accept focus instructions. |
| Codex                           | `/review [instructions]`                                  | Native inline review: uncommitted changes by default, custom review when instructions are supplied.                                                            |
| Codex                           | `/init [instructions]`                                    | Start the repository-specific AGENTS.md initialization task.                                                                                                   |
| Codex                           | `/<enabled native skill> [arguments]`                     | Discover via `skills/list` for the actual working directory, then send an explicit native skill input with the provider's path.                                |
| Claude Code                     | Runtime-reported SDK commands and project/plugin commands | Pass the literal command to the selected account's native SDK process. Preserve command output even when no model turn occurs.                                 |

Claude commands reported in `terminal_slash_commands` are excluded from the menu. Codex commands unsupported by the app-server fail explicitly instead of becoming model prompts. Native terminal-only screens, keybindings, and every third-party plugin's behavior are not asserted to be equivalent. `/compact`, `/context`, and `/init` are available before Claude's first init; the installed catalog appears after the first native run. Codex skills likewise become discoverable after a native run.

Commands with image attachments remain ordinary messages. Human-note and batch-creation editors do not advertise the single-session controls. Existing ORG2 skills and MCP tools remain in the menu.

## Resource ownership

| Area               | Verdict | Evidence                                                                                                                  | Change or reason kept                                                                                                                                           | Verification                                                                     |
| ------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Background work    | keep    | Codex requests its catalog once during active turn setup; Claude provides it in its existing init event                   | No new timer, watcher, polling process or idle scan. Codex catalog wait is bounded at 15 seconds. Native command operations use the existing turn/process owner | Protocol tests cover compact/review/skill dispatch and unknown command rejection |
| Memory             | keep    | Catalog names capped at 512 and 256 characters; Codex paths capped at 8192 bytes                                          | Menu snapshots are component-local. One upserted metadata row per managed session, deleted by the existing session FK cascade                                   | Parser bounds and repeated upsert/cascade tests                                  |
| Scope/isolation    | keep    | Catalog chunks checked against current session and provider; skill discovery uses the turn's actual working directory     | No arbitrary user-supplied file path resolution; no cross-session/global catalog cache                                                                          | Current-session/provider isolation tests                                         |
| Rendering/hot path | keep    | Menu snapshots `eventsAtom` only when opening a query; normal delta handling only performs a short metadata discriminator | No new subscription to streaming events. Replay reads the existing file stream and adds local-command records at their original position                        | Catalog filtering tests; local-command replay fixture                            |

## Source invariant and compatibility

Claude SDK local controls write an exact command envelope followed by `system/local_command` in the native JSONL. Previously the input appeared as XML and the result was dropped because it has no `message` member. The reader now normalizes the complete provider envelope, emits the actual stdout/stderr as a command result, and emits a terminal lifecycle marker. The SDK result parser similarly preserves zero-model-turn output without duplicating ordinary assistant answers.

The Claude parser fingerprint advances from 15 to 16 so existing cached history can be reprojected. Raw native files are never rewritten or cleaned up. The catalog reuses the existing `code_session_chunks` table and requires no schema migration. Rolling back ignores the disposable catalog and returns to the previous replay behavior; no user content is removed.

## Verification

- `pnpm test src/engines/ChatPanel/hooks/useInputArea/__tests__ src/engines/ChatPanel/InputArea/components/SlashCommandPortal/useEntries.test.ts src/features/SessionCreator`: 294 passed, one pre-existing skip.
- `pnpm typecheck:fast` and ESLint on every changed TypeScript file: passed.
- `cargo test --lib agent_sessions::cli::parsers -- --test-threads=2`: 204 passed, three existing live tests ignored.
- `cargo test --lib native_commands::tests`: passed, including production schema and FK cascade.
- `cargo test -p orgtrack_core sources::claude_code`: 43 passed, one existing ignored test.
- `git diff --check`: passed.

The final packaged application acceptance is in progress. Direct native CLI smoke confirmed authenticated Codex Astra, Claude Opus, Claude project-command expansion, and compaction followed by marker recall. Those direct CLI checks are not substitutes for ORG2 rendered acceptance. The first ORG2 package exposed the local-command replay defect described above; source tests now cover that defect. Final runtime measurements will be appended after the rebuilt package is exercised.
