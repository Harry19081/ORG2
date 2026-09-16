import type { ManagedService } from "./rpc";
import { activateManagedService } from "./rpc";
import { MARKET_PROFILES_CHANGED_EVENT } from "./events";
import type { MarketExecutionProfile } from "./marketProfiles";

export interface UsagePrompt {
  service: ManagedService;
  model: string;
  resolve: (budget: number | null) => void;
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
  if (!selected.requires_confirmation && service.access?.status === "active")
    return profile;
  if (pending) throw new Error("usage_authorization_in_progress");
  pending = true;
  try {
    const budget = await new Promise<number | null>((resolve) =>
      window.dispatchEvent(
        new CustomEvent<UsagePrompt>(USAGE_AUTHORIZATION_EVENT, {
          detail: { service, model, resolve },
        }),
      ),
    );
    if (budget === null) throw new Error("usage_authorization_cancelled");
    const access = await activateManagedService(
      profile.connection,
      service,
      model,
      budget,
    );
    window.dispatchEvent(new Event(MARKET_PROFILES_CHANGED_EVENT));
    return {
      ...profile,
      entitlementWorkspaceId: access.workspace_id,
      entitlementId: access.access_id,
      managed: {
        ...service,
        access,
        models: service.models.map((m) =>
          m.model === model ? { ...m, requires_confirmation: false } : m,
        ),
      },
    };
  } finally {
    pending = false;
  }
}
