import { useAtomValue, useSetAtom, useStore } from "jotai";
import { useCallback, useEffect } from "react";

import { awaitMirroredOrg2CloudAuth } from "@src/api/http/auth/sharedAuthStorage";
import { notifyCloudAuthChanged } from "@src/api/tauri/mobileRemote";
import {
  commitRefreshedAuth,
  org2CloudAuthAtom,
} from "@src/features/Org2Cloud/org2CloudAuthAtom";
import { ensureFreshSession } from "@src/features/Org2Cloud/org2CloudClient";
import { useTauriListen } from "@src/hooks/platform/useTauriListen";
import { useSetting } from "@src/hooks/settings/useSettings";

const RELAY_AUTH_REFRESH_EVENT = "mobile-relay-auth-refresh-needed";

/**
 * Keep the outbound Mobile Remote relay aligned with the current ORG2 Cloud
 * session. Rust reads the shared auth store on each connect attempt; this hook
 * refreshes near-expiry tokens and nudges the relay supervisor to reconnect.
 */
export function useMobileRelayCloudAuthSync(): void {
  const [enabled] = useSetting("mobileRemote.enabled");
  const [relayEnabled] = useSetting("mobileRemote.relayEnabled");
  const auth = useAtomValue(org2CloudAuthAtom);
  const setAuth = useSetAtom(org2CloudAuthAtom);
  const store = useStore();

  const syncRelayAuth = useCallback(async () => {
    if (!enabled || !relayEnabled || store.get(org2CloudAuthAtom) !== auth)
      return;

    if (!auth) {
      await awaitMirroredOrg2CloudAuth(null);
      await notifyCloudAuthChanged();
      return;
    }

    const fresh = await ensureFreshSession(auth);
    // A transient refresh failure is not a canonical sign-out. The auth
    // owner handles definitive rejection through its guarded atom update.
    if (!fresh || store.get(org2CloudAuthAtom) !== auth) return;

    if (fresh !== auth) {
      if (!commitRefreshedAuth(setAuth, auth, fresh)) return;
    }

    await awaitMirroredOrg2CloudAuth(JSON.stringify(fresh));
    await notifyCloudAuthChanged();
  }, [auth, enabled, relayEnabled, setAuth, store]);

  useEffect(() => {
    // A superseded durable write intentionally rejects; native stays gated
    // and the current auth effect owns the next synchronization.
    void syncRelayAuth().catch(() => {});
  }, [syncRelayAuth]);

  useTauriListen(RELAY_AUTH_REFRESH_EVENT, () => {
    void syncRelayAuth().catch(() => {});
  });
}
