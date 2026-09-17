import { atom, getDefaultStore } from "jotai";
import { expect, it, vi } from "vitest";

import { createInstrumentedStore } from "@src/util/core/state/instrumentedStore";

vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));
vi.mock("@src/api/tauri/rpc/invoke", () => ({
  defineProcedure: (name: string) => {
    const builder = {
      input: () => builder,
      output: () => builder,
      build: () => name,
    };
    return builder;
  },
  typedInvoke: async (name: string) =>
    name === "market_connection_begin"
      ? "https://market.org2.dev/buyer/connect/authorize"
      : {
          identity_user_id: "user-a",
          workspace_id: "ws_test",
          target: "org2",
          phase: "authorization_saved",
        },
}));
vi.mock("@src/components/Message", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@src/i18n", () => ({ default: { t: (key: string) => key } }));
vi.mock("@src/features/Org2Cloud/authCallback", () => ({
  decodeJwtSub: () => "user-a",
}));
vi.mock("@src/features/Org2Cloud/org2CloudAuthAtom", () => ({
  org2CloudAuthAtom: atom<unknown>(null),
}));
vi.mock("@src/features/Org2Cloud/completeSignIn", () => ({
  completeOrg2CloudSignIn: (session: unknown, set: (value: unknown) => void) =>
    set(session),
}));
vi.mock("./rpc", () => ({ loadConnections: vi.fn(), loadEntries: vi.fn() }));
vi.mock("./events", () => ({
  MARKET_AUTHORIZATION_SAVED_EVENT: "saved",
  MARKET_CONNECTION_OPEN_EVENT: "open",
  classifyMarketConnectionError: vi.fn(),
  dispatchMarketConnection: vi.fn(),
  dispatchMarketConnectionError: vi.fn(),
  parseMarketTarget: vi.fn(),
}));

it("commits the verified callback to the store used by AppProviders", async () => {
  const { org2CloudAuthAtom } =
    await import("@src/features/Org2Cloud/org2CloudAuthAtom");
  const { handleMarketConnectionUrl } = await import("./deepLink");
  const appStore = createInstrumentedStore();
  expect(appStore).not.toBe(getDefaultStore());
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  handleMarketConnectionUrl(
    `orgii://market/authorized?code=${"c".repeat(43)}&state=${"s".repeat(43)}#access_token=test-access&refresh_token=test-refresh&expires_at=${expiresAt}`
  );
  await vi.waitFor(() =>
    expect(appStore.get(org2CloudAuthAtom)).toEqual({
      accessToken: "test-access",
      refreshToken: "test-refresh",
      expiresAt,
    })
  );
  expect(getDefaultStore().get(org2CloudAuthAtom)).toBeNull();
});

it("reauthorizes a signed-out client instead of only reopening saved profiles", async () => {
  const { org2CloudAuthAtom } =
    await import("@src/features/Org2Cloud/org2CloudAuthAtom");
  const { handleMarketConnectionUrl } = await import("./deepLink");
  const { loadConnections } = await import("./rpc");
  const { openUrl } = await import("@tauri-apps/plugin-opener");
  createInstrumentedStore().set(org2CloudAuthAtom, null);
  handleMarketConnectionUrl(
    "orgii://market/connect?workspace_id=ws_test&target=org2"
  );
  await vi.waitFor(() =>
    expect(openUrl).toHaveBeenCalledWith(
      "https://market.org2.dev/buyer/connect/authorize"
    )
  );
  expect(loadConnections).not.toHaveBeenCalled();
});
