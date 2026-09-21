import { z } from "zod/v4";

import { defineProcedure, typedInvoke } from "@src/api/tauri/rpc/invoke";

import { withFreshMarketOwner } from "./auth";

const status = z.enum([
  "unchecked",
  "ready",
  "recovery_ready",
  "clean",
  "synced_to_primary",
  "synced_to_package",
  "conflict",
  "incomplete",
  "unsupported",
  "busy",
  "writer_unknown",
  "changed",
  "scope_changed",
  "limit",
  "failed",
]);
const report = z.object({
  status,
  items: z.array(
    z.object({ sessionId: z.string().uuid(), title: z.string(), status })
  ),
});
export type ClaudeHistoryReport = z.infer<typeof report>;
const procedure = defineProcedure("market_connection_claude_history")
  .input(
    z.object({
      selected: z.string().uuid().nullable(),
      mode: z.enum(["list", "inspect", "sync"]),
    })
  )
  .output(report)
  .build();

/** Only sync authorizes a mutation; listing and inspecting are read-only. */
export const inspectClaudeHistory = (
  selected: string | null,
  mode: "list" | "inspect" | "sync"
) => withFreshMarketOwner(() => typedInvoke(procedure, { selected, mode }));
