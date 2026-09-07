// @vitest-environment jsdom
import React, { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMobileRemoteCoordinator } from "./useMobileRemoteCoordinator";

const mocks = vi.hoisted(() => ({ stopSession: vi.fn(), disconnect: vi.fn() }));
vi.mock("../app", () => ({
  useMobileRemote: () => ({
    connection: { status: "disconnected", demoMode: false },
    sessions: [],
    ...mocks,
  }),
}));

describe("useMobileRemoteCoordinator", () => {
  let root: Root;
  let container: HTMLDivElement;
  let current: ReturnType<typeof useMobileRemoteCoordinator>;
  const environment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  };
  let previous: boolean | undefined;
  function Probe({ intent = null }: { intent?: string | null }) {
    const value = useMobileRemoteCoordinator(intent);
    React.useEffect(() => {
      current = value;
    });
    return React.createElement("div", null, value.nav.screen);
  }
  beforeEach(() => {
    previous = environment.IS_REACT_ACT_ENVIRONMENT;
    environment.IS_REACT_ACT_ENVIRONMENT = true;
    mocks.stopSession.mockReset().mockResolvedValue(undefined);
    mocks.disconnect.mockReset().mockResolvedValue(undefined);
    container = document.createElement("div");
    root = createRoot(container);
    act(() => root.render(React.createElement(Probe)));
  });
  afterEach(() => {
    act(() => root.unmount());
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  });
  it("consumes a recovered pairing link once and preserves subsequent navigation", () => {
    const intent = "wss://relay.example.com/mobile/ws?token=test";
    act(() => root.render(React.createElement(Probe, { intent })));
    expect(container.textContent).toBe("connecting");
    act(() => current.handleConnectingComplete());
    act(() => root.render(React.createElement(Probe, { intent })));
    expect(container.textContent).toBe("sessions");
    expect(current.nav.pendingConfig).toBeNull();
  });
  it("keeps SAS confirmation before connecting and clears pairing data on completion", () => {
    act(() =>
      current.handleAcceptPairing({
        config: { wsUrl: "wss://relay.example.com" },
        requiresSas: true,
        sasPhrase: "test-phrase",
      })
    );
    expect(container.textContent).toBe("sas");
    act(() => current.dispatch({ type: "confirm_sas" }));
    expect(container.textContent).toBe("connecting");
    act(() => current.handleConnectingComplete());
    expect(current.nav.sasPhrase).toBe("");
    expect(current.nav.pendingConfig).toBeNull();
  });
  it("single-flights stop and ignores completion after switching sessions", async () => {
    let finish!: () => void;
    mocks.stopSession.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    act(() => {
      current.dispatch({ type: "select_session", sessionId: "a" });
      current.dispatch({ type: "open_stop_modal" });
    });
    let pending!: Promise<void>;
    await act(async () => {
      pending = current.handleConfirmStop();
      await current.handleConfirmStop();
    });
    expect(mocks.stopSession).toHaveBeenCalledTimes(1);
    expect(current.stopConfirming).toBe(true);
    act(() => {
      current.dispatch({ type: "back_from_chat" });
      current.dispatch({ type: "select_session", sessionId: "b" });
      current.dispatch({ type: "open_stop_modal" });
    });
    await act(async () => {
      finish();
      await pending;
    });
    expect(current.nav.selectedSessionId).toBe("b");
    expect(current.nav.stopModalOpen).toBe(true);
    expect(current.stopConfirming).toBe(false);
  });
  it("releases the stop lock after rejection so another attempt is possible", async () => {
    act(() => current.dispatch({ type: "select_session", sessionId: "a" }));
    mocks.stopSession.mockRejectedValueOnce(new Error("offline"));
    await act(async () => {
      await expect(current.handleConfirmStop()).rejects.toThrow("offline");
    });
    expect(current.stopConfirming).toBe(false);
    await act(async () => {
      await current.handleConfirmStop();
    });
    expect(mocks.stopSession).toHaveBeenCalledTimes(2);
  });
});
