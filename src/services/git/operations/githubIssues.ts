/**
 * Agent-callable orchestration functions for GitHub Issues.
 * These wrap the low-level Tauri IPC calls with auth resolution,
 * error normalization, and repo context resolution.
 */
import {
  createIssueCommentLocal,
  createIssueLocal,
  getIssueLocal,
  listIssueCommentsLocal,
  listIssuesLocal,
  updateIssueLocal,
} from "@src/api/tauri/github";
import type {
  GitHubIssue,
  GitHubIssueComment,
  GitHubIssueListResponse,
} from "@src/api/tauri/github";

import {
  parseGithubRepoFullName,
  resolveGitHubAuth,
} from "./createPullRequest";

// Re-export types for consumers
export type { GitHubIssue, GitHubIssueComment, GitHubIssueListResponse };

export type IssueResult<T> =
  | { data: T; error?: never }
  | { data?: never; error: string };

async function resolveContext(
  remoteUrl: string
): Promise<{ userId: string; token: string; repoFullName: string } | null> {
  const auth = await resolveGitHubAuth(remoteUrl);
  if (!auth) return null;
  const repoFullName = parseGithubRepoFullName(remoteUrl);
  if (!repoFullName) return null;
  return { ...auth, repoFullName };
}

export async function fetchIssues(
  remoteUrl: string,
  opts?: { state?: "open" | "closed" | "all"; labels?: string; page?: number }
): Promise<IssueResult<GitHubIssueListResponse>> {
  try {
    const ctx = await resolveContext(remoteUrl);
    if (!ctx) return { error: "not_authenticated" };
    const data = await listIssuesLocal(
      ctx.userId,
      ctx.token,
      ctx.repoFullName,
      opts
    );
    return { data };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function fetchIssue(
  remoteUrl: string,
  issueNumber: number
): Promise<IssueResult<GitHubIssue>> {
  try {
    const ctx = await resolveContext(remoteUrl);
    if (!ctx) return { error: "not_authenticated" };
    const data = await getIssueLocal(
      ctx.userId,
      ctx.token,
      ctx.repoFullName,
      issueNumber
    );
    return { data };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function createIssue(params: {
  remoteUrl: string;
  title: string;
  body?: string;
  labels?: string[];
  assignees?: string[];
}): Promise<IssueResult<GitHubIssue>> {
  try {
    const ctx = await resolveContext(params.remoteUrl);
    if (!ctx) return { error: "not_authenticated" };
    const data = await createIssueLocal(
      ctx.userId,
      ctx.token,
      ctx.repoFullName,
      params.title,
      params.body,
      params.labels,
      params.assignees
    );
    return { data };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function closeIssue(params: {
  remoteUrl: string;
  issueNumber: number;
  reason?: "completed" | "not_planned";
}): Promise<IssueResult<GitHubIssue>> {
  try {
    const ctx = await resolveContext(params.remoteUrl);
    if (!ctx) return { error: "not_authenticated" };
    const data = await updateIssueLocal(
      ctx.userId,
      ctx.token,
      ctx.repoFullName,
      params.issueNumber,
      {
        state: "closed",
        stateReason: params.reason ?? "completed",
      }
    );
    return { data };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function reopenIssue(params: {
  remoteUrl: string;
  issueNumber: number;
}): Promise<IssueResult<GitHubIssue>> {
  try {
    const ctx = await resolveContext(params.remoteUrl);
    if (!ctx) return { error: "not_authenticated" };
    const data = await updateIssueLocal(
      ctx.userId,
      ctx.token,
      ctx.repoFullName,
      params.issueNumber,
      { state: "open" }
    );
    return { data };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function addIssueComment(params: {
  remoteUrl: string;
  issueNumber: number;
  body: string;
}): Promise<IssueResult<GitHubIssueComment>> {
  try {
    const ctx = await resolveContext(params.remoteUrl);
    if (!ctx) return { error: "not_authenticated" };
    const data = await createIssueCommentLocal(
      ctx.userId,
      ctx.token,
      ctx.repoFullName,
      params.issueNumber,
      params.body
    );
    return { data };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function fetchIssueComments(params: {
  remoteUrl: string;
  issueNumber: number;
}): Promise<IssueResult<GitHubIssueComment[]>> {
  try {
    const ctx = await resolveContext(params.remoteUrl);
    if (!ctx) return { error: "not_authenticated" };
    const data = await listIssueCommentsLocal(
      ctx.userId,
      ctx.token,
      ctx.repoFullName,
      params.issueNumber
    );
    return { data };
  } catch (e) {
    return { error: String(e) };
  }
}
