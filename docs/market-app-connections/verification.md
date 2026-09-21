# Market app compatibility and model selection

## Behavior

Codex Desktop 26.915.31945 is accepted alongside the previously verified
26.908.70816. Bundle identity checks remain mandatory, and unknown releases
remain blocked. An unsupported release now produces a localized update message
instead of the generic connection error. Arbitrary native error text is never
shown to the user.

Managed model compatibility follows the server's `clients` capabilities rather
than inferring client support from the provider wire protocol. GPT can appear
for Claude clients only after the companion Cloud protocol bridge advertises
that support. Older servers retain their existing model availability. The companion bridge is [Cloud PR #126](https://github.com/org2AI/ORGII-cloud-infra/pull/126) and must deploy before relying on GPT compatibility. This PR does not implement or deploy the gateway bridge.

Selecting a model previously fetched the whole package catalog again after the
picker had loaded it. Session preparation now reuses its native-validated
snapshot for at most 30 seconds. Explicit catalog refresh still fetches current
data. Refresh failure, activation and reauthorization invalidate the snapshot.
This snapshot supplies selection metadata only: token issuance and gateway
requests continue to enforce access, terms, funds and availability.

## Executed verification

The following historical checks ran before the latest integration rebase.
Updated checks after rebasing onto `cc26b4729a` are recorded in the gateway
routing follow-up below:

- `pnpm test src/features/MarketConnect/externalAppBridge.test.ts src/features/MarketConnect/nativeModelSelection.test.ts src/modules/MainApp/Settings/sections/HarnessConnections/AppConnectionPage.test.ts`: 25 tests passed.
- `pnpm typecheck:fast`: passed.
- Changed-file ESLint and `pnpm check:i18n-keys`: passed.
- `pnpm run build --no-cache`: passed.
- `cargo test --manifest-path src-tauri/Cargo.toml -p org2 --lib market_connection::native_app_launch::tests -- --nocapture`: 4 passed.
- `cargo test --manifest-path src-tauri/Cargo.toml -p market-connect workspace::tests -- --nocapture`: 3 passed.
- `cargo test --manifest-path src-tauri/Cargo.toml -p org2 --lib market_connection::source::tests -- --nocapture`: 21 passed. The new loopback HTTP test verifies concurrent selections issue one request, explicit refresh reaches the server, a failed refresh cannot revive an earlier snapshot, and expiry triggers a new fetch. Separate tests verify logout, late responses and owner isolation.
- An earlier build with the same compatibility implementation started a separate Codex Desktop 26.915.31945 process. The final combined build `aff4fd0` completed Advanced Coding configuration using the actual ORG2 **Use connection** control and the **Restore** UI operation; it did not launch a separate Codex process during that final check. SHA-256 hashes of all four monitored primary Codex configuration/authentication files remained unchanged. The screenshot below comes from this final build and records the configured state; it does not prove a model inference call from the official Codex UI.

![Codex connection configured in ORG2](codex-configured.png)

The installed release's bootstrap and main sources were audited for
`CODEX_ELECTRON_USER_DATA_PATH`, `CODEX_HOME` and isolated single-instance
behavior. Relevant source SHA-256 values:

- Bootstrap: `5787d416ccbd7be549251d2c691f9c2579d6960f3ccd470037d97486c93fdf0f`
- Main: `9e8a3bd79c817064f28693ca26aa1378895e07ab2108c78c42d0ea20dac9d66e`

## Limits and lifecycle

Claude Desktop's GPT menu and real inference through the new capability catalog
have not been verified. The Cloud bridge has separate protocol, provider and
billing acceptance. Neither result substitutes for native desktop acceptance.
The integration acceptance build combined the fixes at commit `aff4fd0` (native
binary SHA-256 prefix `332c077`). Keychain access initially blocked cold package
loading; a process sample identified `enabled::status →
keyring::Entry::get_password → Security decrypt`. The user then authorized
Keychain access and the native picker loaded. In the SDE Advanced Coding picker,
warm Fable → GPT6 Astra selection and confirmation took 464 ms; returning to
Fable took 455 ms. These are observed automation round-trip upper bounds for two
actions, not a p95 measurement or a before/after performance comparison.
Official Codex UI model inference remains unverified.

Resource samples used changes in cumulative process CPU time over measured
monotonic intervals, not the instantaneous `ps %cpu` field. CPU percentages below
are fractions of one core. RSS is end-of-interval residency; sums can include
shared pages. ORG2 had no direct child processes; launchd-owned WebKit processes
could not be attributed and are excluded.

| State (UTC, 2026-09-21)     | Interval | ORG2 CPU / RSS    | Isolated Claude process tree CPU / RSS |
| --------------------------- | -------- | ----------------- | -------------------------------------- |
| Foreground idle, 06:32:21   | 12.050 s | 0.50% / 167.7 MiB | 0.83% / 1035.3 MiB                     |
| After AX minimize, 06:37:47 | 12.043 s | 0.25% / 454.2 MiB | 0.66% / 886.8 MiB                      |

Model selection and other interactions occurred between the samples. These RSS
values do not establish a memory regression or improvement caused by hiding.
Claude's sampled process was independently identified as using the isolated
native-app profile. Both observations show low CPU during those short idle
intervals; they do not measure sustained or whole-system idle overhead.

Normal Quit required confirmation in ORG2's native quit dialog. Before the
confirmation, ORG2 correctly remained alive with its loopback listeners; this
was not treated as a shutdown failure. After confirmation, the original ORG2
process and the entire previously recorded Claude process tree were absent at
both ends of a 10.028-second observation starting 06:41:18 UTC. The former package
proxy port 17888 had no listener. ORG2 was reopened during that observation and
the new process owned port 13847 at the end, so an empty interval on that port
was not captured. No claim is made that reopening and resource sampling proved
all external service or WebKit cleanup.
The localized unsupported-version error has regression coverage but no rendered
error-state screenshot. No layout or control presentation was changed.

| Area            | Evidence                                                                                              | Decision                                             |
| --------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Background work | No timer, polling or new subscription                                                                 | Check freshness only on user-driven reads            |
| Memory          | One snapshot per existing connection; registry cap 32; catalog cap 100 packages                       | Bounded retention; reauthorization clears state      |
| Scope           | Existing instance-local source, owner/workspace identity and lease barriers; fixed build-time origins | Cached data cannot cross owner changes               |
| Hot path        | Three concurrent reads issue one HTTP request; explicit refresh remains fresh                         | Reuse only recent native-verified selection metadata |

**Performance verdict: targeted warm selection and visible/hidden idle checks
completed, with the measurement limits above.** Unit and HTTP request-count
checks passed. No statistically established latency improvement is claimed. Cold loading still
requires authorization and the remote catalog; this change does not claim to
remove that necessary work. Debug logs expose only `cache_hit` and `elapsed_us`
for catalog timing, with no buyer identity, selected model or credential.

Rollback uses the prior native build; this change has no schema migration or
new persistent profile format. Rolling back the companion Cloud capability
advertisement causes native validation to hide or reject unsupported models.
No installer was published and no production service was deployed by this PR.

## Claude Desktop gateway model routing follow-up

Native acceptance exposed two separate configuration failures. ORG2's direct
account model-family guard rejected a trusted helper catalog before writing it.
After allowing capability-validated helper catalogs, the installed Desktop
rejected GPT-bearing gateway route names while retaining the Claude entry.

The final writer validates helper token ownership, catalog membership and route
syntax separately from direct-account provider constraints. Desktop catalogs
now assign non-Claude models an opaque gateway route bound to the real model,
identity, authorization workspace and purchased entitlement. The first 80 bits
of the digest use fixed-width decimal bytes: a hexadecimal suffix can randomly
contain `abab`, which the observed Desktop provider-name predicate rejects.
Labels continue to show the real GPT model, and request selection, authorization
and accounting use the unchanged real model and purchase. This is ORG2 gateway
compatibility, not a claim of official native GPT support. No vendor executable,
policy or authorization setting was modified.

Existing Claude/Fable aliases and canonical saved catalogs remain readable;
reapplying a GPT Desktop connection writes the new route. Existing Claude aliases
retain their previous naming behavior, including the vendor's rare hexadecimal
name-filter edge case. A later vendor validator change can require revalidation.
Restoring a saved profile remains independent of route naming. For rollback,
restore or reapply a prior supported model before returning to an older build.

Source `f1efec1cd3070125bd0405c873d5318b94e25f14` passed 82
`cargo test --manifest-path src-tauri/Cargo.toml -p org2 --lib market_connection:: -- --nocapture` tests, including
an observed vendor-predicate fixture, legacy catalog parsing, multiple purchases
sharing a model, immutable real-model routing and alias rebinding rejection.
After rebasing onto `develop` commit `cc26b4729a`, the following frontend
command passed all 45 tests in four files:

`pnpm test src/features/MarketConnect/externalAppBridge.test.ts src/features/MarketConnect/nativeModelSelection.test.ts src/features/MarketConnect/marketProfiles.cache.test.ts src/modules/MainApp/Settings/sections/HarnessConnections/AppConnectionPage.test.ts`

`pnpm build` also passed on that rebased frontend. Subsequent commits only
changed Rust catalog generation and validation, so the frontend output is
unchanged. Normal Husky hooks ran lint-staged and
`cargo clippy --lib -p org2` successfully.
The native debug bundle built successfully; its binary SHA-256 is
`bce6517cb53021cd41321f8c954d00b541e0aedeaaf3e5f0d0d8f3fde07f1ebd`.
It reuses the frontend output already built and verified at `7bdc48a225` because
this follow-up changes only Rust catalog generation and validation.

The replacement build launched, but loading official packages subsequently
failed while awaiting system credential access. A three-second process sample
on this final binary located the wait at `enabled::status →
keyring::Entry::get_password → SecKeychainFindGenericPassword → Security decrypt`.
This was before Apply and inference; it is not a gateway request failure.
System Keychain authorization remains outstanding. Rebuilding an ad-hoc signed
acceptance binary can require another authorization, so a previous build's
successful authorization does not establish this build's acceptance.

Final native GPT menu/inference/context, billing correlation and Restore
acceptance remain pending. Configuration and predicate regression tests do not
prove a completed Desktop model call. The existing Codex screenshot documents
its earlier acceptance only; there is no final GPT menu screenshot to present
while this system authorization prevents reaching it.
