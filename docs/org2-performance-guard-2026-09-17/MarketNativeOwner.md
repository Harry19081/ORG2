# Native Market owner isolation

The native Market authority is the current instance's persisted `orgii:org2-cloud-v1:auth` record, verified with the official Supabase `/auth/v1/user` endpoint. Caller-supplied selection metadata and `expected_identity_user_id` never grant authority. The canonical path preserves the existing dedicated dev/primary sharing rule; numbered secondary instances use their own app data directory.

The public sync RPC accepts only an optional native transition epoch. It validates the fixed official issuer, JWT subject, metadata user, expiry and the remotely verified user id. Redirects are disabled. A configured origin cannot receive the Cloud bearer. A failed verification or failed second storage read clears only that verification's current epoch, with no fallback to unverified metadata.

Suspend invalidates the memory owner immediately and returns before any old Keychain operation finishes. This allows durable logout to proceed. The following sync retires source caches and pending enrollment behind the existing write barrier before restoring an owner. A watch notification cancels a stale sync's barrier or network wait when a newer suspend arrives. There are no polling timers or background cleanup workers. If persistence fails, the native owner stays suspended; stored grants and bounded memory may remain, but no request can use them until a successful new synchronization.

All credential acquisition, including cache hits, checks the verified memory owner and epoch. Options, activation, session preparation, enrollment, configuration and native-app opening check the same authority. Generic client configuration uses an `OperationAuthorization` guard acquired after credential retrieval and checked inside the configuration worker; the shared adapter does not depend on Market identity rules. This order avoids recursively acquiring a source read lock while a writer waits.

Same-account token refresh verifies the changed bearer without changing the epoch or clearing healthy source caches. Stored grants can be reused after the same account signs in again; signed-out and different-account requests cannot restore them. Already-forwarded upstream requests cannot be unsent. A mutation whose final authorized commit has already started may finish while subsequent owner synchronization waits for retirement; later credential delivery and new operations are rejected immediately.

The frontend publishes an owner transition before changing the auth atom, persists canonical auth in the existing disk queue, and performs native verification outside that queue. Ordinary App startup hydrates and notifies auth consumers without waiting for the Market network request. Package inventory and both initial and background-refreshed authorization completion wait for the latest native readiness promise. One shared waiter and a settled fast path prevent repeated inventory reads retaining listeners. A newer transition wakes old waiters without polling. Failed writes retain the local logout across focus recovery; late failures from older writes cannot suspend a successfully established newer account.

Profile caches are scoped to the Jotai store and official endpoint/account identity. Pending consent, picker preparation and external configuration operations discard results across logout, account switch and A→B→A. Ordinary Account Key selection remains usable while signed out. The Mobile Relay refresh path now honors its auth compare-and-set before mirroring; temporary refresh failures do not overwrite canonical auth with a sign-out.

## Compatibility and operational limits

Cold startup requires one successful online identity verification before Market operations become available. An offline startup fails closed even if a stored Market grant exists. This patch does not add a startup-offline credential fallback. During a running verified session, per-call checks require only memory and the local expiry; network/disk work happens on explicit auth synchronization, not per model call. Effective expiry is the earlier of persisted metadata and JWT expiry, preserving the existing `expires_in` fallback without extending bearer lifetime.

No persisted credential format, package routing protocol, database schema, pricing policy or installer release changes are required. Rollback restores the previous native authorization behavior and does not require deleting stored grants.

## Verification

- `cargo test --manifest-path src-tauri/Cargo.toml -p org2 --lib market_connection --no-fail-fast`: 41 passed, 0 failed.
- `cargo clippy --manifest-path src-tauri/Cargo.toml -p org2 --lib -- -D warnings`: passed.
- `git diff --check`: passed.
- Frontend combined regression: 170 files, 1588 tests passed across shared auth/relay, Org2Cloud, MarketConnect, model picker and App Connection. Final readiness follow-up: 3 files, 42 tests passed, including immediate login resume, background refresh completion, nonblocking startup/logout, stale-write rejection and offline hydration.
- Whole-project `NODE_OPTIONS=--max-old-space-size=8192 pnpm exec tsgo --noEmit --pretty false` and changed-file ESLint passed.
- Rebuilt GUI and idle resource measurements are pending; earlier-artifact acceptance is not substituted for these checks.

