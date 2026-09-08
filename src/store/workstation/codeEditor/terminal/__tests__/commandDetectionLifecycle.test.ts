import { createStore } from "jotai/vanilla";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  commandDetectionMapAtom,
  commandExecutedAtom,
  commandPromptStartAtom,
} from "../commandDetection";
import {
  activeTerminalIdAtom,
  closeTerminalSessionAtom,
  terminalSessionsAtom,
} from "../index";

vi.mock("@src/util/platform/tauri/init", () => ({
  invokeTauri: vi.fn().mockResolvedValue(undefined),
  isTauriReady: vi.fn().mockReturnValue(false),
}));

vi.mock("@src/util/ui/terminal/creationThrottle", () => ({
  tryBeginTerminalCreation: vi.fn().mockReturnValue(true),
  notifyTerminalCreationCooldown: vi.fn(),
}));

vi.mock("@src/config/settingsSchema", () => ({
  getSettingsDefaults: vi.fn().mockReturnValue({
    "terminal.shellType": "default",
    "terminal.customShellPath": "",
  }),
}));

/**
 * Regression: OSC-633 command-detection state (up to 200 command entries per
 * terminal) was only ever added to; `removeCommandDetectionAtom` had no
 * caller, so the map grew with every terminal session ever opened.
 */
describe("command detection lifecycle", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
    store.set(terminalSessionsAtom, [
      { id: "t-1", name: "Terminal 1", isActive: true },
      { id: "t-2", name: "Terminal 2", isActive: false },
    ]);
    store.set(activeTerminalIdAtom, "t-1");
  });

  it("drops a terminal's command history when the terminal is closed", async () => {
    store.set(commandPromptStartAtom, "t-2");
    store.set(commandExecutedAtom, { sessionId: "t-2", commandLine: "ls -la" });
    expect(store.get(commandDetectionMapAtom).has("t-2")).toBe(true);

    await store.set(closeTerminalSessionAtom, "t-2");

    expect(store.get(commandDetectionMapAtom).has("t-2")).toBe(false);
    // Other sessions untouched.
    store.set(commandPromptStartAtom, "t-1");
    expect(store.get(commandDetectionMapAtom).has("t-1")).toBe(true);
  });

  it("closes an existing read-only agent tab through the normal terminal action", async () => {
    const tabId = "agent-session-legacy-1";
    store.set(terminalSessionsAtom, (sessions) => [
      ...sessions,
      {
        id: tabId,
        name: "Agent",
        isActive: false,
        readOnly: true,
        agentSessionId: "legacy-1",
      },
    ]);
    store.set(commandPromptStartAtom, tabId);

    await store.set(closeTerminalSessionAtom, tabId);

    expect(
      store.get(terminalSessionsAtom).map((session) => session.id)
    ).toEqual(["t-1", "t-2"]);
    expect(store.get(activeTerminalIdAtom)).toBe("t-1");
    expect(store.get(commandDetectionMapAtom).has(tabId)).toBe(false);
  });
});
