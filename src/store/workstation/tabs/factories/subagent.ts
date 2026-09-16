/**
 * Subagent Tab Factories
 *
 * Tab factories for subagent details using defineTabFactory.
 */
import { defineTabFactory } from "../tabFactory";
import type { SubagentDetailTabData } from "../types";

export const subagentDetailTabFactory = defineTabFactory<SubagentDetailTabData>(
  {
    tabType: "subagent-detail",
    idStrategy: { type: "unique", prefix: "subagent-detail" },
    getTitle: (data) => data.description || "Subagent",
    icon: "MessageSquare",
  }
);
