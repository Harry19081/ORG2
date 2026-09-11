import { describe, expect, it } from "vitest";

import type { Session } from "@src/store/session";

import {
  continuationLineagesForRevealedSessions,
  continuationWinnerIds,
  isHiddenContinuationSibling,
  isRosterSiblingOfRevealedContinuation,
} from "../continuationVisibility";

function session(sessionId: string, continuationLineageId?: string): Session {
  return {
    session_id: sessionId,
    status: "completed",
    created_at: "2026-08-05T00:00:00.000Z",
    updated_at: "2026-08-05T00:00:00.000Z",
    continuationLineageId,
  };
}

describe("continuationLineagesForRevealedSessions", () => {
  it("returns only lineages owned by explicitly revealed rows", () => {
    expect(
      continuationLineagesForRevealedSessions(
        [
          session("active-old", "lineage-a"),
          session("roster-new", "lineage-a"),
          session("unrelated", "lineage-b"),
          session("legacy-without-lineage"),
        ],
        new Set(["active-old", "legacy-without-lineage"])
      )
    ).toEqual(new Set(["lineage-a"]));
  });

  it("hides the roster winner but keeps the explicitly revealed sibling", () => {
    const revealedIds = new Set(["active-old"]);
    const revealedLineages = new Set(["lineage-a"]);

    expect(
      isRosterSiblingOfRevealedContinuation(
        session("roster-new", "lineage-a"),
        revealedIds,
        revealedLineages
      )
    ).toBe(true);
    expect(
      isRosterSiblingOfRevealedContinuation(
        session("active-old", "lineage-a"),
        revealedIds,
        revealedLineages
      )
    ).toBe(false);
    expect(
      isRosterSiblingOfRevealedContinuation(
        session("unrelated", "lineage-b"),
        revealedIds,
        revealedLineages
      )
    ).toBe(false);
  });
});

describe("continuationWinnerIds", () => {
  function dated(
    sessionId: string,
    lineage: string | undefined,
    updatedAt: string
  ): Session {
    return { ...session(sessionId, lineage), updated_at: updatedAt };
  }

  it("shows only the newest row of a lineage when nothing is revealed", () => {
    const rows = [
      dated("gen1", "lineage-a", "2026-09-11T00:18:38.000Z"),
      dated("gen2", "lineage-a", "2026-09-11T00:29:51.000Z"),
      dated("plain", undefined, "2026-09-11T00:00:00.000Z"),
    ];
    const winners = continuationWinnerIds(rows, new Set());
    expect(winners).toEqual(new Set(["gen2"]));
    expect(isHiddenContinuationSibling(rows[0], winners)).toBe(true);
    expect(isHiddenContinuationSibling(rows[1], winners)).toBe(false);
    expect(isHiddenContinuationSibling(rows[2], winners)).toBe(false);
  });

  it("lets a revealed older generation win its lineage", () => {
    const rows = [
      dated("gen1", "lineage-a", "2026-09-11T00:18:38.000Z"),
      dated("gen2", "lineage-a", "2026-09-11T00:29:51.000Z"),
    ];
    const winners = continuationWinnerIds(rows, new Set(["gen1"]));
    expect(winners).toEqual(new Set(["gen1"]));
    expect(isHiddenContinuationSibling(rows[1], winners)).toBe(true);
  });
});
