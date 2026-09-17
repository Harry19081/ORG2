import { z } from "zod/v4";

import { defineProcedure, typedInvoke } from "@src/api/tauri/rpc/invoke";
import Message from "@src/components/Message";
import { getCloudEndpoint } from "@src/features/Org2Cloud/config";
import { org2CloudAuthAtom } from "@src/features/Org2Cloud/org2CloudAuthAtom";
import { openOrg2CloudSignIn } from "@src/features/Org2Cloud/useOrg2CloudSignIn";
import i18n from "@src/i18n";
import { getInstrumentedStore } from "@src/util/core/state/instrumentedStore";

import { authorizeMarketInBackground } from "./backgroundAuthorization";
import {
  MARKET_AUTHORIZATION_SAVED_EVENT,
  MARKET_CONNECTION_OPEN_EVENT,
  classifyMarketConnectionError,
  dispatchMarketConnection,
  dispatchMarketConnectionError,
  parseMarketTarget,
} from "./events";
import { loadConnections, loadEntries } from "./rpc";
import { isMarketAppUrl } from "./urlPolicy";

const rawInput = z.object({ raw: z.string().max(2048) });
const begin = defineProcedure("market_connection_begin")
  .input(rawInput)
  .output(z.string().url())
  .build();
const complete = defineProcedure("market_connection_complete")
  .input(rawInput.extend({ expectedIdentityUserId: z.string().optional() }))
  .output(
    z.object({
      identity_user_id: z.string().uuid(),
      workspace_id: z.string().regex(/^ws_[A-Za-z0-9_-]{1,120}$/),
      target: z.enum(["claude-code", "claude-app", "codex", "org2"]),
      phase: z.literal("authorization_saved"),
    })
  )
  .build();
const cancel = defineProcedure("market_connection_cancel").build();

// The existing main-window deep-link owner dispatches both warm and cold links.
// Keep at most one operation; never put authorization URLs in logs or dedup sets.
let busy = false;
let queuedCallback: string | undefined;
const completedAuthorizationStates = new Set<string>();
const MAX_COMPLETED_AUTHORIZATION_STATES = 32;

function authorizationState(url: URL): string | null {
  const state = url.searchParams.get("state");
  return state && /^[A-Za-z0-9_-]{43}$/.test(state) ? state : null;
}

function rememberCompletedAuthorization(state: string | null): void {
  if (!state) return;
  completedAuthorizationStates.add(state);
  while (
    completedAuthorizationStates.size > MAX_COMPLETED_AUTHORIZATION_STATES
  ) {
    const oldest = completedAuthorizationStates.values().next().value;
    if (typeof oldest !== "string") break;
    completedAuthorizationStates.delete(oldest);
  }
}
async function signInAndResume(raw: string): Promise<void> {
  let resumed = false;
  await openOrg2CloudSignIn({
    onSignedIn: () => {
      if (resumed) return;
      resumed = true;
      if (busy) queuedCallback = raw;
      else handleMarketConnectionUrl(raw);
    },
  });
}

async function completeMarketAuthorization(
  url: URL,
  isCurrent: () => boolean = () => true
): Promise<void> {
  // Identity login is owned by the Cloud PKCE controller, never Market.
  url.hash = "";
  const store = getInstrumentedStore();
  const auth = store.get(org2CloudAuthAtom);
  if (
    !auth ||
    !getCloudEndpoint().isOfficial ||
    getCloudEndpoint().supabaseUrl !== auth.supabaseUrl ||
    !isCurrent()
  )
    throw Error("market_identity_mismatch");
  const result = await typedInvoke(complete, {
    raw: url.toString(),
    expectedIdentityUserId: auth?.userId,
  });
  rememberCompletedAuthorization(authorizationState(url));
  if (
    result.target === "org2" &&
    (!auth ||
      result.identity_user_id !== auth.userId ||
      store.get(org2CloudAuthAtom)?.userId !== auth.userId ||
      store.get(org2CloudAuthAtom)?.supabaseUrl !== auth.supabaseUrl ||
      !getCloudEndpoint().isOfficial ||
      getCloudEndpoint().supabaseUrl !== auth.supabaseUrl ||
      !isCurrent())
  )
    throw Error("market_identity_mismatch");
  dispatchMarketConnection(MARKET_AUTHORIZATION_SAVED_EVENT, {
    identity_user_id: result.identity_user_id,
    workspace_id: result.workspace_id,
    target: result.target,
  });
  // ORG2-native services become profiles immediately. External clients
  // still need their existing configuration step in App connections.
  if (result.target !== "org2") {
    Message.success(i18n.t("integrations:marketConnection.authorizationSaved"));
  }
}

