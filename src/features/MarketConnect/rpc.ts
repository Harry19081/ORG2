import { z } from "zod/v4";

import { defineProcedure, typedInvoke } from "@src/api/tauri/rpc/invoke";
import { CliConfigManagedStatusSchema } from "@src/api/tauri/rpc/schemas/agentOrgs";

export const connectionSchema = z.object({
  identity_user_id: z.string().uuid(),
  workspace_id: z.string().regex(/^ws_[A-Za-z0-9_-]{1,120}$/),
  target: z.enum(["claude-code", "claude-app", "codex", "org2"]),
});
export type Connection = z.infer<typeof connectionSchema>;
export const managedAccessSchema = z.object({
  access_id: z.string().regex(/^pa_[A-Za-z0-9_-]+$/),
  service_id: z.string(),
  workspace_id: z.string().regex(/^ws_[A-Za-z0-9_-]+$/),
  status: z.enum(["active", "revoked"]),
  budget_usd6: z.number().int().nonnegative(),
  revision: z.number().int().positive(),
});
export const managedServiceSchema = z.object({
  service_id: z.string(),
  title: z.string(),
  version_id: z.string(),
  requires_confirmation: z.boolean(),
  models: z.array(
    z.object({
      model: z.string(),
      protocol: z.enum(["anthropic_messages", "openai_responses"]),
      clients: z.array(z.string()),
      pricing: z.record(z.string(), z.unknown()),
      availability: z.string(),
    }),
  ),
  access: managedAccessSchema.nullable(),
});
export type ManagedService = z.infer<typeof managedServiceSchema>;
const moduleStatus = defineProcedure("market_connection_status")
  .output(
    z.object({
      enabled: z.boolean(),
      app_scheme: z.string().regex(/^orgii(?:-market-local-[a-f0-9]{8})?$/),
      buyer_persistent_credentials: z.boolean(),
      connections: z.array(
        connectionSchema.extend({
          phase: z.enum(["authorization_saved", "reauthorization_required"]),
        }),
      ),
    }),
  )
  .build();
export const loadConnections = () => typedInvoke(moduleStatus);
const input = z.object({
  identityUserId: z.string().uuid(),
  workspaceId: z.string(),
  target: connectionSchema.shape.target,
});
export const entrySchema = z.object({
  managed: managedServiceSchema.optional(),
  workspace_id: z.string().regex(/^ws_[A-Za-z0-9_-]{1,120}$/),
  entitlement_id: z.string(),
  service_id: z.string(),
  service_name: z.string(),
  models: z.array(z.string()),
  models_by_agent: z.object({
    claude: z.array(z.string()),
    codex: z.array(z.string()),
  }),
  status: z.string(),
  expires_at: z.number().nullable(),
});
export type Entry = z.infer<typeof entrySchema>;
const options = defineProcedure("market_connection_options")
  .input(input)
  .output(z.array(entrySchema))
  .build();
const args = (c: Connection) => ({
  identityUserId: c.identity_user_id,
  workspaceId: c.workspace_id,
  target: c.target,
});
export const loadEntries = (c: Connection) => typedInvoke(options, args(c));

const activateService = defineProcedure("market_connection_activate_service")
  .input(
    input.extend({
      request: z.object({
        service_id: z.string(),
        expected_version_id: z.string(),
        expected_revision: z.number().int().nullable(),
        budget_usd6: z.number().int().positive().max(5_000_000_000),
        confirm_usage: z.literal(true),
      }),
    }),
  )
  .output(managedAccessSchema)
  .build();
export const activateManagedService = (
  connection: Connection,
  service: ManagedService,
  budgetUsd6: number,
) =>
  typedInvoke(activateService, {
    ...args(connection),
    request: {
      service_id: service.service_id,
      expected_version_id: service.version_id,
      expected_revision: service.access?.revision ?? null,
      budget_usd6: budgetUsd6,
      confirm_usage: true,
    },
  });

const prepareSession = defineProcedure("market_connection_prepare_session")
  .input(
    input.extend({
      entitlementWorkspaceId: z.string().regex(/^ws_[A-Za-z0-9_-]{1,120}$/),
      entitlementId: z.string(),
      agent: z.enum(["claude_code", "codex"]),
      model: z.string().min(1).max(256),
    }),
  )
  .output(
    z.object({
      credential_source: z.string().startsWith("market:"),
    }),
  )
  .build();
export const prepareSessionSource = (
  c: Connection,
  entitlementWorkspaceId: string,
  entitlementId: string,
  agent: "claude_code" | "codex",
  model: string,
) =>
  typedInvoke(prepareSession, {
    ...args(c),
    entitlementWorkspaceId,
    entitlementId,
    agent,
    model,
  });

const configureProfile = defineProcedure("market_connection_configure_profile")
  .input(
    z.object({
      request: input.extend({
        entitlementWorkspaceId: z.string().regex(/^ws_[A-Za-z0-9_-]{1,120}$/),
        entitlementId: z.string(),
        agent: z.enum(["claude_code", "claude_desktop", "codex"]),
        model: z.string().min(1).max(256),
        expectedHashes: z.record(z.string(), z.string().nullable()),
      }),
    }),
  )
  .output(
    z.object({
      status: CliConfigManagedStatusSchema,
      selection: z.string().startsWith("market:"),
    }),
  )
  .build();

export const configureMarketProfile = (
  c: Connection,
  entitlementWorkspaceId: string,
  entitlementId: string,
  agent: "claude_code" | "claude_desktop" | "codex",
  model: string,
  expectedHashes: Record<string, string | null>,
) =>
  typedInvoke(configureProfile, {
    request: {
      ...args(c),
      entitlementWorkspaceId,
      entitlementId,
      agent,
      model,
      expectedHashes,
    },
  });
