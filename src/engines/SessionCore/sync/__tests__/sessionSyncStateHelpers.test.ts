import { describe, expect, it, vi } from "vitest";

import { eventStoreProxy } from "@src/engines/SessionCore/core/store/EventStoreProxy";
import { markQueueTurnSettled } from "@src/engines/SessionCore/hooks/session/queueTurnGate";
import { createSessionEventHandlerCallbacks } from "@src/engines/SessionCore/sync/sessionSyncStateHelpers";
import type { SessionEventHandlerStateActions } from "@src/engines/SessionCore/sync/sessionSyncStateHelpers";

vi.mock("@src/engines/SessionCore/core/store/EventStoreProxy", () => ({
  eventStoreProxy: {
    pinSession: vi.fn(),
    unpinSession: vi.fn(),
  },
}));

vi.mock("@src/store/session", () => ({
  updateSessionStatus: vi.fn(),
}));

vi.mock("@src/engines/SessionCore/hooks/session/queueTurnGate", () => ({
  markQueueTurnSettled: vi.fn(),
  markQueueTurnWorking: vi.fn(),
}));

function createActions(): SessionEventHandlerStateActions & {
  streamingMap: Map<string, string>;
} {
  const actions = {
    streamingMap: new Map<string, string>(),
    setSessionContextTokens: vi.fn(),
    setSessionContextUsage: vi.fn(),
    setSessionContextBreakdown: vi.fn(),
    setSessionRuntimeStatus: vi.fn(),
    setSessionRuntimeError: vi.fn(),
    setPendingCancel: vi.fn(),
    setSessionRolledBack: vi.fn(),
    setStreamingDeltaContent: vi.fn((update) => {
      actions.streamingMap =
        typeof update === "function" ? update(actions.streamingMap) : update;
    }),
  };
  return actions;
}

describe("session sync state callbacks", () => {
  it("clears live streaming content before completed status can leave Stop UI stuck", () => {
    const actions = createActions();
    actions.streamingMap.set("session-1", "live answer");
    const callbacks = createSessionEventHandlerCallbacks(
      "session-1",
      actions,
      vi.fn()
    );

    callbacks.onStreamingDelta?.({
      isStreaming: true,
      isThinking: false,
      content: "live answer",
    });
    expect(actions.streamingMap.get("session-1")).toBe("live answer");

    callbacks.onStreamingDelta?.({
      isStreaming: false,
      isThinking: false,
      content: "",
    });
    callbacks.onStatusChange?.("completed");

    expect(actions.streamingMap.has("session-1")).toBe(false);
    expect(actions.setSessionRuntimeStatus).toHaveBeenCalledWith("completed");
    expect(actions.setPendingCancel).toHaveBeenCalledWith(false);
    expect(eventStoreProxy.unpinSession).toHaveBeenCalledWith("session-1");
  });

  it("marks terminal status changes as queue release edges", () => {
    const actions = createActions();
    const callbacks = createSessionEventHandlerCallbacks(
      "session-1",
      actions,
      vi.fn()
    );

    callbacks.onStatusChange?.("completed", undefined, {
      turnId: "turn-1",
      turnStatus: "completed",
    });

    expect(markQueueTurnSettled).toHaveBeenCalledWith(
      "session-1",
      expect.any(Number),
      "turn-1",
      "completed"
    );
  });
});
