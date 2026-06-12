/**
 * In-memory, repo-keyed LRU cache for GitHub list data (issues + PRs).
 *
 * Lives at module scope so it survives workspace switches within the same
 * app session. Stale-while-revalidate: callers receive cached data instantly
 * and kick off a background refresh when the TTL has expired.
 *
 * Limits (chosen to bound memory while covering the typical "last two
 * workspaces" use-case):
 *   MAX_REPOS   — 2  (LRU eviction — oldest-accessed repo is dropped)
 *   MAX_ISSUES  — 200 per repo per section (open / closed)
 *   MAX_PRS     — 100 per repo
 *   TTL         — 5 minutes
 */
import type { GitHubIssue, OpenPRItem } from "@src/api/tauri/github";

const MAX_REPOS = 2;
const MAX_ISSUES_PER_SECTION = 200;
const MAX_PRS = 100;
const TTL_MS = 5 * 60 * 1000;

export interface CachedIssues {
  openIssues: GitHubIssue[];
  closedIssues: GitHubIssue[];
  cachedAt: number;
}

export interface CachedPrs {
  prs: OpenPRItem[];
  cachedAt: number;
}

// JS Maps iterate in insertion order, so delete+reinsert = LRU promotion.
function lruGet<T>(cache: Map<string, T>, key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  // Promote to most-recently-used by reinserting at the end
  cache.delete(key);
  cache.set(key, entry);
  return entry;
}

function lruSet<T>(cache: Map<string, T>, key: string, value: T): void {
  if (cache.has(key)) {
    cache.delete(key); // remove before reinserting to update order
  } else if (cache.size >= MAX_REPOS) {
    // Evict least-recently-used (first key in insertion order)
    cache.delete(cache.keys().next().value as string);
  }
  cache.set(key, value);
}

const issueCache = new Map<string, CachedIssues>();
const prCache = new Map<string, CachedPrs>();

// ── Issues ────────────────────────────────────────────────────────────────────

export function getCachedIssues(repoKey: string): CachedIssues | null {
  return lruGet(issueCache, repoKey);
}

export function isIssueCacheStale(repoKey: string): boolean {
  const entry = issueCache.get(repoKey);
  if (!entry) return true;
  return Date.now() - entry.cachedAt > TTL_MS;
}

export function updateCachedOpenIssues(
  repoKey: string,
  openIssues: GitHubIssue[]
) {
  const existing = lruGet(issueCache, repoKey);
  lruSet(issueCache, repoKey, {
    openIssues: openIssues.slice(0, MAX_ISSUES_PER_SECTION),
    closedIssues: existing?.closedIssues ?? [],
    cachedAt: Date.now(),
  });
}

export function updateCachedClosedIssues(
  repoKey: string,
  closedIssues: GitHubIssue[]
) {
  const existing = lruGet(issueCache, repoKey);
  lruSet(issueCache, repoKey, {
    openIssues: existing?.openIssues ?? [],
    closedIssues: closedIssues.slice(0, MAX_ISSUES_PER_SECTION),
    cachedAt: Date.now(),
  });
}

// ── Pull Requests ─────────────────────────────────────────────────────────────

export function getCachedPrs(repoKey: string): CachedPrs | null {
  return lruGet(prCache, repoKey);
}

export function isPrCacheStale(repoKey: string): boolean {
  const entry = prCache.get(repoKey);
  if (!entry) return true;
  return Date.now() - entry.cachedAt > TTL_MS;
}

export function setCachedPrs(repoKey: string, prs: OpenPRItem[]) {
  lruSet(prCache, repoKey, {
    prs: prs.slice(0, MAX_PRS),
    cachedAt: Date.now(),
  });
}
