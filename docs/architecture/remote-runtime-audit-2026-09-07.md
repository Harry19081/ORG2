# Account-scoped Mobile Remote runtime audit

Scope: native ticket admission and the shared runtime/auth owners required for reconnect. This is a dependent batch after the Desktop Cloud-auth UI change, with no scanner, icon or account settings UI changes.

| Layer                     | Evidence / verdict                                                                                                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Compilation             | `pnpm typecheck:fast` passed on the split tree; targeted suite results recorded in PR. Full Rust build is not passed (disk constraint)                                        |
| 2 Ownership/deduplication | Provider invokes extracted transcript, send, permission, model and roster owners; none is a definition-only abstraction. Platform owns ticket preparation                     |
| 3 Naming                  | `prepareSocketUrl` returns a credential-ready URL, not a durable pairing config; distinguish connection generation from turn intent ID                                        |
| 4 Semantic overload       | Cloud session = account credential; remote session = Desktop chat; transport = replaceable socket; transcript generation = subscription episode                               |
| 5 Defaults                | Initialize defaults missing permissions to read-only. Watch: unknown send-status values currently fall through to failed                                                      |
| 6 Boundaries              | Browser cookie and native ticket are platform implementations; shared Provider does not assemble Cloud Bearer requests                                                        |
| 7 Discoverability         | Controller ownership is explicit; remaining lifecycle risks below prevent unconditional approval                                                                              |
| 8 Wire                    | Generated Rust/TS contract with checksum and fixtures; native request uses Authorization header, trusted endpoint allowlist, no redirect, 4 KB response limit, one-use ticket |
| 9 Entry parity            | Native entry uses real auth; browser cookie/native ticket converge at shared initialize. Development root remains explicitly separate                                         |
| 10 Resolver symmetry      | Native admission reads the refreshed persisted account session and checks user, Cloud origin and expiry; no QR-selected endpoint receives a Cloud token unless allowlisted    |

## Findings requiring follow-up before ready

1. `auth/useMobileAuthController.ts`: authentication generation is invalidated on sign-out/cancel, but the mount authentication effect has no unmount invalidation. A pending restore can reach persistence after owner unmount. Add an unmount/remount persistence regression before considering the lifecycle complete.
2. `app/useMobileSessionList.ts`: generation checks protect final roster state, but repeated invalidations start concurrent reads rather than coalescing them. Add single-flight + one trailing refresh and a burst test. This is a performance guard failure, not evidence that current tests cover bursts.
3. `app/useMobileSend.ts`: `receiveSendStatus` maps any unknown status to failure. Prefer explicit terminal-value validation and a producing/ingestion-boundary negative case before extending the protocol.

No historical pairing data is deleted by this client patch. Persisted connection writes remain serialized and account-scoped. The old development checkout's unconditional auth-session success stub is excluded.

| Area               | Verdict | Evidence                                                           | Change or reason kept         | Verification                     |
| ------------------ | ------- | ------------------------------------------------------------------ | ----------------------------- | -------------------------------- |
| Background work    | fix     | roster invalidations can overlap                                   | Coalescing follow-up required | Burst test missing               |
| Memory             | keep    | one reconnect timer/flight, transcript refresh has one queued slot | Preserve bounded ownership    | Existing stale/reset tests       |
| Scope/isolation    | watch   | auth unmount does not invalidate pending persistence               | Add owner lifetime guard      | Unmount persistence test missing |
| Rendering/hot path | keep    | refactor retains public Provider API                               | No runtime speed claim        | Shared behavior tests            |

Performance verdict: fail for roster single-flight; physical-device visible/hidden CPU/RSS measurements also not run. Keep Draft. This audit is not a claim of production acceptance.
