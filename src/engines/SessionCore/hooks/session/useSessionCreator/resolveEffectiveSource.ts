/**
 * resolveEffectiveSource — pure workspace/repo resolution for the Session
 * Creator's `effectiveSource`.
 *
 * Extracted from `useSessionCreator` so the launch-root decision can be unit
 * tested without React. The hook layers the stored divergence and the OS-mode
 * system path on top of this; this function only covers the workspace-folder
 * and global-repo-selection branches, which is exactly where the "Add Folder to
 * Workspace (single folder)" bug lived.
 *
 * Resolution priority:
 *   1. Primary workspace folder (covers BOTH single- and multi-folder
 *      workspaces). "Add Folder to Workspace" sets the folder list but
 *      intentionally leaves `selectedRepoIdAtom` untouched, so the folder is
 *      the only reliable source of the workspace root.
 *   2. Global repo selection (`selectedRepoIdAtom`) resolved against the repo
 *      list — the legacy single-repo (no workspace folder) path.
 *   3. null — nothing resolvable.
 */
import type { Repo } from "@src/store/repo/types";
import type { SessionSource } from "@src/store/session/creatorStateAtom";
import type { WorkspaceFolder } from "@src/types/workspace";

export interface ResolveEffectiveSourceArgs {
  primaryFolder: WorkspaceFolder | null;
  globalRepoId: string;
  globalBranch: string;
  repos: readonly Repo[];
}

export function resolveEffectiveSource({
  primaryFolder,
  globalRepoId,
  globalBranch,
  repos,
}: ResolveEffectiveSourceArgs): SessionSource | null {
  // Workspace mode: use the primary folder so launch gets the stable workspace
  // root rather than a stale selectedRepoIdAtom value. This must also cover the
  // SINGLE-folder workspace case ("Add Folder to Workspace" with one folder):
  // that path sets workspaceFoldersAtom but intentionally leaves
  // selectedRepoIdAtom untouched, so falling through to the globalRepoId branch
  // below would resolve to null and strand the creator on an empty repoPath
  // forever.
  if (primaryFolder) {
    return {
      type: "local",
      repoId: primaryFolder.repoId ?? primaryFolder.id,
      repoName: primaryFolder.name,
      repoPath: primaryFolder.path,
      branch: globalBranch || undefined,
    };
  }

  if (!globalRepoId) return null;
  const repo = repos.find((repoItem) => repoItem.id === globalRepoId);
  if (!repo) return null;
  return {
    type: "local",
    repoId: globalRepoId,
    repoName: repo.name,
    repoPath: repo.path || repo.fs_uri,
    branch: globalBranch || undefined,
  };
}
