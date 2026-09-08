// @vitest-environment jsdom
import { Provider, createStore } from "jotai";
import { act, createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { createSmokeRoot } from "@src/test/reactSmokeHarness";

import { org2CloudAuthAtom } from "./org2CloudAuthAtom";
import {
  bumpRemoteSessionsInvalidation,
  org2CloudRemoteSessionsVersionAtom,
  useCloudOrgRemoteSessions,
} from "./org2CloudRemoteSessionsAtom";

const mocks = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("./org2CloudClient", () => ({
  ensureFreshSession: async (auth: unknown) => auth,
}));
vi.mock("./org2CloudSyncClient", () => ({ listOrgSessions: mocks.list }));
vi.mock("./org2CloudAuthAtom", async () => {
  const { atom } = await import("jotai");
  return {
    org2CloudAuthAtom: atom({
      userId: "user",
      supabaseUrl: "https://test.invalid",
      accessToken: "test",
    }),
    org2CloudAuthIdentityKey: () => "https://test.invalid|user",
    commitRefreshedAuth: () => true,
  };
});

const root = createSmokeRoot();
afterEach(async () => {
  await root.unmount();
  vi.restoreAllMocks();
  mocks.list.mockReset();
});

it("loads an initially hidden listing when visible without requiring keyboard focus", async () => {
  let visibility: DocumentVisibilityState = "hidden";
  vi.spyOn(document, "visibilityState", "get").mockImplementation(
    () => visibility
  );
  vi.spyOn(document, "hasFocus").mockReturnValue(false);
  mocks.list.mockResolvedValue({ sessions: [] });
  const store = createStore();
  expect(store.get(org2CloudAuthAtom)).not.toBeNull();
  function Listing() {
    const { state } = useCloudOrgRemoteSessions("org");
    return createElement("div", null, state);
  }
  await root.render(createElement(Provider, { store }, createElement(Listing)));
  expect(mocks.list).not.toHaveBeenCalled();

  await act(async () => {
    visibility = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(mocks.list).toHaveBeenCalledTimes(1);
  expect(root.container.textContent).toBe("ready");

  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(mocks.list).toHaveBeenCalledTimes(1);

  await act(async () => {
    visibility = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
    store.set(org2CloudRemoteSessionsVersionAtom, (previous) =>
      bumpRemoteSessionsInvalidation(previous, "org")
    );
  });
  expect(mocks.list).toHaveBeenCalledTimes(1);
  await act(async () => {
    visibility = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(mocks.list).toHaveBeenCalledTimes(2);
});
