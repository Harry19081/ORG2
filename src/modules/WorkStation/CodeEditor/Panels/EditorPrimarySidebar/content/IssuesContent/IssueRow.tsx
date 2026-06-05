import { CircleDot, MessageSquare, XCircle } from "lucide-react";
import React, { memo } from "react";

import type { GitHubIssue } from "@src/api/tauri/github";
import { PRIMARY_SIDEBAR_HOVER } from "@src/config/workstation/tokens";
import {
  formatTimeAgo,
  getLabelColorStyle,
} from "@src/modules/WorkStation/CodeEditor/Panels/EditorPrimarySidebar/hooks/workstationIssueHelpers";

interface IssueRowProps {
  issue: GitHubIssue;
  isSelected: boolean;
  onClick: () => void;
}

export const IssueRow: React.FC<IssueRowProps> = memo(
  ({ issue, isSelected, onClick }) => {
    const isOpen = issue.state === "open";

    return (
      <button
        type="button"
        onClick={onClick}
        className={`flex w-full min-w-0 items-start gap-2 px-3 py-2 text-left transition-colors ${
          isSelected
            ? "bg-fill-2 text-text-1"
            : `text-text-2 ${PRIMARY_SIDEBAR_HOVER.row}`
        }`}
      >
        {/* State icon */}
        <span
          className={`mt-0.5 shrink-0 ${isOpen ? "text-[#3fb950]" : "text-text-3"}`}
        >
          {isOpen ? (
            <CircleDot size={14} strokeWidth={2} />
          ) : (
            <XCircle size={14} strokeWidth={2} />
          )}
        </span>

        {/* Center content */}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          {/* Title row */}
          <span className="flex min-w-0 items-baseline gap-1.5">
            <span className="shrink-0 font-mono text-[11px] text-text-3">
              #{issue.number}
            </span>
            <span className="min-w-0 truncate text-[12px] font-medium leading-[1.4] text-text-1">
              {issue.title}
            </span>
          </span>

          {/* Labels */}
          {issue.labels.length > 0 && (
            <span className="flex flex-wrap gap-1">
              {issue.labels.slice(0, 4).map((label) => {
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
            </span>
          )}

          {/* Meta */}
          <span className="text-[11px] text-text-3">
            {issue.user.login} · {formatTimeAgo(issue.updated_at)}
          </span>
        </span>

        {/* Comment count badge */}
        {issue.comments > 0 && (
          <span className="mt-0.5 flex shrink-0 items-center gap-0.5 text-[11px] text-text-3">
            <MessageSquare size={11} strokeWidth={1.75} />
            <span>{issue.comments}</span>
          </span>
        )}
      </button>
    );
  }
);

IssueRow.displayName = "IssueRow";
