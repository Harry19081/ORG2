/**
 * resolveRepoChangePath — pick the workspace path when the global repo
 * selection changes in the Session Creator.
 *
 * Extracted from `handleRepoChange` so the "never write an empty path" rule is
 * unit-testable. `reposList` can lag right after "Open Folder" imports a new
 * repo, so a lookup against it may miss; writing an empty path in that window
 * would clobber the valid path that `onRepoSelect` just set and strand the
 * creator on "Workspace is still loading".
 *
 * Resolution priority:
 *   1. The matched repo's path / fs_uri (normal case).
 *   2. The already-resolved source path, when it belongs to this repo.
 *   3. The repoId itself — for local repos the repo id IS the filesystem path
 *      (DB invariant: repos.repo_id == repos.path), so this is always a valid
 *      non-empty fallback and never lets an empty path through.
 */
export interface ResolveRepoChangePathArgs {
  repoId: string;
  matchedRepo?: { path?: string; fs_uri?: string } | undefined;
  currentSourceRepoId?: string;
  currentSourceRepoPath?: string;
}

export function resolveRepoChangePath({
  repoId,
  matchedRepo,
  currentSourceRepoId,
  currentSourceRepoPath,
}: ResolveRepoChangePathArgs): string {
  return (
    matchedRepo?.path ||
    matchedRepo?.fs_uri ||
    (currentSourceRepoId === repoId ? currentSourceRepoPath || "" : "") ||
    repoId
  );
}
