# Test Cases: TurnFilesFooter

The per-round file list rendered at the bottom of each chat turn. Reads the
DB-materialized `TurnSummary.modifiedFiles` (computed by the Rust turn
indexer) and renders read-only `FileChangeRow`s. No frontend aggregation.

## Preconditions

- An agent (own-DB) session is open with at least one completed round.
- The round contains one or more file-modifying tool calls (`edit_file`,
  `apply_patch`, `create_file`, `delete_file`, write/edit storage tools).
- The turn index has been rebuilt at `TURN_INDEX_VERSION >= 6` (auto on first
  open of a pre-v6 session).

## Happy Path

| #   | Steps                                                 | Expected Result                                                                                                        |
| --- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1   | Open a session where round N edited 2 files           | Footer appears below round N's last item, header "2 files changed this round", two rows with icon, filename, +/- stats |
| 2   | Click the footer header                               | List collapses/expands; chevron toggles                                                                                |
| 3   | Scroll to an earlier loaded round that modified files | That round shows its own footer with only its files                                                                    |
| 4   | Agent finishes a new round that edits a file          | After the agent goes idle, the new round's footer appears (reload keyed on idle transition)                            |

## Edge Cases

| #   | Scenario                    | Steps                                   | Expected Result                                                          |
| --- | --------------------------- | --------------------------------------- | ------------------------------------------------------------------------ |
| 1   | Empty state                 | Round with no file edits (chat-only)    | No footer rendered (component returns null)                              |
| 2   | Single file                 | Round edits exactly one file            | Footer with count "1", one row                                           |
| 3   | Many files                  | Round edits 20 files                    | Footer body scrolls within max-height (192px); all rows reachable        |
| 4   | Same file edited repeatedly | Round edits `a.ts` 3 times              | One row for `a.ts`, additions/deletions summed (backend merge)           |
| 5   | apply_patch multi-file      | Round runs apply_patch touching 3 files | 3 rows, one per segment file, per-file line stats                        |
| 6   | Deleted file                | Round deletes a file                    | Row shown with deleted status; no +/- when stats are 0                   |
| 7   | Missing fileName            | DB row has empty `fileName`             | Filename derived from path basename                                      |
| 8   | Unloaded/older round        | Round not yet loaded into the store     | No footer (only loaded rounds render footers; relies on turn pagination) |

## Error / Degraded States

| #   | Scenario                 | Steps                             | Expected Result                             |
| --- | ------------------------ | --------------------------------- | ------------------------------------------- |
| 1   | Turn index load fails    | `loadTurnIndex` rejects           | Map resets to empty; no footers; no crash   |
| 2   | Malformed line counts    | DB row has NaN/negative additions | Clamped to 0 (mapping helper)               |
| 3   | Errored tool call        | Edit tool returned "Error…"       | File excluded (backend skips error results) |
| 4   | Group-chat / collab pane | Open a collab group-chat session  | No footer (suppressed in group-chat layout) |

## Diff navigation ("Review" / file-row click) — cumulative (issue #24)

The Agent Station Diff app is always **cumulative** (whole-session). A footer
"Review" / file-row click no longer narrows the Diff to this round's files; it
opens the cumulative diff and (for a file-row click) scrolls to the clicked
file. The bare composer "files" pill (`ChatView.openAgentStationDiff`) behaves
the same. The scroll-target logic lives in
`src/modules/WorkStation/Diff/SessionReplay/diffScope.ts`
(`isDiffScopeActive` + `resolveScopedSelectedPath`, unit-tested in
`diffScope.test.ts`).

Both entry points also bump `simulatorDiffRefreshNonceAtom`
(`bumpSimulatorDiffRefreshNonceAtom`). The Diff app caches its canonical
Orgtrack final diffs per session, so without this the view could show a stale
diff for a file edited after the cache warmed (e.g. round 2 appends `test2`
but only `test1` renders). The Diff app re-reads its final diffs whenever the
nonce changes, so navigating in always reflects the latest working tree. The
nonce is tied to explicit navigation (not render), so it cannot cause a
refetch loop.

### Happy Path

| #   | Steps                                                                        | Expected Result                                                                                           |
| --- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1   | Round edited 3 files; click "Review"                                         | Diff app opens (Agent Station) showing the **cumulative** whole-session diff (not just those 3 files)     |
| 2   | Click a specific file row                                                    | Diff app opens the cumulative diff AND scrolls to / focuses the clicked file                              |
| 3   | After (1), open the composer "files" pill                                    | Same cumulative whole-session diff                                                                        |
| 4   | Re-click the same file row                                                   | Diff app re-focuses that file (scope `nonce` bumps each open)                                             |
| 5   | Round 1 appends `test1`; round 2 appends `test2`; click round 2 "Review"/row | Diff reflects the latest working tree — both `test1` and `test2` visible (refresh nonce forces a re-read) |
| 6   | Open Diff, make another edit, re-open via footer or pill                     | Diff re-reads and shows the new edit (no stale cache)                                                     |

### Edge Cases

| #   | Scenario                      | Steps                                        | Expected Result                                                           |
| --- | ----------------------------- | -------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | No scroll target              | "Review" with no specific file row           | `resolveScopedSelectedPath` returns null; cumulative diff, no auto-scroll |
| 2   | Session switch                | Open Diff via session A, switch to session B | Scope's `sessionId` no longer matches → no stale scroll target for B      |
| 3   | Clicked path not in scope set | `selectedPath` not in `filePaths`            | No focus applied; cumulative list still shown                             |

### Error / Degraded States

| #   | Scenario                    | Steps                                     | Expected Result                                                 |
| --- | --------------------------- | ----------------------------------------- | --------------------------------------------------------------- |
| 1   | Session has no diffs at all | Click "Review" on a session with no edits | Cumulative list is empty → existing empty placeholder; no crash |

## Accessibility

- [x] Header is a real `<button>` (keyboard-focusable, Enter/Space toggles)
- [x] Review is a real `<button>`; file rows are clickable with full-path `title`
- [x] Each row carries a `title` with the full path for hover/SR context
- [ ] Focus trap — N/A (no modal/dropdown)

## Acceptance Criteria

- [ ] Files modified within a round appear below that round, deduped with +/- stats
- [ ] Rounds with no file edits show no footer
- [ ] Footer data comes from the backend (`session_turns.modified_files_json`), not frontend aggregation
- [ ] Reuses composer `FileChangeRow` + `ComposerStackHeader` + `composerStackTokens`
- [ ] Read-only — no accept/reject controls
- [ ] Header copy explicitly says it is a per-round summary ("N files changed this round"), localized in all 13 languages
- [ ] "Review" opens the cumulative whole-session diff (issue #24 — no per-round narrowing); a file-row click also scrolls to the clicked file
- [ ] The Agent Station Diff has no Focus/replay pill — it always shows the cumulative diff
- [ ] `pnpm test` passes for `turnFilesMapping` and `diffScope`
- [ ] No TypeScript errors
