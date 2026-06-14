# Test Cases: Plan-doc auto-preview (Communication)

Covers the derive-with-user-override behaviour that replaced the old auto-open
`useEffect` + dedup `useRef` in `index.tsx`. The pure logic lives in
`planPreviewView.ts` (`computeEffectivePlanView`, `computeEffectivePlanPreview`)
and is consumed by `SimulatorMessagesComponent` via a stable `pendingPlanId`
exposed from `usePlanApproval`.

## Preconditions

- A Communication replay panel is mounted for a session.
- "Pending plan" = `usePlanApproval` reports `isPlanPending` (a plan approval is
  awaiting the user). `currentPlanId` (`pendingPlanId`) is non-null exactly then.
- The source/preview toggle (TabPill) is only rendered while a plan is pending.

## Happy Path

| #   | Steps                                                    | Expected Result                                                                      |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1   | A plan becomes pending while viewing any non-preview tab | Replay view switches to "preview" tab AND the source/preview toggle shows "preview". |
| 2   | Plan is pending; user does nothing                       | View stays on preview; plan doc renders in preview.                                  |

## Edge Cases

| #   | Scenario                        | Steps                                                                     | Expected Result                                                                                                                                      |
| --- | ------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | No plan pending                 | Open panel with no pending plan                                           | Effective view == base view (chat/think/todo/interaction/preview), no auto-open.                                                                     |
| 2   | Override sticks (tab)           | Plan pending → auto preview → user clicks "Messages" tab                  | View becomes "chat" and STAYS there while the same plan is pending (no snap-back to preview).                                                        |
| 3   | Override sticks (toggle)        | Plan pending → user flips TabPill to "source"                             | Toggle stays "source" while the same plan is pending.                                                                                                |
| 4   | Base view churn                 | Plan pending → user clicks Preview tab then Messages tab                  | Final view honours the last explicit choice ("chat"); does NOT snap back to preview (stable `pendingPlanId` keeps the override matched).             |
| 5   | New plan re-triggers            | Plan A pending + user override → Plan B (different id) becomes pending    | Auto preview fires again: view = "preview", toggle = "preview".                                                                                      |
| 6   | Message-click to preview        | User clicks a plan bubble in the chat/interaction list                    | Jumps to that message and switches to preview (records intent for the pending plan).                                                                 |
| 7   | Plan resolved                   | Pending plan is approved/cleared                                          | Effective view falls back to the user's base view; toggle defaults to preview (toggle is hidden once not pending).                                   |
| 8   | View choice keeps toggle choice | Plan pending → user flips toggle to "source" → then clicks "Messages" tab | Both stick: view = "chat" AND toggle stays "source" (the single per-plan intent merges partial choices; setting one facet never clobbers the other). |

## Error / Degraded States

| #   | Scenario       | Steps                           | Expected Result                                                                                                       |
| --- | -------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1   | Session switch | Active session changes mid-flow | `useMessages` resets base view; overrides are keyed by plan id so a stale override cannot match a new session's plan. |

## Accessibility

- [ ] Replay tabs and source/preview TabPill remain keyboard-navigable (Tab, Enter).
- [ ] Toggle exposes accessible labels for "Source code" / "Preview".

## Acceptance Criteria

- [ ] Plan pending with no override → effective view "preview" and toggle preview.
- [ ] User override (tab or toggle) sticks while the same plan stays pending.
- [ ] A different plan id re-triggers auto-preview.
- [ ] Plan resolved → effective view reverts to base view.
- [ ] No `useEffect` and no `useRef` drive this behaviour.
