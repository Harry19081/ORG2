import { ACTION_ID } from "@src/ActionSystem/actionIds";
import type { SessionEvent } from "@src/engines/SessionCore";
import type { SlashItem } from "@src/types/extensions";

export const COMPOSER_COMMAND_ACTIONS: Readonly<Record<string, string>> = {
  new: ACTION_ID.SPOTLIGHT_OPEN_SESSION_CREATOR,
  clear: ACTION_ID.SPOTLIGHT_OPEN_SESSION_CREATOR,
  resume: ACTION_ID.SPOTLIGHT_OPEN_AGENT_SESSION_SEARCH,
  settings: ACTION_ID.APP_GO_TO_SETTINGS,
  config: ACTION_ID.APP_GO_TO_SETTINGS,
  mcp: ACTION_ID.APP_GO_TO_INTEGRATIONS,
  login: ACTION_ID.APP_GO_TO_MODEL_KEYS,
  diff: ACTION_ID.WORKSTATION_OPEN_SOURCE_CONTROL_TAB,
};

export function composerActionFor(name: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(COMPOSER_COMMAND_ACTIONS, name)
    ? COMPOSER_COMMAND_ACTIONS[name]
    : undefined;
}

export function parseNativeSlashCommand(
  text: string
): { name: string; args: string } | null {
  const match = /^\/([a-zA-Z][\w:-]*)(?:\s+([\s\S]*))?$/.exec(text.trim());
  return match ? { name: match[1], args: match[2]?.trim() ?? "" } : null;
}

/** Read only when the menu opens, never subscribe the composer to every chunk. */
export function nativeSlashNames(
  provider: string | undefined,
  sessionId: string,
  events: readonly SessionEvent[]
): string[] {
  if (provider !== "codex" && provider !== "claude_code") return [];
  const builtin =
    provider === "codex" ? ["compact", "review", "init", "status"] : [];
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index];
    if (event.sessionId !== sessionId || event.actionType !== "session_start")
      continue;
    if (event.args.native_provider !== provider) continue;
    const commands = event.args.slash_commands;
    if (!Array.isArray(commands)) continue;
    const terminalOnly = new Set(
      Array.isArray(event.args.terminal_slash_commands)
        ? event.args.terminal_slash_commands
        : []
    );
    return [
      ...new Set(
        [...builtin, ...commands].filter(
          (name): name is string =>
            typeof name === "string" &&
            !terminalOnly.has(name) &&
            /^[a-zA-Z][\w:-]{0,255}$/.test(name)
        )
      ),
    ].slice(0, 512);
  }
  // Available before the first init; installed/plugin commands join after the
  // provider reports its actual catalog. Do not infer commands from model text.
  return provider === "codex" ? builtin : ["compact", "context", "init"];
}

export function buildNativeSlashItems(
  names: readonly string[],
  description: (name: string) => string,
  provider: string
): SlashItem[] {
  return names.map((name) => ({
    name,
    description: description(name),
    category: "action",
    source: provider,
    acceptsArgs: true,
  }));
}
