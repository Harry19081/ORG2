/**
 * useWorkstationIssues
 *
 * Core data layer for the GitHub Issues panel in the workstation sidebar.
 * Owns fetch/create/update/close/reopen/comment logic, writes to
 * workstationIssueListAtom and workstationSelectedIssueAtom, and exposes
 * stable callbacks that the UI components consume.
 */
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getGitRemotes } from "@src/api/http/git/remotes";
import { resolveGitHubAuth } from "@src/services/git/operations/createPullRequest";
import {
  addIssueComment,
  closeIssue,
  createIssue,
  fetchIssueComments,
  fetchIssues,
  fetchRepoCollaborators,
  fetchRepoLabels,
  reopenIssue,
  updateIssue,
} from "@src/services/git/operations/githubIssues";
import type {
  GitHubIssue,
  GitHubIssueLabel,
  GitHubIssueUser,
} from "@src/services/git/operations/githubIssues";
import {
  workstationIssueCallbackAtom,
  workstationIssueListAtom,
  workstationSelectedIssueAtom,
} from "@src/store/workstation/codeEditor/workstationIssueAtom";
import type { IssueFilterState } from "@src/store/workstation/codeEditor/workstationIssueAtom";

export type { IssueFilterState };

export interface UpdateIssueFields {
  title?: string;
  body?: string;
  labels?: string[];
  assignees?: string[];
}

export interface UseWorkstationIssuesOptions {
  repoPath: string;
  repoId?: string;
  branchName?: string;
  remoteUrl?: string;
}

