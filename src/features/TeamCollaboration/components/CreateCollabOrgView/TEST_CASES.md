# Test Cases: Collaboration Invite Deep Link → CreateCollabOrgView Prefill

Covers the `orgii://collaboration/join?sync=supabase&supabase=…&anon=…&invite=…` deep link end-to-end:
scheme registration → `useDeepLinkHandler` branch → `collabPendingInviteAtom`
hand-off → `CreateCollabOrgView` prefill + `canSubmit` relaxation.

## Preconditions

- App built/installed so the OS has registered the `orgii://` scheme
  (`src-tauri/tauri.conf.json` → `plugins.deep-link.desktop.schemes`).
- A Supabase project with ORGII setup SQL applied, plus a valid unused invite code.

## Happy Path

| #   | Steps                                                                                                                 | Expected Result                                                                                                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | App already running. Open `orgii://collaboration/join?sync=supabase&supabase=<encoded url>&anon=<key>&invite=<code>`. | Window focuses; routes to Workstation; chat-panel opens the NEW_COLLAB_ORG surface; form is Supabase Sync + Join with Invite code, Supabase URL, and anon key prefilled; Join button enabled once "Join as" is filled. |
| 2   | Cold start: app not running, open the same link.                                                                      | App launches; `getCurrent()` initial URL is consumed; same prefilled JOIN form is shown (no double navigation).                                                                                                        |
| 3   | Fill "Join as" + identity, click Join.                                                                                | Supabase RPC `orgii_accept_invite` is called with the embedded invite; org/member added; no manual project URL typing required.                                                                                        |

## Edge Cases

| #   | Scenario                                   | Steps                                                                  | Expected Result                                                                                                   |
| --- | ------------------------------------------ | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1   | Missing Supabase URL in link               | Open `orgii://collaboration/join?invite=<code>`.                       | JOIN form prefilled with invite only; Supabase URL empty; Join disabled until project URL and anon key are typed. |
| 2   | Paste full link into Invite field          | Type a full `orgii://…?sync=supabase&supabase=…&anon=…&invite=…` link. | Supabase URL and anon key fields auto-fill from the embedded link; Join enabled without retyping them.            |
| 3   | Missing invite                             | Open `orgii://collaboration/join?supabase=<url>`.                      | `parseCollabJoinDeepLink` returns null; link ignored (no JOIN flow); no crash.                                    |
| 4   | Non-collaboration `orgii://` path          | Open `orgii://marketplace/callback?code=x`.                            | Falls through to generic route conversion (`/orgii/marketplace/callback`); not treated as a collab join.          |
| 5   | `yorgai://` OAuth callback                 | Open `yorgai://marketplace/callback?code=x`.                           | Unchanged OAuth behavior; never matches collab-join branch.                                                       |
| 6   | URL-encoded Supabase URL                   | Supabase URL passed as `https%3A%2F%2F…`.                              | URL decoded correctly before prefill.                                                                             |
| 7   | Malformed link                             | `orgii://`, `not a url`.                                               | Returns null; ignored gracefully.                                                                                 |
| 8   | Re-open surface manually after a deep link | After a deep-link prefill, open "Add ORG" again.                       | Pending invite already cleared; form opens blank (no stale prefill).                                              |
| 9   | Repeated identical deep link event         | Same URL delivered twice.                                              | De-duplicated via `processedDeepLinks`; handled once.                                                             |

## Error / Degraded States

| #   | Scenario                                  | Steps                                       | Expected Result                                                            |
| --- | ----------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------- |
| 1   | Invalid/expired/consumed invite           | Submit Join with bad code.                  | Supabase RPC rejects; error message shown in form; no org added.           |
| 2   | User not on Workstation when link arrives | Link arrives while on Settings/other route. | Handler navigates to Workstation code route first, then opens the surface. |

## Accessibility

- [ ] Form is keyboard-navigable (Tab through fields, Enter to submit).
- [ ] Invite / Supabase project inputs have visible labels.
- [ ] Join button disabled state is conveyed (not color-only).

## Acceptance Criteria

- [ ] `orgii://collaboration/join` opens the JOIN form prefilled (Supabase Sync + Join, invite + project fields).
- [ ] Embedded Supabase project fields remove the need to retype them (`canSubmit` relaxed).
- [ ] Prefill is confirm-to-join (no silent auto-accept).
- [ ] `yorgai://` OAuth handling is unaffected.
- [ ] Unit tests for the parser pass (`__tests__/deepLink.test.ts`).
- [ ] Both cold-start (`getCurrent`) and live (`onOpenUrl`) paths handled.
