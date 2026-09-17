import { openUrl } from "@tauri-apps/plugin-opener";
import { atom, getDefaultStore } from "jotai";
import { beforeEach, expect, it, vi } from "vitest";

import { ORG2_CLOUD_OFFICIAL_SUPABASE_URL } from "@src/features/Org2Cloud/config";
import { org2CloudAuthAtom } from "@src/features/Org2Cloud/org2CloudAuthAtom";
import { createInstrumentedStore } from "@src/util/core/state/instrumentedStore";

import { handleMarketConnectionUrl } from "./deepLink";
import {
  dispatchMarketConnection,
  dispatchMarketConnectionError,
} from "./events";
import { loadConnections, loadEntries } from "./rpc";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  signIn: vi.fn(),
  ready: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@src/api/http/auth/sharedAuthStorage", () => ({
  awaitNativeCloudOwnerReady: mocks.ready,
}));
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
  typedInvoke: mocks.invoke,
}));
vi.mock("@src/components/Message", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@src/i18n", () => ({ default: { t: (key: string) => key } }));
vi.mock("@src/features/Org2Cloud/org2CloudAuthAtom", () => ({
  org2CloudAuthAtom: atom<unknown>(null),
}));
vi.mock("@src/features/Org2Cloud/useOrg2CloudSignIn", () => ({
  openOrg2CloudSignIn: mocks.signIn,
}));
vi.mock("@src/features/Org2Cloud/org2CloudAuthAction", () => ({
  refreshOrg2CloudAuthForAction: mocks.refresh,
}));
vi.mock("./rpc", () => ({
  loadConnections: vi.fn(async () => ({ connections: [] })),
  loadEntries: vi.fn(async () => []),
}));
vi.mock("./events", () => ({
  MARKET_AUTHORIZATION_SAVED_EVENT: "saved",
  MARKET_CONNECTION_OPEN_EVENT: "open",
  classifyMarketConnectionError: vi.fn(),
  dispatchMarketConnection: vi.fn(),
  dispatchMarketConnectionError: vi.fn(),
  parseMarketTarget: (target: string | null) => target,
}));

const auth = {
  userId: "user-a",
  oauthClientId: "desktop-client",
  accessToken: "synthetic-cloud-token",
  supabaseUrl: ORG2_CLOUD_OFFICIAL_SUPABASE_URL,
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.signIn.mockReset();
  mocks.ready.mockReset().mockResolvedValue(undefined);
  mocks.refresh
    .mockReset()
    .mockImplementation(async (auth: unknown) => ({ status: "ready", auth }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        code: "k".repeat(43),
        state: "q".repeat(43),
        expires_at: new Date(Date.now() + 80_000).toISOString(),
      })
    )
  );
  createInstrumentedStore().set(org2CloudAuthAtom, null);
  mocks.invoke.mockImplementation(async (name: string) =>
    name === "market_connection_begin"
      ? `https://market.org2.dev/buyer/connect/authorize?workspace_id=ws_test&target=org2&state=${"q".repeat(43)}&challenge=${"v".repeat(43)}`
      : {
          identity_user_id: "user-a",
          workspace_id: "ws_test",
          target: "org2",
          phase: "authorization_saved",
          identity_session: {
            access_token: "untrusted",
            refresh_token: "untrusted",
            expires_at: 9999999999,
          },
        }
  );
});
it("signs in through Cloud and resumes the exact original Market selection", async () => {
  const raw = "orgii://market/connect?workspace_id=ws_test&target=org2";
  handleMarketConnectionUrl(raw);
  await vi.waitFor(() => expect(mocks.signIn).toHaveBeenCalledOnce());
  expect(mocks.invoke).not.toHaveBeenCalled();
  createInstrumentedStore().set(org2CloudAuthAtom, auth as never);
  mocks.signIn.mock.calls[0][0].onSignedIn();
  await vi.waitFor(() =>
    expect(mocks.invoke).toHaveBeenCalledWith("market_connection_begin", {
      raw,
    })
  );
  await vi.waitFor(() =>
    expect(dispatchMarketConnection).toHaveBeenCalledOnce()
  );
  expect(openUrl).not.toHaveBeenCalled();
  expect(JSON.stringify(mocks.invoke.mock.calls)).not.toContain(
    auth.accessToken
  );
});
it("waits for canonical auth persistence and verification when sign-in immediately resumes a first Package handoff", async () => {
  let finish!: () => void;
  mocks.ready.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      })
  );
  const raw = "orgii://market/connect?workspace_id=ws_test&target=org2";
  handleMarketConnectionUrl(raw);
  await vi.waitFor(() => expect(mocks.signIn).toHaveBeenCalledOnce());
  createInstrumentedStore().set(org2CloudAuthAtom, auth as never);
  mocks.signIn.mock.calls[0][0].onSignedIn();
  await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
  expect(loadConnections).not.toHaveBeenCalled();
  expect(mocks.invoke).not.toHaveBeenCalled();
  finish();
  await vi.waitFor(() =>
    expect(mocks.invoke).toHaveBeenCalledWith("market_connection_begin", {
      raw,
    })
  );
  await vi.waitFor(() =>
    expect(dispatchMarketConnection).toHaveBeenCalledOnce()
  );
});

