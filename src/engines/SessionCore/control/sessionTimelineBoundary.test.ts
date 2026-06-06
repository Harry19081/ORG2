import { beforeEach, describe, expect, it, vi } from "vitest";

import { CANCEL_REASON } from "@src/api/tauri/agent";

import {
  beginStopBoundary,
  cancelTurnForTimelineBoundary,
  isTimelineInterruptInFlight,
} from "./sessionTimelineBoundary";

const storeSetSpy = vi.hoisted(() => vi.fn());
const interruptSpy = vi.hoisted(() => vi.fn());
const markStoppedSpy = vi.hoisted(() => vi.fn());

vi.mock("@src/util/core/state/instrumentedStore", () => ({
  getInstrumentedStore: () => ({ set: storeSetSpy }),
}));

vi.mock("@src/engines/SessionCore/services/SessionService", () => ({
  SessionService: {
    interrupt: interruptSpy,
  },
}));

vi.mock(
  "@src/engines/SessionCore/sync/adapters/rustAgent/eventHandlers/streamHelpers",
  () => ({
    markSessionStreamingStopped: markStoppedSpy,
  })
);

describe("sessionTimelineBoundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("makes Stop boundary local and O(1)", () => {
    beginStopBoundary("session-1");

    expect(markStoppedSpy).toHaveBeenCalledWith("session-1");
    expect(storeSetSpy).toHaveBeenCalled();
    expect(interruptSpy).not.toHaveBeenCalled();
  });

  it("deduplicates concurrent Stop interrupts for the same session", async () => {
    let resolveInterrupt!: () => void;
    interruptSpy.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveInterrupt = resolve;
        })
    );

    const first = cancelTurnForTimelineBoundary("session-1", "stop");
    const second = cancelTurnForTimelineBoundary("session-1", "stop");

    expect(isTimelineInterruptInFlight("session-1", "stop")).toBe(true);
    expect(interruptSpy).toHaveBeenCalledTimes(1);
    expect(interruptSpy).toHaveBeenCalledWith({
      sessionId: "session-1",
      reason: CANCEL_REASON.USER_STOP,
      onError: undefined,
    });

    resolveInterrupt();
    await Promise.all([first, second]);

    expect(isTimelineInterruptInFlight("session-1", "stop")).toBe(false);
  });

  it("keeps force-send and Stop boundaries independently deduplicated", async () => {
    interruptSpy.mockResolvedValue(undefined);

    await Promise.all([
      cancelTurnForTimelineBoundary("session-1", "stop"),
      cancelTurnForTimelineBoundary("session-1", "force-send"),
    ]);

    expect(interruptSpy).toHaveBeenCalledTimes(2);
    expect(interruptSpy).toHaveBeenNthCalledWith(1, {
      sessionId: "session-1",
      reason: CANCEL_REASON.USER_STOP,
      onError: undefined,
    });
    expect(interruptSpy).toHaveBeenNthCalledWith(2, {
      sessionId: "session-1",
      reason: CANCEL_REASON.FORCE_SEND,
      onError: undefined,
    });
  });
});
