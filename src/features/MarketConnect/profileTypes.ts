/**
 * Market execution-profile shapes, declared apart from `marketProfiles` so
 * `usageAuthorization` can name them without importing that module.
 *
 * `marketProfiles` needs `authorizedProfile` from `usageAuthorization` at
 * runtime; `usageAuthorization` needed only the profile *type* back. That was
 * erased at compile time, so it never misbehaved, but it made the two modules
 * a cycle in the import graph. Both now depend on this leaf instead.
 */
import type { Connection, ManagedService } from "./rpc";

export type MarketProfileAgent = "claude_code" | "codex";

/**
 * A managed Market service adapted to ORG2's existing execution-profile UI.
 * It deliberately contains no API key. `connection` plus the entitlement
 * identifiers are only used to ask the backend for an opaque credentialSource.
 */
export interface MarketExecutionProfile {
  managed?: ManagedService;
  id: string;
  label: string;
  connection: Connection;
  entitlementWorkspaceId: string;
  entitlementId: string;
  serviceId: string;
  modelsByAgent: Record<MarketProfileAgent, string[]>;
  expiresAt: number | null;
}
