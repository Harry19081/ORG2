/**
 * Branch categorization utilities for GlobalSpotlight
 */
import type { BranchItem } from "../types";

interface CategorizedBranches {
  default: BranchItem[]; // Default branches, pinned above every other section
  recent: BranchItem[]; // Top 5 most recent branches (incl. current if eligible)
  worktrees: BranchItem[]; // Branches checked out in a secondary worktree
  other: BranchItem[];
}

export const DEFAULT_BRANCH_NAMES = ["main", "master", "develop", "dev"];

/**
 * Whether a branch is a conventional default branch. Remote refs match on
 * the name after the remote (`origin/develop` → `develop`).
 */
export function isDefaultBranchName(
  name: string,
  isRemote: boolean,
  defaultBranchNames: readonly string[] = DEFAULT_BRANCH_NAMES
): boolean {
  const short = isRemote ? name.slice(name.indexOf("/") + 1) : name;
  return defaultBranchNames.includes(short.toLowerCase());
}

/**
 * Categorize branches into Default, Recent (top 5), Worktrees, and Other.
 * - Default: Branches named "main", "master", "develop", "dev", local
 *   before remote — rendered as their own section pinned to the top
 * - Recent: Top 5 most recently updated remaining branches (by commit date)
 * - Worktrees: Branches checked out in a secondary worktree (excluding
 *   Recent; the BranchItem must already carry `worktreePath`)
 * - Other: All other branches
 *
 * Each branch appears in exactly one bucket — Default wins over Recent,
 * which wins over Worktrees, which wins over Other.
 */
export function categorizeBranches<T extends BranchItem>(
  branches: T[],
  defaultBranchNames: readonly string[] = DEFAULT_BRANCH_NAMES
): {
  [K in keyof CategorizedBranches]: T[];
} {
  const defaultBranches = branches.filter((branch) =>
    isDefaultBranchName(branch.name, branch.isRemote, defaultBranchNames)
  );
  const defaultBranchSet = new Set(defaultBranches.map((b) => b.name));
  const rest = branches.filter((branch) => !defaultBranchSet.has(branch.name));

  // First, sort all branches by commit date (most recent first)
  const sortedByDate = [...rest].sort((a, b) => {
    // Current branch priority
    if (a.isCurrent && !b.isCurrent) return -1;
    if (!a.isCurrent && b.isCurrent) return 1;

    // Then by commit date
    if (a.lastCommitDate && b.lastCommitDate) {
      return (
        new Date(b.lastCommitDate).getTime() -
        new Date(a.lastCommitDate).getTime()
      );
    }
    if (a.lastCommitDate) return -1;
    if (b.lastCommitDate) return 1;

    return 0;
  });

  // Take top 5 most recent
  const recentBranches = sortedByDate.slice(0, 5);
  const recentBranchNames = new Set(
    recentBranches.map((branch) => branch.name)
  );

  // Categorize remaining branches
  const worktreeBranches: T[] = [];
  const otherBranches: T[] = [];

  for (const branch of rest) {
    if (recentBranchNames.has(branch.name)) continue;
    if (branch.worktreePath) worktreeBranches.push(branch);
    else otherBranches.push(branch);
  }

  // Sort default and other branches
  const sortBranches = (a: BranchItem, b: BranchItem) => {
    // Current branch always first
    if (a.isCurrent && !b.isCurrent) return -1;
    if (!a.isCurrent && b.isCurrent) return 1;

    // Then by commit date (most recent first)
    if (a.lastCommitDate && b.lastCommitDate) {
      return (
        new Date(b.lastCommitDate).getTime() -
        new Date(a.lastCommitDate).getTime()
      );
    }
    if (a.lastCommitDate) return -1;
    if (b.lastCommitDate) return 1;

    // Finally alphabetically
    return a.name.localeCompare(b.name);
  };

  worktreeBranches.sort(sortBranches);
  otherBranches.sort(sortBranches);
  // Local defaults before their remote counterparts.
  defaultBranches.sort(
    (a, b) => Number(a.isRemote) - Number(b.isRemote) || sortBranches(a, b)
  );

  return {
    default: defaultBranches,
    recent: recentBranches,
    worktrees: worktreeBranches,
    other: otherBranches,
  };
}
