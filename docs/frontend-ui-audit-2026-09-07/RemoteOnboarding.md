# Remote onboarding and route ownership audit

| Line                             | Element           | Verdict          | Reason                                                                                        | Suggested change |
| -------------------------------- | ----------------- | ---------------- | --------------------------------------------------------------------------------------------- | ---------------- |
| WelcomeScreen.tsx:30             | Pairing action    | keep with reason | One real pairing entry using the existing MobileActionButton; demo entry removed as requested | None             |
| MobileRemoteApp.tsx:30           | Route rendering   | keep with reason | Delegates intent ownership without introducing a parallel visual shell                        | None             |
| useMobileRemoteCoordinator.ts:97 | Stop confirmation | keep with reason | Single pending operation; navigation/unmount invalidate modal-local completion                | None             |

Totals: fix 0; keep with reason 3; abstract 0 (visual patterns only).

**Control-flow blocker:** `handleConfirmStop` rethrows RPC failure, while StopConfirmModal calls the async callback without awaiting/catching it. A failed stop closes the modal through finally and has no error feedback. The direct hook test catches the rejection but does not verify the rendered action. Require error ownership and a rendered rejection regression before ready; this existing behavior was not silently broadened during the audit.

## Architecture

Reviewed ownership, route FSM, typed pairing intent, async stop lifecycle, errors and test coverage. Authentication, socket lifetime and persistent schema remain in their existing owners and are not changed here. The main app explicitly disables demo default; internal demo fixtures remain for test/development use. The old development-root test expected the removed Try demo action; its assertion is updated to require real pairing and reject that action.

Pairing progresses welcome → payload validation → SAS (when required) → connecting → sessions. Consumed links are guarded against repeated route resets. Stop is single-flight; changing route or unmounting invalidates only UI completion, not the already-issued remote command. Account/runtime defects documented in parent #1380 still apply. Physical navigation/focus/light-dark screenshots and actual stop/offline interactions are not reverified.

| Area               | Verdict | Evidence                                     | Change or reason kept                              | Verification                 |
| ------------------ | ------- | -------------------------------------------- | -------------------------------------------------- | ---------------------------- |
| Background work    | keep    | No added timer/poll/subscription             | User-triggered stop only                           | Coordinator tests            |
| Memory             | keep    | One consumed intent and one operation symbol | Bounded by hook lifetime                           | Static trace                 |
| Scope/isolation    | keep    | Route changes invalidate operation symbol    | Late stop cannot close a different session's modal | Regression test              |
| Rendering/hot path | keep    | No new streaming subscriber                  | Existing context use retained                      | No runtime performance claim |

Verification: 9 tests passed across MobileRemoteApp, useMobileRemoteCoordinator and MobileRemoteDevelopmentRoot. Performance verdict: blocked — no physical-device lifecycle measurements; this does not clear parent runtime blockers.