it("waits for a background token refresh to synchronize before redeeming authorization", async () => {
  let finish!: () => void;
  mocks.refresh.mockImplementationOnce(async (current: unknown) => {
    mocks.ready.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    return { status: "ready", auth: current };
  });
  createInstrumentedStore().set(org2CloudAuthAtom, auth as never);
  handleMarketConnectionUrl(
    "orgii://market/connect?workspace_id=ws_test&target=org2"
  );
  await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
  expect(
    mocks.invoke.mock.calls.some(
      ([name]) => name === "market_connection_complete"
    )
  ).toBe(false);
  finish();
  await vi.waitFor(() =>
    expect(dispatchMarketConnection).toHaveBeenCalledOnce()
  );
  expect(
    mocks.invoke.mock.calls.some(
      ([name]) => name === "market_connection_complete"
    )
  ).toBe(true);
});

it("never signs Cloud in using Market callback fragments or identity_session", async () => {
  const store = createInstrumentedStore();
  handleMarketConnectionUrl(
    `orgii://market/authorized?code=${"c".repeat(43)}&state=${"s".repeat(43)}#access_token=injected&refresh_token=injected&expires_at=9999999999`
  );
  await vi.waitFor(() =>
    expect(dispatchMarketConnectionError).toHaveBeenCalled()
  );
  expect(store.get(org2CloudAuthAtom)).toBeNull();
  expect(getDefaultStore().get(org2CloudAuthAtom)).toBeNull();
  expect(dispatchMarketConnection).not.toHaveBeenCalled();
});
it("binds native redemption to the current App identity", async () => {
  const store = createInstrumentedStore();
  store.set(org2CloudAuthAtom, auth as never);
  handleMarketConnectionUrl(
    `orgii://market/authorized?code=${"d".repeat(43)}&state=${"t".repeat(43)}`
  );
  await vi.waitFor(() => expect(dispatchMarketConnection).toHaveBeenCalled());
  expect(mocks.invoke).toHaveBeenCalledWith(
    "market_connection_complete",
    expect.objectContaining({ expectedIdentityUserId: "user-a" })
  );
  expect(store.get(org2CloudAuthAtom)).toBe(auth);
});
it("never reuses another account's saved connection", async () => {
  createInstrumentedStore().set(org2CloudAuthAtom, auth as never);
  vi.mocked(loadConnections).mockResolvedValueOnce({
    connections: [
      {
        identity_user_id: "user-b",
        workspace_id: "ws_test",
        target: "org2",
        phase: "authorization_saved",
      },
    ],
  } as never);
  handleMarketConnectionUrl(
    "orgii://market/connect?workspace_id=ws_test&target=org2"
  );
  await vi.waitFor(() =>
    expect(mocks.invoke).toHaveBeenCalledWith(
      "market_connection_begin",
      expect.anything()
    )
  );
  expect(loadEntries).not.toHaveBeenCalled();
});

