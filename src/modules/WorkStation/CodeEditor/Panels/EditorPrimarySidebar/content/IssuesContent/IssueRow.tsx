import { CircleDot, MessageSquare, XCircle } from "lucide-react";
import React, { memo } from "react";

import type { GitHubIssue } from "@src/api/tauri/github";
import {
  PRIMARY_SIDEBAR_HOVER,
  TYPOGRAPHY,
} from "@src/config/workstation/tokens";
import { getLabelColorStyle } from "@src/modules/WorkStation/CodeEditor/Panels/EditorPrimarySidebar/hooks/workstationIssueHelpers";

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
        className={`group/issue-row flex h-[28px] w-full min-w-0 items-center gap-1.5 pl-8 pr-2 text-left transition-colors ${
          isSelected
            ? `bg-fill-2 text-text-1 ${PRIMARY_SIDEBAR_HOVER.selectedRow}`
            : `text-text-2 ${PRIMARY_SIDEBAR_HOVER.row}`
        }`}
        title={`#${issue.number} ${issue.title}`}
      >
        {/* State icon — left, like a file type icon */}
        <span
          className={`shrink-0 ${isOpen ? "text-success-6" : "text-text-3"}`}
        >
          {isOpen ? (
            <CircleDot size={14} strokeWidth={1.75} />
          ) : (
            <XCircle size={14} strokeWidth={1.75} />
          )}
        </span>

        {/* Title */}
        <span
          className={`min-w-0 flex-1 truncate ${TYPOGRAPHY.value} leading-[1.4] text-text-1`}
        >
          {issue.title}
        </span>

        {/* Right side: labels (up to 2) + issue number badge */}
        <span className="ml-auto flex shrink-0 items-center gap-1">
          {issue.labels.slice(0, 2).map((label) => {
            const style = getLabelColorStyle(label.color);
            return (
              <span
                key={label.id}
                className={`rounded-full px-1 py-[1px] ${TYPOGRAPHY.badge} leading-tight`}
                style={style}
              >
                {label.name}
              </span>
            );
          })}

          {/* Comment count */}
          {issue.comments > 0 && (
            <span
              className={`flex items-center gap-0.5 ${TYPOGRAPHY.secondary} text-text-3`}
            >
              <MessageSquare size={11} strokeWidth={1.75} />
              <span>{issue.comments}</span>
            </span>
          )}

          {/* Issue number badge — right side, like a file status badge */}
          <span
            className={`min-w-[28px] rounded px-1 py-[1px] text-right font-mono ${TYPOGRAPHY.secondary} text-text-3`}
          >
            #{issue.number}
          </span>
        </span>
      </button>
    );
  }
);

IssueRow.displayName = "IssueRow";
