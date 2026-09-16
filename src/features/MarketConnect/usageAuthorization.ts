import type { ManagedService } from "./rpc";
import { activateManagedService } from "./rpc";
import { MARKET_PROFILES_CHANGED_EVENT } from "./events";
import type { MarketExecutionProfile } from "./marketProfiles";

export interface UsagePrompt {
  service: ManagedService;
  resolve: (accepted: boolean) => void;
}
export const USAGE_AUTHORIZATION_EVENT = "org2-managed-usage-authorization";
let pending = false;
/** One explicit consent at a time. The host cancels on unmount and connection
 * changes; activation remains bound to the selected native authorization. */
export async function authorizedProfile(
  profile: MarketExecutionProfile,
  model: string,
): Promise<MarketExecutionProfile> {
  const service = profile.managed;
  if (!service) return profile;
  const selected = service.models.find((m) => m.model === model);
  if (!selected || selected.availability !== "available")
    throw new Error("model_temporarily_unavailable");
  if (
    !service.requires_confirmation &&
    service.access?.status === "active" &&
    service.access.billing_mode === "wallet"
  )
    return profile;
  if (pending) throw new Error("usage_authorization_in_progress");
  pending = true;
  try {
    const accepted = await new Promise<boolean>((resolve) =>
      window.dispatchEvent(
        new CustomEvent<UsagePrompt>(USAGE_AUTHORIZATION_EVENT, {
          detail: { service, resolve },
        }),
      ),
    );
    if (!accepted) throw new Error("usage_authorization_cancelled");
    const access = await activateManagedService(profile.connection, service);
    window.dispatchEvent(new Event(MARKET_PROFILES_CHANGED_EVENT));
    return {
      ...profile,
      entitlementWorkspaceId: access.workspace_id,
      entitlementId: access.access_id,
      managed: {
        ...service,
        access,
        requires_confirmation: false,
      },
    };
  } finally {
    pending = false;
  }
}
