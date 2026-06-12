# Test Cases: SessionCore Session Hooks (useSessionCreator / useSessionDiscovery)

## Preconditions

- Jotai `Provider` wraps the component tree with a fresh store.
- `useSessionCreator` is rendered inside a React Router context (`useSearchParams` available).
- `useSessionDiscovery` has access to key-vault accounts and session state atoms.
- At least one valid `KeyVaultAccount` with `status: "ready"` and `hasKey: true` exists.

## Happy Path

| #   | Steps                                                 | Expected Result                                                                  |
| --- | ----------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1   | Mount `useSessionCreator` with default options.       | Returns `isValid=false` (no content); draft state initialized.                   |
| 2   | Set `inputContent` to a non-empty string.             | `isValid` becomes `true`; submit button enabled.                                 |
| 3   | Call `launch()` with valid input and model selection. | `useSessionLaunch` fires; `onLaunchSuccess` callback called with new session ID. |
| 4   | Session launched; `persistDraft=true`.                | Draft is saved before launch; cleared after success.                             |
| 5   | `useSessionDiscovery` called after launch.            | Returns the newly created session by ID.                                         |
| 6   | `dispatchCategory = "cli_agent"` selected.            | `cliAgentTypeAtom` updated; model list filtered to CLI-compatible accounts.      |
| 7   | `dispatchCategory = "rust_agent"` selected.           | Native harness accounts enriched via `withNativeHarnessModels`.                  |
| 8   | Load draft from storage on mount.                     | `useDraftManagement` populates `inputContent` from saved draft.                  |
| 9   | File attachment added via `useFileUpload`.            | Attachment appears in upload list; included in launch payload.                   |
| 10  | Advanced config (model, temperature) changed.         | `useAdvancedConfig` updates atom; change persists through unmount/remount.       |

## Edge Cases

| #   | Scenario                                       | Steps                                                            | Expected Result                                                      |
| --- | ---------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1   | Empty content submit                           | Call `launch()` with empty `inputContent`.                       | Launch blocked; `isValid=false`; no API call made.                   |
| 2   | Stale session discovery                        | `creatorDefaultModelPairAtom` references a deleted account.      | `useValidatedLastPair` returns `null`; UI shows model picker prompt. |
| 3   | No accounts available                          | Key vault returns empty account list.                            | `isValid=false` due to no model; error state shown.                  |
| 4   | Launch with ORGII pool disabled (CLI dispatch) | `dispatchCategory="cli_agent"`; try to launch with hosted model. | `isPairCompatible` returns `false`; launch blocked.                  |
| 5   | `skipDraftLoading=true`                        | Mount with `skipDraftLoading=true`.                              | Draft not loaded; editor starts empty.                               |
| 6   | `initialContent` provided                      | Mount with `initialContent="seed text"`.                         | Editor pre-populated with seed text.                                 |
| 7   | Market deeplink present                        | Mount with `?marketDeeplink=...` URL param.                      | `useMarketDeeplink` processes param; model pre-selected.             |
| 8   | Session source = SYSTEM_PATH                   | `sessionSourceAtom` set to `SYSTEM_PATH_ID`.                     | `createSystemPathSessionSource` used; path shown in creator UI.      |
| 9   | Rapid submit clicks                            | Call `launch()` twice in rapid succession.                       | Second call debounced or ignored; single session created.            |
| 10  | Plan sync mid-launch                           | `useTodoSync` fires while launch is in-flight.                   | Plan sync does not interfere with launch; both complete correctly.   |

## Error / Degraded States

| #   | Scenario                  | Steps                                        | Expected Result                                                                      |
| --- | ------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1   | Launch API throws         | Backend returns error during session create. | `launchErrorHandling` processes error; error message displayed; `isLaunching=false`. |
| 2   | Draft storage unavailable | `useDraftManagement` can't read storage.     | Silent failure; editor starts empty; no crash.                                       |
| 3   | File upload fails         | `useFileUpload` upload rejects.              | Error shown for that file; other attachments unaffected.                             |
| 4   | Session discovery timeout | `useSessionDiscovery` never resolves.        | Loading state shown; no infinite loop.                                               |

## Accessibility

- [ ] Keyboard-navigable (Tab through model picker, input, submit button; Enter submits)
- [ ] Screen reader label on session input textarea
- [ ] Focus trap correct when model picker dropdown is open
- [ ] Error messages announced via `aria-live` or focus move

## Acceptance Criteria

- [ ] Creator validates content before enabling launch
- [ ] Correct accounts and models filtered per `dispatchCategory`
- [ ] Stale model pair detected by `useValidatedLastPair`; UI prompts re-selection
- [ ] Draft saved and cleared correctly with `persistDraft=true`
- [ ] Launch success calls `onLaunchSuccess` with new session ID
- [ ] Launch error displays message and resets loading state
- [ ] `pnpm test` passes with no new failures
- [ ] No TypeScript errors (`pnpm typecheck`)