it("handles synchronous and duplicate Cloud completion without another browser or authorization", async () => {
  const store = createInstrumentedStore();
  mocks.signIn.mockImplementationOnce(async ({ onSignedIn }) => {
    store.set(org2CloudAuthAtom, auth as never);
    onSignedIn();
    onSignedIn();
  });
  handleMarketConnectionUrl(
    "orgii://market/connect?workspace_id=ws_test&target=org2"
  );
  await vi.waitFor(() =>
    expect(dispatchMarketConnection).toHaveBeenCalledOnce()
  );
  mocks.signIn.mock.calls[0][0].onSignedIn();
  handleMarketConnectionUrl(
    `orgii://market/authorized?code=${"k".repeat(43)}&state=${"q".repeat(43)}`
  );
  await Promise.resolve();
  expect(
    mocks.invoke.mock.calls.filter(
      ([name]) => name === "market_connection_begin"
    )
  ).toHaveLength(1);
  expect(fetch).toHaveBeenCalledOnce();
  expect(dispatchMarketConnection).toHaveBeenCalledOnce();
  expect(openUrl).not.toHaveBeenCalled();
});
it("upgrades a legacy Cloud session through standard PKCE before Market authorization", async () => {
  createInstrumentedStore().set(org2CloudAuthAtom, {
    ...auth,
    oauthClientId: undefined,
  } as never);
  handleMarketConnectionUrl(
    "orgii://market/connect?workspace_id=ws_test&target=org2"
  );
  await vi.waitFor(() => expect(mocks.signIn).toHaveBeenCalledOnce());
  expect(fetch).not.toHaveBeenCalled();
  expect(mocks.invoke).not.toHaveBeenCalled();
});
it("does not reopen the browser when background authorization fails", async () => {
  createInstrumentedStore().set(org2CloudAuthAtom, auth as never);
  vi.mocked(fetch).mockResolvedValueOnce(
    new Response("unavailable", { status: 503 })
  );
  handleMarketConnectionUrl(
    "orgii://market/connect?workspace_id=ws_test&target=org2"
  );
  await vi.waitFor(() =>
    expect(dispatchMarketConnectionError).toHaveBeenCalledOnce()
  );
  expect(mocks.invoke).toHaveBeenCalledWith("market_connection_cancel");
  expect(openUrl).not.toHaveBeenCalled();
  expect(dispatchMarketConnection).not.toHaveBeenCalled();
});

it("keeps an existing authorized Market grant usable without upgrading a legacy login", async () => {
  createInstrumentedStore().set(org2CloudAuthAtom, {
    ...auth,
    oauthClientId: undefined,
  } as never);
  const connection = {
    identity_user_id: "user-a",
    workspace_id: "ws_test",
    target: "org2",
    phase: "authorization_saved",
  };
  vi.mocked(loadConnections).mockResolvedValueOnce({
    connections: [connection],
  } as never);
  handleMarketConnectionUrl(
    "orgii://market/connect?workspace_id=ws_test&target=org2"
  );
  await vi.waitFor(() =>
    expect(dispatchMarketConnection).toHaveBeenCalledWith("open", connection)
  );
  expect(mocks.signIn).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
  expect(mocks.invoke).not.toHaveBeenCalled();
});

it("rejects an org2 callback while signed out before native redemption can store a grant", async () => {
  const store = createInstrumentedStore();
  handleMarketConnectionUrl(
    `orgii://market/authorized?code=${"n".repeat(43)}&state=${"u".repeat(43)}`
  );
  await vi.waitFor(() =>
    expect(dispatchMarketConnectionError).toHaveBeenCalledOnce()
  );
  expect(mocks.invoke).not.toHaveBeenCalled();
  expect(dispatchMarketConnection).not.toHaveBeenCalled();
  expect(store.get(org2CloudAuthAtom)).toBeNull();
});
