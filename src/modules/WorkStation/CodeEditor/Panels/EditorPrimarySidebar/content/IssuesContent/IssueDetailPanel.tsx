import {
  ArrowLeft,
  CircleDot,
  ExternalLink,
  Loader2,
  XCircle,
} from "lucide-react";
import React, { memo, useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { GitHubIssue, GitHubIssueComment } from "@src/api/tauri/github";
import {
  formatTimeAgo,
  getLabelColorStyle,
} from "@src/modules/WorkStation/CodeEditor/Panels/EditorPrimarySidebar/hooks/workstationIssueHelpers";

interface IssueDetailPanelProps {
  issue: GitHubIssue;
  comments: GitHubIssueComment[];
  commentsLoading: boolean;
  submittingComment: boolean;
  onClose: () => void;
  onCloseIssue: () => void;
  onReopenIssue: () => void;
  onAddComment: (body: string) => Promise<void>;
}

export const IssueDetailPanel: React.FC<IssueDetailPanelProps> = memo(
  ({
    issue,
    comments,
    commentsLoading,
    submittingComment,
    onClose,
    onCloseIssue,
    onReopenIssue,
    onAddComment,
  }) => {
    const { t } = useTranslation("common");
    const [commentBody, setCommentBody] = useState("");
    const commentRef = useRef<HTMLTextAreaElement>(null);
    const isOpen = issue.state === "open";

    const handleCommentSubmit = useCallback(async () => {
      const body = commentBody.trim();
      if (!body || submittingComment) return;
      await onAddComment(body);
      setCommentBody("");
    }, [commentBody, submittingComment, onAddComment]);

    const handleOpenUrl = useCallback(() => {
      if (issue.html_url) {
        window.open(issue.html_url, "_blank", "noopener,noreferrer");
      }
    }, [issue.html_url]);

    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex shrink-0 items-center gap-2 border-b border-border-1 px-3 py-2">
          <button
            type="button"
            onClick={onClose}
            className="flex shrink-0 items-center justify-center rounded p-1 text-text-3 hover:bg-fill-2 hover:text-text-1"
            title={t("actions.back", "Back")}
          >
            <ArrowLeft size={14} strokeWidth={2} />
          </button>

          <span
            className={`shrink-0 ${isOpen ? "text-[#3fb950]" : "text-text-3"}`}
          >
            {isOpen ? (
              <CircleDot size={14} strokeWidth={2} />
            ) : (
              <XCircle size={14} strokeWidth={2} />
            )}
          </span>

          <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-text-1">
            <span className="mr-1 font-mono text-[11px] text-text-3">
              #{issue.number}
            </span>
            {issue.title}
          </span>

          <button
            type="button"
            onClick={handleOpenUrl}
            className="shrink-0 text-text-3 hover:text-text-1"
            title="Open in GitHub"
          >
            <ExternalLink size={12} strokeWidth={2} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {/* Meta */}
          <div className="flex flex-col gap-1.5 border-b border-border-1 px-3 py-2">
            {/* Author */}
            <div className="flex items-center gap-1.5 text-[11px] text-text-3">
              <img
                src={issue.user.avatar_url}
                alt={issue.user.login}
                className="h-4 w-4 rounded-full"
              />
              <span className="font-medium text-text-2">
                {issue.user.login}
              </span>
              <span>opened {formatTimeAgo(issue.created_at)}</span>
            </div>

            {/* Labels */}
            {issue.labels.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {issue.labels.map((label) => {
                  const style = getLabelColorStyle(label.color);
                  return (
                    <span
                      key={label.id}
                      className="rounded-full px-1.5 py-[1px] text-[10px] font-medium leading-tight"
                      style={style}
                    >
                      {label.name}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Assignees */}
            {issue.assignees.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 text-[11px] text-text-3">
                <span>Assigned:</span>
                {issue.assignees.map((user) => (
                  <span key={user.login} className="flex items-center gap-0.5">
                    <img
                      src={user.avatar_url}
                      alt={user.login}
                      className="h-3.5 w-3.5 rounded-full"
                    />
                    <span className="text-text-2">{user.login}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Body */}
          {issue.body && (
            <div className="border-b border-border-1 px-3 py-2">
              <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-text-1">
                {issue.body}
              </p>
            </div>
          )}

          {/* Action row */}
          <div className="border-b border-border-1 px-3 py-2">
            {isOpen ? (
              <button
                type="button"
                onClick={onCloseIssue}
                className="rounded border border-border-2 px-2.5 py-1 text-[11px] text-text-2 hover:bg-fill-2"
              >
                Close issue
              </button>
            ) : (
              <button
                type="button"
                onClick={onReopenIssue}
                className="rounded border border-border-2 px-2.5 py-1 text-[11px] text-[#3fb950] hover:bg-fill-2"
              >
                Reopen issue
              </button>
            )}
          </div>

          {/* Comments */}
          <div className="flex flex-1 flex-col">
            {commentsLoading ? (
              <div className="flex items-center justify-center py-6 text-text-3">
                <Loader2 size={14} className="animate-spin" />
              </div>
            ) : (
              comments.map((comment) => (
                <div
                  key={comment.id}
                  className="border-b border-border-1 px-3 py-2"
                >
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] text-text-3">
                    <img
                      src={comment.user.avatar_url}
                      alt={comment.user.login}
                      className="h-4 w-4 rounded-full"
                    />
                    <span className="font-medium text-text-2">
                      {comment.user.login}
                    </span>
                    <span>{formatTimeAgo(comment.created_at)}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-text-1">
                    {comment.body}
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Add comment */}
          <div className="shrink-0 px-3 py-2">
            <textarea
              ref={commentRef}
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder={t(
                "git.issues.commentPlaceholder",
                "Leave a comment…"
              )}
              rows={3}
              className="mb-2 w-full resize-none rounded border border-border-2 bg-fill-1 px-2 py-1.5 text-[12px] text-text-1 placeholder:text-text-3 focus:border-primary-6 focus:outline-none"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void handleCommentSubmit()}
                disabled={!commentBody.trim() || submittingComment}
                className="flex items-center gap-1 rounded bg-primary-6 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-primary-7 disabled:opacity-50"
              >
                {submittingComment && (
                  <Loader2 size={11} className="animate-spin" />
                )}
                {t("git.issues.submitComment", "Comment")}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

IssueDetailPanel.displayName = "IssueDetailPanel";