export function useWorkstationIssues({
  repoPath,
  repoId = "default",
  remoteUrl: remoteUrlProp,
}: UseWorkstationIssuesOptions) {
  const setListState = useSetAtom(workstationIssueListAtom);
  const setSelectedState = useSetAtom(workstationSelectedIssueAtom);
  const setCallbackAtom = useSetAtom(workstationIssueCallbackAtom);

  const listState = useAtomValue(workstationIssueListAtom);
  const selectedState = useAtomValue(workstationSelectedIssueAtom);

  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── Auth / remote URL resolution ──────────────────────────────────────────

  const [resolvedRemoteUrl, setResolvedRemoteUrl] = useState<string | null>(
    null
  );
  const [hasGitHubAuth, setHasGitHubAuth] = useState(false);

  const [repoLabels, setRepoLabels] = useState<GitHubIssueLabel[]>([]);
  const [collaborators, setCollaborators] = useState<GitHubIssueUser[]>([]);

  // Resolve origin remote URL if not provided via props
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (remoteUrlProp) {
        if (!cancelled) setResolvedRemoteUrl(remoteUrlProp);
        return;
      }
      if (!repoPath) return;

      try {
        const remotesData = await getGitRemotes({
          repo_id: repoId,
          repo_path: repoPath,
        });
        const origin = remotesData?.remotes?.find((r) => r.name === "origin");
        if (!cancelled && origin?.url) {
          setResolvedRemoteUrl(origin.url);
        }
      } catch {
        // silent — no remote
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [repoPath, repoId, remoteUrlProp]);

  // Check auth when remote URL resolves
  useEffect(() => {
    if (!resolvedRemoteUrl) return;
    let cancelled = false;
    void (async () => {
      const auth = await resolveGitHubAuth(resolvedRemoteUrl);
      if (!cancelled) {
        setHasGitHubAuth(!!auth);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolvedRemoteUrl]);

  // ── Local filter state (search debounce lives here) ───────────────────────

  const [filterState, setFilterState] = useState<IssueFilterState>("open");
  const [searchQuery, setSearchQuery] = useState("");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const handleSetSearchQuery = useCallback((q: string) => {
    setSearchQuery(q);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(q);
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  // ── Fetch issues ──────────────────────────────────────────────────────────

  const fetchPage = useCallback(
    async (filter: IssueFilterState, page: number) => {
      if (!resolvedRemoteUrl || !hasGitHubAuth) return;

      setListState((prev) => ({ ...prev, loading: true, error: null }));

      const result = await fetchIssues(resolvedRemoteUrl, {
        state: filter === "all" ? "all" : filter,
        page,
      });

      if (!mountedRef.current) return;

      if (result.error) {
        setListState((prev) => ({
          ...prev,
          loading: false,
          error: result.error ?? null,
        }));
        return;
      }

      const { issues, has_more } = result.data!;
      setListState((prev) => ({
        ...prev,
        loading: false,
        issues: page === 1 ? issues : [...prev.issues, ...issues],
        hasMore: has_more,
        page,
        filter,
      }));
    },
    [resolvedRemoteUrl, hasGitHubAuth, setListState]
  );

  const refresh = useCallback(() => {
    void fetchPage(filterState, 1);
  }, [fetchPage, filterState]);

  // Fetch on mount or when filter/auth changes
  useEffect(() => {
    if (!resolvedRemoteUrl || !hasGitHubAuth) return;
    setListState((prev) => ({ ...prev, page: 1 }));
    void fetchPage(filterState, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedRemoteUrl, hasGitHubAuth, filterState]);

  // Refetch on debounced search change (client-side filter applied in UI)
  // Search filtering is done client-side via filterIssuesByQuery helper

  // Fetch repo labels + collaborators once auth is available
  useEffect(() => {
    if (!resolvedRemoteUrl || !hasGitHubAuth) return;
    let cancelled = false;

    void (async () => {
      const [labelsResult, collabResult] = await Promise.all([
        fetchRepoLabels(resolvedRemoteUrl),
        fetchRepoCollaborators(resolvedRemoteUrl),
      ]);
      if (cancelled) return;
      if (labelsResult.data) setRepoLabels(labelsResult.data);
      if (collabResult.data) setCollaborators(collabResult.data);
    })();

    return () => {
      cancelled = true;
    };
  }, [resolvedRemoteUrl, hasGitHubAuth]);

  // ── Issue selection ───────────────────────────────────────────────────────

  const selectIssue = useCallback(
    (issue: GitHubIssue | null) => {
      if (!issue) {
        setSelectedState((prev) => ({ ...prev, issue: null, comments: [] }));
        return;
      }
      setSelectedState((prev) => ({
        ...prev,
        issue,
        comments: [],
        commentsLoading: true,
      }));

      if (!resolvedRemoteUrl) return;
      void (async () => {
        const result = await fetchIssueComments({
          remoteUrl: resolvedRemoteUrl,
          issueNumber: issue.number,
        });
        if (!mountedRef.current) return;
        if (result.data) {
          setSelectedState((prev) => ({
            ...prev,
            comments: result.data!,
            commentsLoading: false,
          }));
        } else {
          setSelectedState((prev) => ({
            ...prev,
            commentsLoading: false,
          }));
        }
      })();
    },
    [resolvedRemoteUrl, setSelectedState]
  );

  // ── Mutations ─────────────────────────────────────────────────────────────

  const handleCreateIssue = useCallback(
    async (
      title: string,
      body?: string,
      labels?: string[],
      assignees?: string[]
    ): Promise<GitHubIssue | null> => {
      if (!resolvedRemoteUrl) return null;
      const result = await createIssue({
        remoteUrl: resolvedRemoteUrl,
        title,
        body,
        labels,
        assignees,
      });
      if (result.data && mountedRef.current) {
        setListState((prev) => ({
          ...prev,
          issues:
            filterState === "open" || filterState === "all"
              ? [result.data!, ...prev.issues]
              : prev.issues,
        }));
        return result.data;
      }
      return null;
    },
    [resolvedRemoteUrl, filterState, setListState]
  );

  const handleUpdateIssue = useCallback(
    async (number: number, fields: UpdateIssueFields): Promise<void> => {
      if (!resolvedRemoteUrl) return;
      const result = await updateIssue({
        remoteUrl: resolvedRemoteUrl,
        issueNumber: number,
        updates: fields,
      });
      if (result.data && mountedRef.current) {
        const updated = result.data;
        setListState((prev) => ({
          ...prev,
          issues: prev.issues.map((i) => (i.number === number ? updated : i)),
        }));
        setSelectedState((prev) =>
          prev.issue?.number === number ? { ...prev, issue: updated } : prev
        );
      }
    },
    [resolvedRemoteUrl, setListState, setSelectedState]
  );

  const handleCloseIssue = useCallback(
    async (number: number): Promise<void> => {
      if (!resolvedRemoteUrl) return;
      const result = await closeIssue({
        remoteUrl: resolvedRemoteUrl,
        issueNumber: number,
      });
      if (result.data && mountedRef.current) {
        const updated = result.data;
        setListState((prev) => ({
          ...prev,
          issues:
            filterState === "open"
              ? prev.issues.filter((i) => i.number !== number)
              : prev.issues.map((i) => (i.number === number ? updated : i)),
        }));
        setSelectedState((prev) =>
          prev.issue?.number === number ? { ...prev, issue: updated } : prev
        );
      }
    },
    [resolvedRemoteUrl, filterState, setListState, setSelectedState]
  );

  const handleReopenIssue = useCallback(
    async (number: number): Promise<void> => {
      if (!resolvedRemoteUrl) return;
      const result = await reopenIssue({
        remoteUrl: resolvedRemoteUrl,
        issueNumber: number,
      });
      if (result.data && mountedRef.current) {
        const updated = result.data;
        setListState((prev) => ({
          ...prev,
          issues:
            filterState === "closed"
              ? prev.issues.filter((i) => i.number !== number)
              : prev.issues.map((i) => (i.number === number ? updated : i)),
        }));
        setSelectedState((prev) =>
          prev.issue?.number === number ? { ...prev, issue: updated } : prev
        );
      }
    },
    [resolvedRemoteUrl, filterState, setListState, setSelectedState]
  );

  const handleAddComment = useCallback(
    async (number: number, body: string): Promise<void> => {
      if (!resolvedRemoteUrl) return;
      setSelectedState((prev) => ({ ...prev, submittingComment: true }));
      const result = await addIssueComment({
        remoteUrl: resolvedRemoteUrl,
        issueNumber: number,
        body,
      });
      if (!mountedRef.current) return;
      if (result.data) {
        setSelectedState((prev) => ({
          ...prev,
          comments: [...prev.comments, result.data!],
          submittingComment: false,
        }));
        setListState((prev) => ({
          ...prev,
          issues: prev.issues.map((i) =>
            i.number === number ? { ...i, comments: i.comments + 1 } : i
          ),
        }));
      } else {
        setSelectedState((prev) => ({ ...prev, submittingComment: false }));
      }
    },
    [resolvedRemoteUrl, setSelectedState, setListState]
  );

  // ── Expose openNewIssueForm callback ──────────────────────────────────────
  // This is populated by IssuesContent once it mounts; the atom acts as a
  // shared signal so PinnedActionsBar / agents can trigger it externally.

  // Clean up atoms on unmount
  useEffect(() => {
    return () => {
      if (!mountedRef.current) return;
      setListState({
        issues: [],
        loading: false,
        error: null,
        filter: "open",
        labelFilter: "",
        searchQuery: "",
        page: 1,
        hasMore: false,
      });
      setSelectedState({
        issue: null,
        comments: [],
        loading: false,
        commentsLoading: false,
        error: null,
        submittingComment: false,
      });
      setCallbackAtom({ openNewIssueForm: null });
    };
  }, [setListState, setSelectedState, setCallbackAtom]);

  // ── Derived values ────────────────────────────────────────────────────────

  const filteredIssues = useMemo<GitHubIssue[]>(() => {
    if (!debouncedSearch.trim()) return listState.issues;
    const q = debouncedSearch.toLowerCase();
    return listState.issues.filter(
      (issue) =>
        issue.title.toLowerCase().includes(q) ||
        issue.labels.some((l) => l.name.toLowerCase().includes(q)) ||
        issue.user.login.toLowerCase().includes(q)
    );
  }, [listState.issues, debouncedSearch]);

  return {
    issues: filteredIssues,
    loading: listState.loading,
    error: listState.error,
    filterState,
    setFilterState,
    searchQuery,
    setSearchQuery: handleSetSearchQuery,
    selectedIssue: selectedState.issue,
    selectIssue,
    comments: selectedState.comments,
    commentsLoading: selectedState.commentsLoading,
    submittingComment: selectedState.submittingComment,
    handleCreateIssue,
    handleUpdateIssue,
    handleCloseIssue,
    handleReopenIssue,
    handleAddComment,
    refresh,
    repoLabels,
    collaborators,
    hasGitHubAuth,
  };
}
