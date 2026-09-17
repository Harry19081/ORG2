# Native Package acceptance checklist

This checklist records the remaining real business-flow acceptance. Passing
unit, isolated filesystem or loopback HTTP tests does not complete these rows.
Use a debug instance and isolated test wallet; do not publish an installer or
merge Package PRs as part of this run.

## Preconditions

- Local Console, control service and gateway are healthy and use the intended
  release checkout and cloned database. Record their commits and database name.
- The browser and debug ORG2 instance authenticate through standard Cloud OAuth
  as the same identity. Use the in-app browser for every web step.
- At least two enabled purchases expose an overlapping model. Record purchase
  IDs, version IDs, exact native-client capabilities and configured buyer/seller
  rates. Rates come from Admin Dashboard; range maximum/minimum are defaults.
- Capture fresh private backups and hashes of each external application's
  actual configuration directory before applying a connection. Identify the
  running process's configuration root. Do not modify the configuration root
  of the Codex task conducting this acceptance.
- One upstream account per provider can verify provider calls and short-token
  renewal, but cannot verify same-provider account rotation. That row requires
  two authorized, healthy accounts of the same provider.

## Evidence matrix

| Flow                       | Action and required evidence                                                                                                                                                                             | Current result                                            |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Web enrollment, signed out | Enable a Package, follow its original deep link, complete Cloud OAuth in the browser, and confirm native enrollment resumes for the same identity without retyping credentials                           | Pending                                                   |
| Identity mismatch          | Use a mismatched native identity and confirm the original enrollment cannot bind to it                                                                                                                   | Pending                                                   |
| Internal ORG2              | Select each purchase and model, send a real request and a continuation, and correlate UI response with exact purchase/request/receipt IDs                                                                | Pending                                                   |
| Claude Code                | Configure two Packages together, open through App Connection, select each alias in the native picker, and complete a real call for both                                                                  | Pending                                                   |
| Claude Desktop             | Configure two Packages together, open the native Code surface, select each alias, and complete a real call for both                                                                                      | Pending                                                   |
| Codex native App           | Use an isolated native configuration root, configure two Packages, select both aliases in the actual App picker, and complete a real call for each                                                       | Pending                                                   |
| Overlapping model routing  | For identical actual model names, observe distinct aliases and verify each real request uses the selected purchase, session and credential; unknown aliases must fail without dispatch                   | Synthetic loopback HTTP coverage only                     |
| Settlement                 | Record admitted price snapshot and normalized usage; independently compute buyer debit and seller credit using configured rates and documented rounding, then correlate ledger and receipt by request ID | Backend isolated PostgreSQL coverage; native flow pending |
| Token renewal              | Reuse the same native selection past its short service-token window; verify a fresh token is acquired, call succeeds, and token values never enter persistent config or reports                          | Source unit coverage only                                 |
| Upstream account rotation  | Cause an authorized local rotation scenario between two same-provider accounts; verify second-account dispatch and exactly one settled request                                                           | Pending; second account required                          |
| Restart                    | Quit ORG2 and external App, confirm process exit, restart the debug instance, reopen through App Connection, and call each persisted alias again                                                         | Serialized metadata/filesystem coverage only              |
| Config conflict            | Make a reversible external config edit; apply and restore must refuse to overwrite it. Revert that edit to its captured bytes before continuing                                                          | Isolated filesystem coverage only                         |
| Restore                    | Disconnect via App Connection; verify original config and any preexisting catalog bytes against fresh backups and confirm no managed process remains                                                     | Isolated filesystem coverage only                         |

## Evidence handling

For every real call record application/version, purchase/model alias, actual
wire model, request ID, usage totals, pricing snapshot, buyer debit and seller
credit. Keep credentials, raw login cookies and access/refresh tokens out of
screenshots, command output, PRs and tracked files. Do not treat a synthetic
HTTP fixture as upstream success or configuration reload as native restart
acceptance.

After restoration, compare all affected files to their recorded pre-run
hashes. Preserve concurrent user changes and report conflicts instead of
force-restoring old backups.

Claude Desktop 2.110.1 reads `deploymentMode` from
`Claude-3p/claude_desktop_config.json`, beside `configLibrary`. ORG2 owns only
that field in this runtime preferences file: native preference additions must
survive reapply and restore, while an external change to `deploymentMode`
must block both operations. The transaction still uses full-file snapshots
and hashes to reject concurrent writes. Older active ORG2 manifests pointing
at `Claude/claude_desktop_config.json` require Restore before applying the new
target; no automatic rewrite of old ownership is performed.

The installed packaged Claude Desktop removes `CLAUDE_USER_DATA_DIR` unless
its signed internal harness authorization validates. `CLAUDE_CONFIG_DIR`
alone isolates Code settings, not the Desktop application. Do not bypass that
validation or claim a CLI invocation verifies the native Desktop UI.
