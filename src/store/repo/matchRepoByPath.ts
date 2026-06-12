/**
 * Shared path → repo matching.
 *
 * Single normalization + comparison used by both the session→repo
 * auto-follow (jumpToSessionAtom) and the status-bar hint
 * (sessionRepoHintAtom), so the two can never disagree about what
 * "the session's repo" is.
 */
import type { Repo } from "./types";

/** Strip file:// prefix and trailing slashes; lowercase for the
 *  case-insensitive default filesystem on macOS. */
export function normalizeRepoPath(path: string | undefined | null): string {
  if (!path) return "";
  const stripped = path.startsWith("file://")
    ? path.replace("file://", "")
    : path;
  return stripped.replace(/\/+$/, "").toLowerCase();
}

/** Find the registered repo whose path (or fs_uri) equals `path`. */
export function matchRepoByPath(
  repos: readonly Repo[],
  path: string | undefined | null
): Repo | undefined {
  const normalized = normalizeRepoPath(path);
  if (!normalized) return undefined;
  return repos.find(
    (repo) => normalizeRepoPath(repo.path ?? repo.fs_uri) === normalized
  );
}
