// @vitest-environment jsdom
import { Provider } from "jotai";
import { act, createElement } from "react";
import { expect, it, vi } from "vitest";

import {
  STATION_WINDOW_READY_EVENT,
  emitStationWindowSession,
} from "@src/api/tauri/stationWindow";
import { workstationActiveSessionIdAtom } from "@src/store/session/viewAtom";
import { createSmokeRoot } from "@src/test/reactSmokeHarness";
import { createInstrumentedStore } from "@src/util/core/state/instrumentedStore";

import { useStationWindowBridge } from "../useStationWindowBridge";

const handlers = vi.hoisted(() => new Map<string, (payload: string) => void>());
vi.mock("@src/hooks/platform/useTauriListen", () => ({
  useTauriListen: (event: string, handler: (payload: string) => void) =>
    handlers.set(event, handler),
}));
vi.mock("@src/util/platform/tauri/windowIdentity", async (original) => ({
  ...(await original<
    typeof import("@src/util/platform/tauri/windowIdentity")
  >()),
  getCurrentWindowLabel: () => "main",
  isMainAppWindow: () => true,
}));
vi.mock("@src/api/tauri/stationWindow", async (original) => ({
  ...(await original<typeof import("@src/api/tauri/stationWindow")>()),
  emitStationWindowSession: vi.fn(async () => {}),
}));

it("answers a late listener with current selection without resetting its chosen station", async () => {
  const store = createInstrumentedStore();
  function Bridge() {
    useStationWindowBridge();
    return null;
  }
  const root = createSmokeRoot();
  await root.render(createElement(Provider, { store }, createElement(Bridge)));
  try {
    await act(async () => {
      store.set(workstationActiveSessionIdAtom, "session-B");
    });
    vi.mocked(emitStationWindowSession).mockClear();
    handlers.get(STATION_WINDOW_READY_EVENT)!("app-window-station-my-station");
    expect(emitStationWindowSession).toHaveBeenCalledWith(
      "my-station",
      "session-B"
    );
    expect(emitStationWindowSession).toHaveBeenCalledTimes(1);
    handlers.get(STATION_WINDOW_READY_EVENT)!("unrelated-window");
    expect(emitStationWindowSession).toHaveBeenCalledTimes(1);
  } finally {
    await root.unmount();
  }
  vi.mocked(emitStationWindowSession).mockClear();
  store.set(workstationActiveSessionIdAtom, "session-C");
  expect(emitStationWindowSession).not.toHaveBeenCalled();
});
