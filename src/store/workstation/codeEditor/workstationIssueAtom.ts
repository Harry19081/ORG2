import { atom } from "jotai";

import type { GitHubIssue, GitHubIssueComment } from "@src/api/tauri/github";

export type IssueFilterState = "open" | "closed" | "all";

export interface WorkstationIssueListState {
  issues: GitHubIssue[];
  loading: boolean;
  error: string | null;
  filter: IssueFilterState;
  labelFilter: string;
  searchQuery: string;
  page: number;
  hasMore: boolean;
}

export interface WorkstationSelectedIssueState {
  issue: GitHubIssue | null;
  comments: GitHubIssueComment[];
  loading: boolean;
  commentsLoading: boolean;
  error: string | null;
  submittingComment: boolean;
}

const initialListState: WorkstationIssueListState = {
  issues: [],
  loading: false,
  error: null,
  filter: "open",
  labelFilter: "",
  searchQuery: "",
  page: 1,
  hasMore: false,
};

const initialSelectedState: WorkstationSelectedIssueState = {
  issue: null,
  comments: [],
  loading: false,
  commentsLoading: false,
  error: null,
  submittingComment: false,
};

// TODO(multi-panel): use atomFamily keyed by repoId when multiple workstation panels are supported.
export const workstationIssueListAtom =
  atom<WorkstationIssueListState>(initialListState);
workstationIssueListAtom.debugLabel = "workstationIssueListAtom";

export const workstationSelectedIssueAtom =
  atom<WorkstationSelectedIssueState>(initialSelectedState);
workstationSelectedIssueAtom.debugLabel = "workstationSelectedIssueAtom";

// Callback atom for actions triggerable from PinnedActionsBar, agents, or the
// github-issue-detail tab rendered in the main pane.
export const workstationIssueCallbackAtom = atom<{
  openNewIssueForm: (() => void) | null;
  closeIssue: ((number: number) => Promise<void>) | null;
  reopenIssue: ((number: number) => Promise<void>) | null;
  addComment: ((number: number, body: string) => Promise<void>) | null;
  refreshIssues: (() => void) | null;
}>({
  openNewIssueForm: null,
  closeIssue: null,
  reopenIssue: null,
  addComment: null,
  refreshIssues: null,
});
workstationIssueCallbackAtom.debugLabel = "workstationIssueCallbackAtom";
