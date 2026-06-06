import { ArrowLeft, CircleDot, ExternalLink, XCircle } from "lucide-react";
import React, { memo, useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { GitHubIssue, GitHubIssueComment } from "@src/api/tauri/github";
import Button from "@src/components/Button";
import {
  HEADER_BUTTON,
  HEADER_ICON_SIZE,
  TYPOGRAPHY,
} from "@src/config/workstation/tokens";
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
            className={HEADER_BUTTON.action}
            title={t("actions.back", "Back")}
          >
            <ArrowLeft size={HEADER_ICON_SIZE.sm} strokeWidth={2} />
          </button>

          <span
            className={`shrink-0 ${isOpen ? "text-success-6" : "text-text-3"}`}
          >
            {isOpen ? (
              <CircleDot size={HEADER_ICON_SIZE.sm} strokeWidth={2} />
            ) : (
              <XCircle size={HEADER_ICON_SIZE.sm} strokeWidth={2} />
            )}
          </span>

          <span
            className={`min-w-0 flex-1 truncate ${TYPOGRAPHY.value} font-medium text-text-1`}
          >
            <span
              className={`mr-1 font-mono ${TYPOGRAPHY.secondary} text-text-3`}
            >
              #{issue.number}
            </span>
            {issue.title}
          </span>

          <button
            type="button"
            onClick={handleOpenUrl}
            className={HEADER_BUTTON.action}
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
            <div
              className={`flex items-center gap-1.5 ${TYPOGRAPHY.secondary} text-text-3`}
            >
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
                      className={`rounded-full px-1.5 py-[1px] ${TYPOGRAPHY.badge} leading-tight`}
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
              <div
                className={`flex flex-wrap items-center gap-1 ${TYPOGRAPHY.secondary} text-text-3`}
              >
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
              <p
                className={`whitespace-pre-wrap ${TYPOGRAPHY.value} leading-relaxed text-text-1`}
              >
                {issue.body}
              </p>
            </div>
          )}

          {/* Action row */}
          <div className="border-b border-border-1 px-3 py-2">
            {isOpen ? (
              <Button
                htmlType="button"
                variant="secondary"
                size="mini"
                onClick={onCloseIssue}
              >
                Close issue
              </Button>
            ) : (
              <Button
                htmlType="button"
                variant="success"
                appearance="outline"
                size="mini"
                onClick={onReopenIssue}
              >
                Reopen issue
              </Button>
            )}
          </div>

          {/* Comments */}
          <div className="flex flex-1 flex-col">
            {commentsLoading ? (
              <div className="flex items-center justify-center py-6">
                <Button
                  variant="tertiary"
                  size="mini"
                  loading
                  iconOnly
                  icon={<span />}
                />
              </div>
            ) : (
              comments.map((comment) => (
                <div
                  key={comment.id}
                  className="border-b border-border-1 px-3 py-2"
                >
                  <div
                    className={`mb-1 flex items-center gap-1.5 ${TYPOGRAPHY.secondary} text-text-3`}
                  >
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
                  <p
                    className={`whitespace-pre-wrap ${TYPOGRAPHY.value} leading-relaxed text-text-1`}
                  >
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
              className={`mb-2 w-full resize-none rounded border border-border-2 bg-fill-1 px-2 py-1.5 ${TYPOGRAPHY.value} text-text-1 placeholder:text-text-3 focus:border-primary-6 focus:outline-none`}
            />
            <div className="flex justify-end">
              <Button
                htmlType="button"
                variant="primary"
                size="mini"
                loading={submittingComment}
                disabled={!commentBody.trim() || submittingComment}
                onClick={() => void handleCommentSubmit()}
              >
                {t("git.issues.submitComment", "Comment")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

IssueDetailPanel.displayName = "IssueDetailPanel";
