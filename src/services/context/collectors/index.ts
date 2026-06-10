/**
 * Context Collectors
 *
 * IDE context payloads for agents (see IdeContextCollector).
 */

export {
  collectIdeContext,
  collectIdeContextAsync,
} from "./IdeContextCollector";
export type { WorkspaceSnapshot } from "@src/services/context/workspaceSnapshot";
