import { rpc } from "@src/api/tauri/rpc";
import type { HarnessConnectionView } from "@src/api/tauri/rpc/schemas/agentOrgs";

import type {
  MarketExecutionProfile,
  MarketProfileAgent,
} from "./marketProfiles";
import { configureMarketProfile } from "./rpc";
import { authorizedProfile } from "./usageAuthorization";

export type ExternalMarketTarget = "claude_code" | "claude_desktop" | "codex";

function profileAgent(target: ExternalMarketTarget): MarketProfileAgent {
  return target === "codex" ? "codex" : "claude_code";
}

export function modelForExternalTarget(
  profile: MarketExecutionProfile,
  target: ExternalMarketTarget,
  preferredAgent?: MarketProfileAgent,
  preferredModel?: string
): string | null {
  const agent = profileAgent(target);
  const models = profile.modelsByAgent[agent];
  if (
    preferredAgent === agent &&
    preferredModel &&
    models.includes(preferredModel)
  ) {
    return preferredModel;
  }
  return models[0] ?? null;
}

export function isMarketManagedView(
  view: HarnessConnectionView | null | undefined
): boolean {
  return Boolean(
    view?.config.mode === "orgii_managed" &&
    view.config.selectedKeyId?.startsWith("market:")
  );
}

function expectedHashes(view: HarnessConnectionView) {
  return Object.fromEntries(
    view.config.targetFiles.map((file) => [file.id, file.currentHash ?? null])
  );
}

async function readTarget(target: ExternalMarketTarget) {
  return rpc.agentOrgs.connections.status({ agentName: target });
}

export async function configureExternalMarketTarget(
  profile: MarketExecutionProfile,
  target: ExternalMarketTarget,
  preferredAgent?: MarketProfileAgent,
  preferredModel?: string
) {
  const view = await readTarget(target);
  const model = modelForExternalTarget(
    profile,
    target,
    preferredAgent,
    preferredModel
  );
  if (!view.installed) throw new Error("client_not_installed");
  if (!view.config.supported) throw new Error("client_not_supported");
  if (view.config.conflict) throw new Error("client_config_conflict");
  if (!model) throw new Error("workspace_not_supported");
  const authorized = await authorizedProfile(profile, model);
  return configureMarketProfile(
    authorized.connection,
    authorized.entitlementWorkspaceId,
    authorized.entitlementId,
    target,
    model,
    expectedHashes(view)
  );
}

export async function restoreExternalMarketTarget(
  target: ExternalMarketTarget
) {
  const view = await readTarget(target);
  if (!isMarketManagedView(view)) return;
  await rpc.agentOrgs.managedConfig.restoreDefault({
    agentName: target,
    force: false,
  });
}
