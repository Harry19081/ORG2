import { describe, expect, it } from "vitest";

import type {
  DerivedSnapshot,
  StreamingSnapshot,
} from "@src/engines/SessionCore/core/store";
import type { SessionEvent } from "@src/engines/SessionCore/core/types";

import { extractShareableSnapshotEvents } from "../hostPublisher";

function event(id: string, createdAt: string): SessionEvent {
  return {
    chunk_id: id,
    id,
    sessionId: "osagent-session-1",
    createdAt,
    functionName: "read_file",
    uiCanonical: "read_file",
    actionType: "tool_call",
    args: {},
    result: {},
    source: "assistant",
    displayText: id,
    displayStatus: "completed",
    displayVariant: "tool_call",
    activityStatus: "agent",
  };
}

describe("hostPublisher snapshot event extraction", () => {
  it("uses full event lists from derived snapshots", () => {
    const firstEvent = event("chat-1", "2026-06-15T00:00:00.000Z");
    const secondEvent = event("tool-1", "2026-06-15T00:00:01.000Z");
    const snapshot = {
      version: 1,
      eventCount: 2,
      events: [firstEvent, secondEvent],
      chatEvents: [firstEvent],
      messagesEvents: [firstEvent],
      sortedSimulatorEvents: [secondEvent],
      lastEvent: secondEvent,
      eventIndex: { "chat-1": 0, "tool-1": 1 },
      chatEventCount: 1,
      hasRunningEvent: false,
    } satisfies DerivedSnapshot;

    expect(
      extractShareableSnapshotEvents(snapshot).map((item) => item.id)
    ).toEqual(["chat-1", "tool-1"]);
  });

  it("includes Rust agent simulator upserts from streaming snapshots", () => {
    const chatEvent = event("chat-1", "2026-06-15T00:00:00.000Z");
    const simulatorEvent = event("tool-1", "2026-06-15T00:00:01.000Z");
    const simulatorUpdate = {
      ...simulatorEvent,
      displayStatus: "running",
    } satisfies SessionEvent;
    const snapshot = {
      version: 2,
      eventCount: 2,
      chatEvents: [chatEvent],
      sortedSimulatorEvents: [simulatorEvent],
      simulatorEventUpserts: [simulatorUpdate],
      lastEvent: simulatorUpdate,
      streaming: true,
      hasRunningEvent: true,
    } satisfies StreamingSnapshot;

    expect(extractShareableSnapshotEvents(snapshot)).toEqual([
      chatEvent,
      simulatorUpdate,
    ]);
  });
});
