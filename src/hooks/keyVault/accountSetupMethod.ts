/**
 * How an account was added, persisted on the key as account metadata so that
 * reconnecting offers the same method again. Mirrors
 * `ACCOUNT_SETUP_METHOD_METADATA_KEY` in the key-vault crate, which also reads
 * it to tell a login copied from another tool from one the vault owns.
 */
export const ACCOUNT_SETUP_METHOD_METADATA_KEY = "setup_method";

export const CODEX_SETUP_METHODS = [
  "signin",
  "autodetect",
  "enter_token",
] as const;

export type CodexSetupMethod = (typeof CODEX_SETUP_METHODS)[number];

const DEFAULT_CODEX_SETUP_METHOD: CodexSetupMethod = "signin";

function isCodexSetupMethod(value: unknown): value is CodexSetupMethod {
  return (CODEX_SETUP_METHODS as readonly unknown[]).includes(value);
}

/**
 * The method a Codex reconnect opens on: the one the account was added with.
 * Accounts saved before the method was recorded fall back to sign-in.
 */
export function codexReconnectSetupMethod(
  account: { accountMetadata?: Record<string, string> } | undefined
): CodexSetupMethod {
  const recorded =
    account?.accountMetadata?.[ACCOUNT_SETUP_METHOD_METADATA_KEY];
  return isCodexSetupMethod(recorded) ? recorded : DEFAULT_CODEX_SETUP_METHOD;
}

/**
 * Account metadata to save for a wizard submission, with the setup method the
 * user actually went through. `defaultMethod` is what the agent's setup step
 * shows when the user never touched the method selector.
 */
export function withRecordedSetupMethod(
  metadata: Record<string, string> | undefined,
  setupMethod: string | undefined,
  defaultMethod: string | undefined
): Record<string, string> | undefined {
  const method = setupMethod ?? defaultMethod;
  if (!method) {
    return metadata && Object.keys(metadata).length > 0 ? metadata : undefined;
  }
  return { ...metadata, [ACCOUNT_SETUP_METHOD_METADATA_KEY]: method };
}
