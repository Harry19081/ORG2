import type { GitHubIssue } from "@src/api/tauri/github";

export function formatIssueStateLabel(state: string): string {
  if (state === "open") return "Open";
  if (state === "closed") return "Closed";
  return state;
}

export function filterIssuesByQuery(
  issues: GitHubIssue[],
  query: string
): GitHubIssue[] {
  if (!query.trim()) return issues;
  const q = query.toLowerCase();
  return issues.filter(
    (issue) =>
      issue.title.toLowerCase().includes(q) ||
      issue.labels.some((l) => l.name.toLowerCase().includes(q)) ||
      issue.user.login.toLowerCase().includes(q)
  );
}

export function sortIssues(
  issues: GitHubIssue[],
  by: "updated" | "created" | "number"
): GitHubIssue[] {
  return [...issues].sort((a, b) => {
    if (by === "number") return b.number - a.number;
    if (by === "created")
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
}

/** Convert a GitHub hex color (e.g. "d73a4a") to an inline style object. */
export function getLabelColorStyle(hexColor: string): {
  backgroundColor: string;
  color: string;
} {
  const r = parseInt(hexColor.slice(0, 2), 16);
  const g = parseInt(hexColor.slice(2, 4), 16);
  const b = parseInt(hexColor.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return {
    backgroundColor: `#${hexColor}`,
    color: luminance > 0.5 ? "#000000" : "#ffffff",
  };
}

export function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  return `${Math.floor(diffMonths / 12)}y ago`;
}

export function parseGithubIssueNumber(url: string): number | null {
  const match = url.match(/\/issues\/(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}
