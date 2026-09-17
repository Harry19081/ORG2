# Market App Packages architecture and acceptance

Status: implementation and boundary checks complete in the local integration checkout; business acceptance and final PR CI are incomplete. No Package PR merge or installer publication is authorized by this report.

## Completion criteria

- One native App holds multiple Packages simultaneously and selects between overlapping models inside that App.
- The selected alias resolves purchase, model, destination and credential together, with no fallback to another purchase.
- Signed-out web enrollment uses standard Cloud OAuth and resumes the original enrollment; browser identity and native identity must match.
- Configuration remains conflict-aware, reversible and credential-free; existing single-Package metadata remains readable.
- Actual native requests, restart recovery and buyer/seller ledger accounting must be observed before business acceptance passes.

## Ten-layer review

| Layer                     | Evidence and finding                                                                                                                                                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 Compilation             | Final debug app build, TypeScript typecheck and targeted ESLint passed; exact-client boundary/source tests passed (23 Rust tests), relevant frontend suites passed (7 files / 34 tests), and all-target clippy passed with warnings denied |
| 2 Production reachability | AppConnectionPage → configureExternalMarketCatalog → registered market_connection_configure_catalog → configure_catalog → generic managed config transaction; proxy consumes the registered market-app source                              |
| 3 Naming                  | Catalog/PickerModel describe native selection metadata; underlying market Selection retains purchase and model ownership                                                                                                                   |
| 4 Meaning                 | Catalog alias is a native picker ID; actual model is the upstream protocol name; authorization workspace and purchased workspace remain distinct; session_id scopes short-lived service credentials                                        |
| 5 Defaults                | Catalogs require an explicit default alias; unknown aliases, wrong agents, duplicate entries and mixed identities fail; single-Package compatibility does not create a catalog fallback                                                    |
| 6 Boundaries              | Generic dynamic_credentials resolves a RequestSelection; generic agent-cli model catalogs receive native metadata without importing Market purchase types                                                                                  |
| 7 Comprehension           | Catalog module documents alias stability, bounds and ownership; configure module documents capability checks preceding file mutation                                                                                                       |
| 8 Wire                    | Real loopback HTTP test observes rewritten actual model, destination and matching authentication; model listing never mints credentials; actual native-provider paid calls remain unverified                                               |
| 9 Initialization          | Configuration, opening and restored sources share strict catalog parsing; both market and market-app sources register in normal startup; exact App capabilities are checked for single and batch configuration/open                        |
| 10 Resolver symmetry      | Alias resolves underlying selection plus actual model before credential acquisition; single-Package model switching also updates credential model first; no model-only override retaining another purchase/token                           |

## Entry-point matrix

| Entry                     | Identity/purchase validation                            | Current exact App support                                                 | Config conflict checks                    | Runtime source                 |
| ------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------ |
| Internal ORG2 session     | Signed-in connection and authoritative purchase/model   | Internal engine contract                                                  | No external config writes                 | market                         |
| Single external configure | Same authoritative purchase/model                       | Exact native client                                                       | Existing expected file hashes/transaction | market                         |
| Batch external configure  | Every selected purchase, same identity, bounded catalog | Every picker entry                                                        | One config/catalog transaction            | market-app delegates to market |
| External open             | Strict saved selection/catalog plus live purchases      | Exact native client revalidated                                           | Managed status, selection and model match | Existing configured proxy      |
| Restart                   | Persisted metadata parsed by registered source          | Live revalidation on open/configure; server governs request authorization | Existing manifest restoration             | Same source registration       |

## Resolver matrix

| Resolved value             | Authority                                             |
| -------------------------- | ----------------------------------------------------- |
| Purchase workspace/access  | Exact chosen catalog entry                            |
| Actual wire model          | Same entry's underlying selection                     |
| Credential cache key       | Same identity, purchase, model and session            |
| Destination/authentication | Credential returned for that selection                |
| Picker label               | Display metadata only; never used to resolve purchase |

## Compatibility and recovery

Existing market selections remain readable. Catalog aliases are metadata only, bounded to eight purchases, 64 models and a 64 KiB serialized selection, and remain stable across session changes. Codex catalog artifacts participate in normal backups, expected-hash conflicts and restoration; Claude picker settings are restored before switching away. Installed native catalogs are consulted for actual Codex model capabilities rather than inventing context limits. Native model-picker version support, GUI consumption of the intended configuration root and actual requests still require runtime acceptance.

## Unfinished evidence

The merged OAuth acceptance is separate evidence. The latest multi-Package implementation still needs actual web enrollment → native selection → provider response → buyer/seller ledger correlation; continuation/restart; short-lived credential refresh; native Claude/Codex picker behavior; and lifecycle measurements. A second real account for the same provider is required to claim real upstream-account rotation. No synthetic proxy or ledger test substitutes for these cells.

## Final local commands

- `cargo test --manifest-path src-tauri/Cargo.toml -p org2 --lib market_connection::`: 23 passed
- `cargo clippy --manifest-path src-tauri/Cargo.toml -p org2 -p agent_cli --all-targets -- -D warnings`: passed
- `pnpm test -- src/features/MarketConnect src/modules/MainApp/Settings/sections/HarnessConnections`: 7 files / 34 tests passed
- `pnpm run typecheck:fast`: passed
- Targeted ESLint on the changed bridge and AppConnectionPage: passed
- `pnpm exec tauri build --debug --bundles app --no-sign` with isolated Instance 89/local endpoints and updater artifacts disabled: passed
- Native UI: cold start, all three App tabs, configure → Market → updated multi-Package help and signed-out empty state observed; quit confirmed and process absent afterward. No native config applied and no provider request executed.
- `cargo test --manifest-path src-tauri/Cargo.toml -p org2 --lib cli_managed_proxy::`: 16 passed, including real HTTP requests with invalid local authentication proving zero catalog reads, model resolutions, credential acquisitions and upstream dispatches
- `pnpm test -- src/modules/MainApp/Settings/sections/HarnessConnections/AppConnectionPage.test.ts`: 6 passed after fixing duplicate default-model labels and the shared Select accessible-name prop
- `git diff --check`: passed

The local Console and backend are now running against the isolated acceptance database. Cloud PR #109 (`b02e222d`) repaired `ORG2_OAUTH_CONTINUATION_FAILED`; the parent acceptance run observed standard browser SSO return automatically to local Market. Native Package enrollment and calls are still separate pending evidence. Real company Feishu login verifies the production administrator callback only and does not prove native Package enrollment. Browser verification must use the in-app browser, per the user. The remaining real acceptance rows and evidence requirements are tracked in `docs/market-native-package-acceptance.md`.

## Claude Desktop deployment-mode follow-up

Read-only inspection of installed Claude Desktop 2.110.1 established that its
startup selects `deploymentMode` from `Claude-3p/claude_desktop_config.json`.
The previous ORG2 target wrote the similarly named file in `Claude`, so a
saved first-party mode could prevent the configured Package profile from
being selected. The target now follows the actual native reader. Only
`deploymentMode` is owned in that runtime file: native preference changes are
retained across reapply/restore, an external mode change or inline enterprise
configuration remains a conflict, and full-file transaction snapshots still
protect against races. Old active manifests must be restored before adopting
the new target path. No existing user file was migrated or edited in this audit.

The isolated filesystem regression covers existing/missing originals, native
preference writes, mode edits, inline enterprise conflicts, reapply and restore,
including an uncommitted prepared-profile copy that must not replace committed
ownership evidence. The final managed-config suite passed all 64 tests.
Actual native Desktop startup, model selection and calls remain pending and
require a rebuilt debug bundle; the earlier bundle does not contain this fix.
