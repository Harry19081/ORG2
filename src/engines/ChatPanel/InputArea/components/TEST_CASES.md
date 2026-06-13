# Test Cases: GitDiffActionsMenu

The dropdown menu shown when the composer file-changes pill
(`composer-section-files` / `composer-section-git-artifacts`) is clicked.

## Preconditions

- An active session is selected and its composer is visible.
- The session has produced file changes, so the `± N · +A -D` pill is rendered.

## Happy Path

| #   | Steps                                | Expected Result                                                                                                                                                                        |
| --- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Click the file-changes pill          | Dropdown opens above the pill (composer is at screen bottom), showing two groups: "Git Actions" (commit, commit & push, push) and "Review" (View in my station, View in Agent station) |
| 2   | Click "commit" (session idle)        | Menu closes; an agent prompt "Commit all current changes." is dispatched to the session                                                                                                |
| 3   | Click "commit & push" (session idle) | Menu closes; an agent prompt "Commit all current changes and push to the remote." is dispatched                                                                                        |
| 4   | Click "push" (session idle)          | Menu closes; an agent prompt "Push the latest commits to the remote." is dispatched                                                                                                    |
| 5   | Click "View in my station"           | Menu closes; My Station Source Control tab opens showing current changes                                                                                                               |
| 6   | Click "View in Agent station"        | Menu closes; Agent Station Diff view opens (the previous default behavior)                                                                                                             |

## Edge Cases

| #   | Scenario                     | Steps                                  | Expected Result                                                                                                                   |
| --- | ---------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Session busy                 | Open menu while the agent is running   | All Git Actions ("commit", "commit & push", "push") are disabled (dimmed, no dispatch on click); both Review items remain enabled |
| 2   | Re-entrant commit            | Click "commit" twice quickly           | Only one prompt is dispatched; the second click is ignored until the first completes (guard)                                      |
| 3   | Click outside                | Open menu, then click elsewhere        | Menu closes without performing any action                                                                                         |
| 4   | Git-artifacts pill           | Click the commits/PR pill              | Same menu opens (shares the handler)                                                                                              |
| 5   | No menu surface (playground) | Render composer in DevTools playground | Pill keeps plain expand behavior; no dropdown                                                                                     |

## Error / Degraded States

| #   | Scenario        | Steps                                            | Expected Result                                                                       |
| --- | --------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| 1   | Dispatch throws | commit / commit & push / push fails mid-dispatch | Error is logged via the logger facade; guard is released so the action can be retried |

## Accessibility

- [ ] Keyboard-navigable (Tab to items, Enter to activate, Escape to close)
- [ ] Each item has a stable `data-testid` for E2E coverage
- [ ] Disabled items are not focus-activatable

## Acceptance Criteria

- [ ] Clicking the pill opens the menu instead of navigating directly
- [ ] commit / commit & push / push send the correct agent prompts and are disabled while the session is busy
- [ ] View in my station opens the My Station Source Control tab
- [ ] View in Agent station preserves the previous Agent Station Diff navigation
- [ ] Selecting any item closes the menu
