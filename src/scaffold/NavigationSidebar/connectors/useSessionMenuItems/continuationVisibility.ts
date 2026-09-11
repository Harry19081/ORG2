import type { Session } from "@src/store/session";

export function continuationLineagesForRevealedSessions(
  sessions: readonly Session[],
  revealedSessionIds: ReadonlySet<string>
): ReadonlySet<string> {
  const lineages = new Set<string>();
  for (const session of sessions) {
    if (
      revealedSessionIds.has(session.session_id) &&
      session.continuationLineageId
    ) {
      lineages.add(session.continuationLineageId);
    }
  }
  return lineages;
}

export function isRosterSiblingOfRevealedContinuation(
  session: Session,
  revealedSessionIds: ReadonlySet<string>,
  revealedContinuationLineages: ReadonlySet<string>
): boolean {
  return Boolean(
    !revealedSessionIds.has(session.session_id) &&
    session.continuationLineageId &&
    revealedContinuationLineages.has(session.continuationLineageId)
  );
}

/**
 * One visible row per continuation lineage. Explicitly revealed rows (the
 * open session and its reveal request) always win their lineage; otherwise
 * the newest row does. Rows without a lineage are never affected. This
 * covers the window between a backend demotion and the next roster merge
 * that prunes the demoted sibling.
 */
export function continuationWinnerIds(
  sessions: readonly Session[],
  revealedSessionIds: ReadonlySet<string>
): ReadonlySet<string> {
  const revealedByLineage = new Map<string, string[]>();
  const newestByLineage = new Map<string, Session>();
  for (const session of sessions) {
    const lineageId = session.continuationLineageId;
    if (!lineageId) continue;
    if (revealedSessionIds.has(session.session_id)) {
      const ids = revealedByLineage.get(lineageId) ?? [];
      ids.push(session.session_id);
      revealedByLineage.set(lineageId, ids);
    }
    const current = newestByLineage.get(lineageId);
    if (
      !current ||
      (session.updated_at || "").localeCompare(current.updated_at || "") > 0
    ) {
      newestByLineage.set(lineageId, session);
    }
  }
  const winners = new Set<string>();
  for (const [lineageId, newest] of newestByLineage) {
    const revealed = revealedByLineage.get(lineageId);
    if (revealed) {
      for (const id of revealed) winners.add(id);
    } else {
      winners.add(newest.session_id);
    }
  }
  return winners;
}

export function isHiddenContinuationSibling(
  session: Session,
  winnerIds: ReadonlySet<string>
): boolean {
  return Boolean(
    session.continuationLineageId && !winnerIds.has(session.session_id)
  );
}
