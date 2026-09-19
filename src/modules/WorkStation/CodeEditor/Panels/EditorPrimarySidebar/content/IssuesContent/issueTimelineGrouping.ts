import type { GitHubIssueTimelineItem } from "@src/api/tauri/github";

/** Event types GitHub emits once per label even for a single bulk action. */
const GROUPABLE_LABEL_EVENTS = new Set(["labeled", "unlabeled"]);

export type IssueTimelineRow =
  | { kind: "single"; item: GitHubIssueTimelineItem }
  | {
      kind: "labelGroup";
      event: "labeled" | "unlabeled";
      actor: GitHubIssueTimelineItem["actor"];
      items: GitHubIssueTimelineItem[];
    };

function minuteBucket(createdAt: string | null): number | null {
  if (!createdAt) return null;
  const ms = Date.parse(createdAt);
  return Number.isNaN(ms) ? null : Math.floor(ms / 60000);
}

interface PendingGroup {
  event: string;
  actorLogin: string | null;
  minuteBucket: number | null;
  items: GitHubIssueTimelineItem[];
}

/**
 * Collapses consecutive `labeled`/`unlabeled` events from the same actor
 * inside the same clock minute into one row. GitHub's issue/PR timeline
 * emits one event per label even when they were all applied in a single
 * bulk action, which otherwise reads as several near-identical rows.
 */
export function groupIssueTimelineRows(
  timeline: GitHubIssueTimelineItem[]
): IssueTimelineRow[] {
  const pending: PendingGroup[] = [];

  for (const item of timeline) {
    const bucket = minuteBucket(item.created_at);
    const actorLogin = item.actor?.login ?? null;
    const last = pending[pending.length - 1];
    const canJoin =
      last !== undefined &&
      GROUPABLE_LABEL_EVENTS.has(item.event) &&
      last.event === item.event &&
      last.actorLogin === actorLogin &&
      bucket !== null &&
      last.minuteBucket === bucket;

    if (canJoin && last) {
      last.items.push(item);
      continue;
    }

    pending.push({
      event: item.event,
      actorLogin,
      minuteBucket: bucket,
      items: [item],
    });
  }

  return pending.map(
    (group): IssueTimelineRow =>
      group.items.length > 1
        ? {
            kind: "labelGroup",
            event: group.event as "labeled" | "unlabeled",
            actor: group.items[0].actor,
            items: group.items,
          }
        : { kind: "single", item: group.items[0] }
  );
}