## Architecture review

| Layer                     | Verdict                         | Evidence                                                                                                                  |
| ------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1 Compilation             | verified by targeted Rust tests | `cargo test -p org2 --lib market_connection` compiles the application boundary                                            |
| 2 Ownership/deduplication | fix                             | One native owner state, one sync coordinator, one invalidation channel; all runtime credentials use the same source guard |
| 3 Naming                  | keep                            | Lease means an epoch-bound authorization context; no access token is returned by owner APIs                               |
| 4 Domain terms            | keep                            | Cloud owner, Market grant and short gateway credential retain distinct lifetimes                                          |
| 5 Defaults                | fix                             | Uninitialized, signed-out, custom issuer, wrong subject and expired identities fail closed                                |
| 6 Domain boundaries       | keep                            | Generic configuration adapters receive a guard interface; Market verification stays in Market composition                 |
| 7 Discoverability         | keep                            | Comments document invalidation-before-persistence and retirement-before-restore                                           |
| 8 Wire                    | fix                             | Sync accepts only epoch; fixed official verification endpoint/public key; no caller token or authority inputs             |
| 9 Init parity             | fix                             | Primary, dedicated dev and numbered secondary canonical paths explicitly covered                                          |
| 10 Resolver symmetry      | fix                             | Native provider, internal CLI and external app proxy ultimately acquire guarded Market credentials                        |

## Performance and lifecycle

| Area               | Verdict | Evidence                                                                                       | Change or reason kept                                                | Verification                                                                                        |
| ------------------ | ------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Background work    | fix     | One watch sender and one receiver for active sync; no timers/workers                           | New epoch cancels stale barrier/network wait                         | Production cancellation helper tested with a held request barrier                                   |
| Memory             | keep    | One owner snapshot/fingerprint, one enrollment lease; existing 32-connection × 32-token bounds | No per-session registry added                                        | Existing source bound/retirement tests retained                                                     |
| Scope/isolation    | fix     | Current official principal and epoch guard every acquisition                                   | Metadata alone cannot restore authorization                          | Cached credential logout, delayed credential result, stale verification and secondary startup tests |
| Rendering/hot path | keep    | Native require/check reads only memory                                                         | Auth push performs bounded disk reads and changed-token verification | Source call-chain inspection; no performance improvement claim                                      |

| Provider                | Raw transition                                    | App/UI state                           | Topology/boundary   | Expected invariant                                                | Observed evidence                                                      |
| ----------------------- | ------------------------------------------------- | -------------------------------------- | ------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Official Cloud          | verification followed by logout                   | native unit boundary                   | verification commit | Old result cannot restore owner                                   | Async verification completion regression                               |
| Official Cloud          | refresh                                           | native unit boundary                   | owner commit        | Same epoch; earlier effective expiry                              | Refresh and expiry regression                                          |
| Official Cloud          | second read/verification failure                  | native unit boundary                   | owner state         | Current epoch fails closed; newer epoch untouched                 | Failure invalidation regression                                        |
| Market                  | logout during cached/uncached request             | native unit boundary                   | credential source   | No credential delivery after revocation                           | Cached and delayed response regressions                                |
| Official Cloud          | direct numbered launch                            | path and native source unit boundaries | secondary instance  | No primary auth inheritance; uninitialized source refuses restore | Path and source regression                                             |
| Official Cloud + Market | login/logout/restart, account switch, idle/hidden | rebuilt Tauri GUI                      | installed artifact  | UI/cache/native behavior and idle resource stability              | Not run for this patch; integration owner must verify rebuilt artifact |

Performance verdict: blocked for final runtime acceptance. Unit and call-chain evidence cover resource bounds and identity invalidation, but this patch has not yet been exercised in a rebuilt GUI artifact or measured in visible/hidden idle states. Earlier real-call billing evidence belongs to the earlier artifact and does not prove these new owner guards.
