import { fetchRustApi, gitRepoUrl } from "./client";

export interface SwitchScope {
  repoId: string;
  repoPath?: string;
}
export type SwitchStrategy = "leave" | "bring";
export interface SwitchTarget {
  branch: string;
  create?: boolean;
  start_point?: string;
}
export interface SwitchPreparation {
  current_branch: string;
  target_branch: string;
  fingerprint: string;
  changed_files: string[];
  default_strategy: SwitchStrategy;
  same_branch: boolean;
  blocked: {
    code: string;
    message: string;
    worktree_path: string | null;
  } | null;
}
export interface BranchSwitchResult {
  outcome:
    | "switched"
    | "switched_with_conflicts"
    | "blocked"
    | "recovery_required";
  current_branch: string;
  message: string;
  snapshot_id: string | null;
  conflicts: string[];
}
export interface BranchSnapshot {
  id: string;
  source_branch: string;
  source_head: string;
  worktree_path: string;
  target_branch: string;
  created_at: string;
  files: string[];
  oid: string | null;
  phase:
    | "saving"
    | "saved"
    | "switching"
    | "applying"
    | "brought"
    | "restoring"
    | "restored"
    | "needs_resolution";
}
export interface SavedChangesPage {
  snapshots: BranchSnapshot[];
  next_cursor: string | null;
}

// Only outstanding reads are shared; completion and failure both evict immediately.
const reads = new Map<string, Promise<unknown>>();

async function request<T>(
  scope: SwitchScope,
  operation: string,
  body?: unknown,
  cursor?: string,
  branch?: string
): Promise<T> {
  const query = new URLSearchParams();
  if (scope.repoPath) query.set("path", scope.repoPath);
  if (branch) query.set("branch", branch);
  if (cursor) query.set("cursor", cursor);
  const url = `${gitRepoUrl(scope.repoId)}/branch-switch/${operation}?${query}`;
  if (body !== undefined)
    return (
      await fetchRustApi<T>(url, { method: "POST", body: JSON.stringify(body) })
    ).data;
  const existing = reads.get(url);
  if (existing) return existing as Promise<T>;
  const pending = fetchRustApi<T>(url)
    .then((response) => response.data)
    .finally(() => reads.delete(url));
  reads.set(url, pending);
  return pending;
}
export const branchSwitchApi = {
  prepare: (scope: SwitchScope, target: SwitchTarget) =>
    request<SwitchPreparation>(scope, "prepare", target),
  execute: (
    scope: SwitchScope,
    target: SwitchTarget,
    fingerprint: string,
    strategy: SwitchStrategy
  ) =>
    request<BranchSwitchResult>(scope, "execute", {
      target,
      fingerprint,
      strategy,
    }),
  saved: (scope: SwitchScope, cursor?: string) =>
    request<SavedChangesPage>(scope, "saved", undefined, cursor),
  available: (scope: SwitchScope, branch: string) =>
    request<boolean>(scope, "available", undefined, undefined, branch),
  restore: (scope: SwitchScope, id: string) =>
    request<BranchSwitchResult>(scope, "restore", { id }),
  preview: (scope: SwitchScope, id: string) =>
    request<string>(scope, `saved/${encodeURIComponent(id)}`),
};