export function handleMarketConnectionUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (!isMarketAppUrl(url)) return false;
  if (raw.length > 2048) return true;
  const callbackState =
    url.pathname === "/authorized" ? authorizationState(url) : null;
  // Browsers may leave the verified fallback link visible after the automatic
  // custom-protocol handoff succeeds. Treat a second click as the same local
  // delivery instead of trying to exchange the one-time grant again.
  if (callbackState && completedAuthorizationStates.has(callbackState))
    return true;
  const requestedTarget = parseMarketTarget(url.searchParams.get("target"));
  if (busy) {
    if (raw.length <= 16384 && url.pathname === "/authorized")
      queuedCallback ??= raw;
    return true;
  }
  busy = true;
  const operation =
    url.pathname === "/authorized"
      ? ("complete-authorization" as const)
      : ("begin-authorization" as const);
  (async () => {
    try {
      if (url.pathname === "/connect") {
        const auth = getInstrumentedStore().get(org2CloudAuthAtom);
        // Native enrollment normalizes legacy external targets into ORG2 grants.
        if (!requestedTarget) throw Error("invalid_market_connection_link");
        if (
          !getCloudEndpoint().isOfficial ||
          (auth && auth.supabaseUrl !== getCloudEndpoint().supabaseUrl)
        )
          throw Error("market_identity_endpoint_mismatch");
        if (!auth) {
          await signInAndResume(raw);
          return;
        }
        if (
          url.searchParams.get("target") === "org2" &&
          getInstrumentedStore().get(org2CloudAuthAtom) !== null
        ) {
          const workspace = url.searchParams.get("workspace_id");
          const status = await loadConnections();
          for (const existing of status.connections.filter(
            (connection) =>
              connection.target === "org2" &&
              connection.identity_user_id === auth?.userId &&
              connection.phase === "authorization_saved"
          )) {
            try {
              const entries = await loadEntries(existing);
              if (
                existing.workspace_id === workspace ||
                entries.some((entry) => entry.workspace_id === workspace)
              ) {
                if (
                  getInstrumentedStore().get(org2CloudAuthAtom)?.userId !==
                    auth.userId ||
                  getInstrumentedStore().get(org2CloudAuthAtom)?.supabaseUrl !==
                    auth.supabaseUrl ||
                  !getCloudEndpoint().isOfficial ||
                  getCloudEndpoint().supabaseUrl !== auth.supabaseUrl
                )
                  return;
                dispatchMarketConnection(
                  MARKET_CONNECTION_OPEN_EVENT,
                  existing
                );
                return;
              }
            } catch {
              // A stale connection continues through the background
              // authorization path below.
            }
          }
        }
        if (!auth.oauthClientId) {
          await signInAndResume(raw);
          return;
        }
        const authorization = new URL(await typedInvoke(begin, { raw }));
        await authorizeMarketInBackground({
          authorization,
          selection: url,
          auth,
          complete: (callback, isCurrent) =>
            completeMarketAuthorization(new URL(callback), isCurrent),
          cancel: () => typedInvoke(cancel),
        });
      } else if (url.pathname === "/authorized") {
        await completeMarketAuthorization(url);
      } else {
        throw new Error("invalid_market_connection_link");
      }
    } catch (error) {
      // Inspect only the known capability code; never display callback/IPC data.
      const code = classifyMarketConnectionError(error);
      dispatchMarketConnectionError(error, operation, requestedTarget);
      Message.error(
        i18n.t(
          code === "secure-storage-unavailable"
            ? "integrations:marketConnection.platformUnavailable"
            : "integrations:marketConnection.failed"
        )
      );
    } finally {
      busy = false;
      const next = queuedCallback;
      queuedCallback = undefined;
      if (next) handleMarketConnectionUrl(next);
    }
  })().catch(() => {
    // Report unexpected UI failures without exposing authorization data.
    console.error("Market connection UI update failed");
  });
  return true;
}
