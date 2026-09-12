import { beforeEach, describe, expect, it, vi } from "vitest";

import { projectNativeConversationItems } from "@src/engines/SessionCore/conversations/nativeConversationMaterializer";
import type { SessionEvent } from "@src/engines/SessionCore/core/types";
import type { PersistedMessage } from "@src/engines/SessionCore/ingestion/agentMessageAdapters";

import { createRustAgentAdapter } from "../createRustAgentAdapter";

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), usage: vi.fn() }));
vi.mock("@src/util/platform/tauri/init", () => ({ invokeTauri: mocks.invoke }));
vi.mock("@src/api/tauri/rpc", () => ({
  rpc: {
    sessionCore: {
      eventStore: {
        // The native merge command joins durable results without altering arguments.
        mergeToolResults: async ({ events }: { events: SessionEvent[] }) =>
          events
            .filter((event) => event.actionType !== "tool_result")
            .map((event) => {
              const result = events.find(
                (candidate) =>
                  candidate.actionType === "tool_result" &&
                  candidate.callId === event.callId
              );
              return result
                ? {
                    ...event,
                    result: result.result,
                    displayStatus: result.displayStatus,
                  }
                : event;
            }),
      },
    },
  },
}));
vi.mock("../rustAgent/toolUsageCache", () => ({
  loadUsageTelemetry: mocks.usage,
  applyToolUsageToEvents: (events: SessionEvent[]) => events,
  applyLlmUsageToEvents: (events: SessionEvent[]) => events,
}));

function row(
  id: string,
  role: string,
  overrides: Partial<PersistedMessage> = {}
): PersistedMessage {
  return {
    id,
    role,
    sessionId: "sdeagent-parent",
    content: "",
    toolName: null,
    toolCallId: null,
    toolInput: null,
    toolOutput: null,
    model: null,
    sequence: 1,
    createdAt: "2026-09-12T00:00:00Z",
    images: null,
    ...overrides,
  };
}

function adapterFor(args: Record<string, unknown>) {
  const rows = [
    row("user", "user", { content: "original user input" }),
    row("call", "tool_call", {
      toolName: "agent",
      toolCallId: "call-1",
      toolInput: JSON.stringify(args),
    }),
    row("result", "tool_result", {
      toolName: "agent",
      toolCallId: "call-1",
      toolOutput: "FAST_OK",
    }),
  ];
  return createRustAgentAdapter({
    category: "agent",
    features: {},
    loadMessages: async () => rows,
    cancel: async () => {},
    transformUserText: () => "display-only text",
  });
}

describe("Rust Agent authoritative history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.invoke.mockResolvedValue([
      { sessionId: "child", parentEventId: "call" },
    ]);
    mocks.usage.mockResolvedValue({
      toolUsageByCallId: new Map(),
      llmUsageByTurnId: new Map(),
    });
  });

  it("keeps display backfills out of canonical tool arguments across repeated reads", async () => {
    const args = {
      description: "Fast echo reply",
      model: "fast",
      prompt: "Reply FAST_OK",
    };
    const adapter = adapterFor(args);
    const signal = new AbortController().signal;
    const display = await adapter.loadHistory("sdeagent-parent", signal);
    expect(display.find((event) => event.id === "call")?.args).toEqual({
      ...args,
      subagentSessionId: "child",
      action: "delegate",
    });
    expect(display[0].displayText).toBe("display-only text");
    mocks.invoke.mockClear();
    mocks.usage.mockClear();

    for (let index = 0; index < 2; index++) {
      const events = await adapter.loadAuthoritativeHistory!(
        "sdeagent-parent",
        signal
      );
      expect(events[0].displayText).toBe("original user input");
      const items = projectNativeConversationItems(events);
      expect(items.find((item) => item.kind === "tool_call")).toMatchObject({
        arguments: JSON.stringify(args),
      });
      expect(items.find((item) => item.kind === "tool_result")).toMatchObject({
        output: "FAST_OK",
      });
    }
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.usage).not.toHaveBeenCalled();
  });

  it("preserves same-named arguments when they were actually persisted by the model", async () => {
    const args = {
      action: "inspect",
      subagentSessionId: "model-authored",
      model: "fast",
    };
    const events = await adapterFor(args).loadAuthoritativeHistory!(
      "sdeagent-parent",
      new AbortController().signal
    );
    expect(
      projectNativeConversationItems(events).find(
        (item) => item.kind === "tool_call"
      )
    ).toMatchObject({ arguments: JSON.stringify(args) });
  });
});
