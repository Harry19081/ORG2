# Test Cases: Collaboration Invite Deep Link → CreateCollabOrgView Prefill

Covers the `orgii://collaboration/join?hub=…&invite=…` deep link end-to-end:
scheme registration → `useDeepLinkHandler` branch → `collabPendingInviteAtom`
hand-off → `CreateCollabOrgView` prefill + `canSubmit` relaxation.

## Preconditions

- App built/installed so the OS has registered the `orgii://` scheme
  (`src-tauri/tauri.conf.json` → `plugins.deep-link.desktop.schemes`).
- A reachable Cloudflare collab hub and a valid, unused invite code.

## Happy Path

| #   | Steps                                                                                   | Expected Result                                                                                                                                                                                |
| --- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | App already running. Open `orgii://collaboration/join?hub=<encoded hub>&invite=<code>`. | Window focuses; routes to Workstation; chat-panel opens the NEW_COLLAB_ORG surface; form is Cloud + Join with Invite code and Hub URL prefilled; Join button enabled once "Join as" is filled. |
| 2   | Cold start: app not running, open the same link.                                        | App launches; `getCurrent()` initial URL is consumed; same prefilled JOIN form is shown (no double navigation).                                                                                |
| 3   | Fill "Join as" + identity, click Join.                                                  | `acceptCollabInvite` is called with the embedded hub + invite; org/member added; no manual hub typing required.                                                                                |

## Edge Cases

| #   | Scenario                                   | Steps                                                              | Expected Result                                                                                                    |
| --- | ------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| 1   | Missing hub in link                        | Open `orgii://collaboration/join?invite=<code>`.                   | JOIN form prefilled with invite only; Hub URL empty; Join disabled until hub typed (or a hub-bearing link pasted). |
| 2   | Paste full link into Invite field          | Type a full `orgii://…?hub=…&invite=…` link into the Invite input. | Hub URL field auto-fills from the embedded hub; Join enabled without retyping hub.                                 |
| 3   | Missing invite                             | Open `orgii://collaboration/join?hub=<hub>`.                       | `parseCollabJoinDeepLink` returns null; link ignored (no JOIN flow); no crash.                                     |
| 4   | Non-collaboration `orgii://` path          | Open `orgii://marketplace/callback?code=x`.                        | Falls through to generic route conversion (`/orgii/marketplace/callback`); not treated as a collab join.           |
| 5   | `yorgai://` OAuth callback                 | Open `yorgai://marketplace/callback?code=x`.                       | Unchanged OAuth behavior; never matches collab-join branch.                                                        |
| 6   | URL-encoded hub                            | hub passed as `https%3A%2F%2F…`.                                   | Hub decoded correctly before prefill.                                                                              |
| 7   | Malformed link                             | `orgii://`, `not a url`.                                           | Returns null; ignored gracefully.                                                                                  |
| 8   | Re-open surface manually after a deep link | After a deep-link prefill, open "添加 ORG" again.                  | Pending invite already cleared; form opens blank (no stale prefill).                                               |
| 9   | Repeated identical deep link event         | Same URL delivered twice.                                          | De-duplicated via `processedDeepLinks`; handled once.                                                              |

## Error / Degraded States

| #   | Scenario                                  | Steps                                       | Expected Result                                                              |
| --- | ----------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | Invalid/expired/consumed invite           | Submit Join with bad code.                  | Hub `acceptCollabInvite` rejects; error message shown in form; no org added. |
| 2   | User not on Workstation when link arrives | Link arrives while on Settings/other route. | Handler navigates to Workstation code route first, then opens the surface.   |

## Accessibility

- [ ] Form is keyboard-navigable (Tab through fields, Enter to submit).
- [ ] Invite / Hub inputs have visible labels.
- [ ] Join button disabled state is conveyed (not color-only).

## Acceptance Criteria

- [ ] `orgii://collaboration/join` opens the JOIN form prefilled (Cloud + Join, invite + hub).
- [ ] Embedded hub removes the need to retype the Hub URL (`canSubmit` relaxed).
- [ ] Prefill is confirm-to-join (no silent auto-accept).
- [ ] `yorgai://` OAuth handling is unaffected.
- [ ] Unit tests for the parser pass (`__tests__/deepLink.test.ts`).
- [ ] Both cold-start (`getCurrent`) and live (`onOpenUrl`) paths handled.
