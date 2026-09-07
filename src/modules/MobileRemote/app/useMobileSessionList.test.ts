// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import type { MobileRpcClient } from "../connection/mobileRpcClient";
import { useMobileSessionList } from "./useMobileSessionList";

describe("useMobileSessionList", () => {
  it("invalidates old roster requests on reset and restarts pagination", async () => {
    const env = globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    };
    env.IS_REACT_ACT_ENVIRONMENT = true;
    let resolve!: (value: unknown) => void;
    const pending = new Promise((r) => {
      resolve = r;
    });
    const call = vi
      .fn()
      .mockReturnValueOnce(pending)
      .mockResolvedValue({ sessions: [], nextOffset: 50, hasMore: true });
    const client = { call } as unknown as MobileRpcClient;
    const clientRef = { current: client as MobileRpcClient | null };
    let roster!: ReturnType<typeof useMobileSessionList>;
    function Harness() {
      const value = useMobileSessionList(clientRef);
      React.useLayoutEffect(() => {
        roster = value;
      });
      return null;
    }
    const root = createRoot(document.createElement("div"));
    try {
      await act(async () => root.render(React.createElement(Harness)));
      let request!: Promise<void>;
      await act(async () => {
        request = roster.requestSessionList(client);
      });
      await act(async () => roster.resetSessions());
      await act(async () => {
        resolve({ sessions: [{ id: "old-desktop" }], hasMore: false });
        await request;
      });
      expect(roster.sessions).toEqual([]);
      await act(async () => roster.requestSessionList(client));
      expect(roster.sessionsHasMore).toBe(true);
      await act(async () => roster.resetSessions());
      expect(roster.sessionsHasMore).toBe(false);
      await act(async () => roster.requestSessionList(client));
      expect(call).toHaveBeenLastCalledWith("session/list", { offset: 0 });
    } finally {
      await act(async () => root.unmount());
      env.IS_REACT_ACT_ENVIRONMENT = false;
    }
  });
});
