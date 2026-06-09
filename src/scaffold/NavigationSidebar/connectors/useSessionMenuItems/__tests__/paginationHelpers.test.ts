import { describe, expect, it } from "vitest";

import type { NavigationMenuItem } from "@src/scaffold/NavigationSidebar/components/NavigationMenu/config";
import type { Session } from "@src/store/session";

import { appendSessionGroup } from "../paginationHelpers";

function makeSession(sessionId: string): Session {
  return {
    session_id: sessionId,
    status: "completed",
    created_at: "2026-06-09T00:00:00.000Z",
    updated_at: "2026-06-09T00:00:00.000Z",
  };
}

function buildSessionRow(session: Session): NavigationMenuItem {
  return {
    id: session.session_id,
    key: session.session_id,
    label: session.session_id,
  };
}

describe("appendSessionGroup", () => {
  it("returns false when all sessions are visible", () => {
    const items: NavigationMenuItem[] = [];
    const hasHiddenLocalSessions = appendSessionGroup({
      items,
      groupId: "time:today",
      groupSessions: [makeSession("osagent-1"), makeSession("osagent-2")],
      visibleCount: 2,
      buildSessionRow,
      loadMoreLabel: "Load more",
    });

    expect(hasHiddenLocalSessions).toBe(false);
    expect(items.map((item) => item.id)).toEqual(["osagent-1", "osagent-2"]);
  });

  it("returns true and appends one local load-more row when sessions are hidden", () => {
    const items: NavigationMenuItem[] = [];
    const hasHiddenLocalSessions = appendSessionGroup({
      items,
      groupId: "time:today",
      groupSessions: [makeSession("osagent-1"), makeSession("osagent-2")],
      visibleCount: 1,
      buildSessionRow,
      loadMoreLabel: "Load more",
    });

    expect(hasHiddenLocalSessions).toBe(true);
    expect(items.map((item) => item.id)).toEqual([
      "osagent-1",
      "load-more-group-time:today",
    ]);
  });
});
