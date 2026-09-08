import { beforeEach, describe, expect, it, vi } from "vitest";

import { runSessionSwitchOrchestrator } from "../sessionSwitchOrchestrator";
import type { SessionAdapter } from "../types";

const mocks = vi.hoisted(() => ({
  applyPostLoadResult: vi.fn(),
  capturePostLoadLifecycleSnapshot: vi.fn(() => ({
    lastTerminal: null,
    generation: 0,
  })),
  dispatchLoadSession: vi.fn(),
  getEvents: vi.fn(),
  hydrateSessionStoreBeforeDisplay: vi.fn(),
  isCollaborationImportedSession: vi.fn(() => false),
  loadInitialTurnWindow: vi.fn(),
  loadPersistedHistory: vi.fn(),
  messageError: vi.fn(),
  reconcileInFlightHistory: vi.fn(),
  rehydratePendingPlanApproval: vi.fn(),
  switchSession: vi.fn(),
}));

vi.mock("@src/components/Message", () => ({
  Message: { error: mocks.messageError },
}));

vi.mock("@src/engines/SessionCore/core/store/EventStoreProxy", () => ({
  eventStoreProxy: {
    getEvents: mocks.getEvents,
    loadInitialTurnWindow: mocks.loadInitialTurnWindow,
    switchSession: mocks.switchSession,
  },
}));

vi.mock("@src/engines/SessionCore/ingestion/visibilityFilters", () => ({
  isVisibleInChat: () => true,
}));

vi.mock("@src/util/session/sessionDispatch", () => ({
  composerIdFromSessionId: () => null,
  isCollaborationImportedSession: mocks.isCollaborationImportedSession,
  isImportedHistorySession: () => false,
}));

vi.mock("../sessionSyncDerivedState", () => ({
  isCursorIdeSessionId: () => false,
}));

vi.mock("../sessionSyncPlanApproval", () => ({
  rehydratePendingPlanApproval: mocks.rehydratePendingPlanApproval,
}));

vi.mock("../sessionSyncReconcile", () => ({
  reconcileInFlightHistory: mocks.reconcileInFlightHistory,
}));

vi.mock("../sessionSyncStateHelpers", () => ({
  applyPostLoadResult: mocks.applyPostLoadResult,
  capturePostLoadLifecycleSnapshot: mocks.capturePostLoadLifecycleSnapshot,
  isPostLoadRunStatusSuperseded: vi.fn(() => false),
}));

vi.mock("../sessionSyncUtils", () => ({
  hydrateSessionStoreBeforeDisplay: mocks.hydrateSessionStoreBeforeDisplay,
  isInFlightRunStatus: (status: string | undefined) =>
    status === "running" ||
    status === "waiting_for_user" ||
    status === "waiting_for_funds",
  loadPersistedHistory: mocks.loadPersistedHistory,
}));

function createActions() {
  return {
    dispatchLoadSession: mocks.dispatchLoadSession,
    failSessionLoad: vi.fn(),
    setEvents: vi.fn(),
    setLoadStatus: vi.fn(),
    setSessionContextTokens: vi.fn(),
    setSessionContextUsage: vi.fn(),
    setSessionRuntimeError: vi.fn(),
    setSessionRuntimeStatus: vi.fn(),
    setWpReadOnly: vi.fn(),
  };
}

describe("runSessionSwitchOrchestrator reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isCollaborationImportedSession.mockReturnValue(false);
    mocks.switchSession.mockResolvedValue(true);
    mocks.getEvents.mockResolvedValue([{ id: "visible" }]);
  });

  it("uses the complete persisted projection on an imported-session cache hit", async () => {
    const sessionId = "imported-session-retry";
    const events = [{ id: "history" }, { id: "failed-delivery" }];
    mocks.isCollaborationImportedSession.mockReturnValue(true);
    mocks.loadPersistedHistory.mockResolvedValue(events);
    const adapter = {
      category: "agent",
      postLoad: vi.fn().mockResolvedValue({ runStatus: "idle" }),
    } as unknown as SessionAdapter;
    runSessionSwitchOrchestrator({
      sessionId,
      adapter,
      abortController: new AbortController(),
      refs: { liveSessionIdRef: { current: sessionId } },
      actions: createActions(),
      setPendingPlanApprovals: vi.fn(),
      logger: { error: vi.fn() } as never,
    });

    await vi.waitFor(() =>
      expect(mocks.dispatchLoadSession).toHaveBeenCalledOnce()
    );
    expect(mocks.loadPersistedHistory).toHaveBeenCalledWith(
      adapter,
      sessionId,
      expect.any(AbortSignal)
    );
    expect(mocks.hydrateSessionStoreBeforeDisplay).toHaveBeenCalledWith(
      sessionId,
      events
    );
    expect(mocks.dispatchLoadSession).toHaveBeenCalledWith(
      expect.objectContaining({ events })
    );
    expect(mocks.loadInitialTurnWindow).not.toHaveBeenCalled();
  });

  it.each([
    [undefined, false],
    ["idle", false],
    ["completed", false],
    ["running", true],
    ["waiting_for_user", true],
    ["waiting_for_funds", true],
  ] as const)(
    "reconciles only an in-flight session (status=%s)",
    async (runStatus, shouldReconcile) => {
      const adapter = {
        category: "cli",
        loadHistory: vi.fn(),
        postLoad: vi
          .fn()
          .mockResolvedValue(runStatus === undefined ? {} : { runStatus }),
      } as unknown as SessionAdapter;

      runSessionSwitchOrchestrator({
        sessionId: "cli-session",
        adapter,
        abortController: new AbortController(),
        refs: { liveSessionIdRef: { current: "cli-session" } },
        actions: createActions(),
        setPendingPlanApprovals: vi.fn(),
        logger: { error: vi.fn() } as never,
      });

      await vi.waitFor(() => {
        expect(mocks.dispatchLoadSession).toHaveBeenCalledOnce();
      });
      expect(mocks.reconcileInFlightHistory).toHaveBeenCalledTimes(
        shouldReconcile ? 1 : 0
      );
    }
  );
});
