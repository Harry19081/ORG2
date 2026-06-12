import type { SessionEvent } from "@src/engines/SessionCore/core/types";

import { deriveProjectState } from "../config";

function makeEvent(overrides: Partial<SessionEvent>): SessionEvent {
  return {
    chunk_id: null,
    id: "event-1",
    sessionId: "session-1",
    createdAt: "2026-05-20T00:00:00.000Z",
    functionName: "manage_work_item",
    uiCanonical: "manage_work_item",
    actionType: "tool_call",
    args: {},
    result: {
      observation: "Created work item 'Fix null args' [WI-001]",
    },
    source: "assistant",
    displayText: "",
    displayStatus: "completed",
    displayVariant: "tool_call",
    activityStatus: "processed",
    ...overrides,
  };
}

describe("deriveProjectState", () => {
  it("normalizes null args from persisted events", () => {
    const event = makeEvent({
      args: null as unknown as SessionEvent["args"],
    });

    const state = deriveProjectState([event], event.id);

    expect(state.selectedOperation?.args).toEqual({});
    expect(state.selectedOperation?.resultText).toBe(
      "Created work item 'Fix null args' [WI-001]"
    );
  });
});
