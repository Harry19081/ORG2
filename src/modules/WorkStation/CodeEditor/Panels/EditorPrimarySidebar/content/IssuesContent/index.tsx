/**
 * IssuesContent
 *
 * GitHub Issues panel for the workstation primary sidebar.
 * Renders the filter bar, issue list, new-issue form, and detail panel.
 */
import { useSetAtom } from "jotai";
import { RefreshCw, Search } from "lucide-react";
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import Button from "@src/components/Button";
import Input from "@src/components/Input";
import {
  HEADER_BUTTON,
  HEADER_ICON_SIZE,
  TYPOGRAPHY,
} from "@src/config/workstation/tokens";
import { Placeholder } from "@src/modules/shared/layouts/blocks";
import { workstationIssueCallbackAtom } from "@src/store/workstation/codeEditor/workstationIssueAtom";

import { useWorkstationIssues } from "../../hooks/useWorkstationIssues";
import type { IssueFilterState } from "../../hooks/useWorkstationIssues";
import { IssueDetailPanel } from "./IssueDetailPanel";
import { IssueRow } from "./IssueRow";
import { NewIssueForm } from "./NewIssueForm";

export interface IssuesContentProps {
  repoPath: string;
  repoId?: string;
  branchName?: string;
  remoteUrl?: string;
  onOpenNewIssueForm?: () => void;
}

const FILTER_OPTIONS: { value: IssueFilterState; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All" },
];

const IssuesContent: React.FC<IssuesContentProps> = memo(
  ({ repoPath, repoId, branchName, remoteUrl }) => {
    const { t } = useTranslation("common");
    const setCallbackAtom = useSetAtom(workstationIssueCallbackAtom);

    const {
      issues,
      loading,
      error,
      filterState,
      setFilterState,
      searchQuery,
      setSearchQuery,
      selectedIssue,
      selectIssue,
      comments,
      commentsLoading,
      submittingComment,
      handleCreateIssue,
      handleCloseIssue,
      handleReopenIssue,
      handleAddComment,
      refresh,
      repoLabels,
      collaborators,
    } = useWorkstationIssues({ repoPath, repoId, branchName, remoteUrl });

    const [showNewIssueForm, setShowNewIssueForm] = useState(false);
    const [creatingIssue, setCreatingIssue] = useState(false);
    const listRef = useRef<HTMLDivElement>(null);

    const handleOpenNewIssueForm = useCallback(() => {
      setShowNewIssueForm(true);
      selectIssue(null);
    }, [selectIssue]);

    const handleCancelNewIssue = useCallback(() => {
      setShowNewIssueForm(false);
    }, []);

    const handleSubmitNewIssue = useCallback(
      async (
        title: string,
        body: string,
        labels: string[],
        assignees: string[]
      ) => {
        setCreatingIssue(true);
        try {
          const created = await handleCreateIssue(
            title,
            body || undefined,
            labels,
            assignees
          );
          if (created) {
            setShowNewIssueForm(false);
            selectIssue(created);
          }
        } finally {
          setCreatingIssue(false);
        }
      },
      [handleCreateIssue, selectIssue]
    );

    const handleSelectIssueNull = useCallback(() => {
      selectIssue(null);
    }, [selectIssue]);

    // Register openNewIssueForm callback so PinnedActionsBar or agents can trigger it
    useEffect(() => {
      setCallbackAtom({ openNewIssueForm: handleOpenNewIssueForm });
      return () => {
        setCallbackAtom({ openNewIssueForm: null });
      };
    }, [setCallbackAtom, handleOpenNewIssueForm]);

    const isInitialLoading = loading && issues.length === 0;

    // ── Render ────────────────────────────────────────────────────────────────

    if (selectedIssue) {
      return (
        <IssueDetailPanel
          issue={selectedIssue}
          comments={comments}
          commentsLoading={commentsLoading}
          submittingComment={submittingComment}
          onClose={handleSelectIssueNull}
          onCloseIssue={() => void handleCloseIssue(selectedIssue.number)}
          onReopenIssue={() => void handleReopenIssue(selectedIssue.number)}
          onAddComment={(body) => handleAddComment(selectedIssue.number, body)}
        />
      );
    }

    const filterBar = (
      <div className="flex shrink-0 items-center gap-1 border-b border-border-1 px-2 py-1.5">
        {/* State toggle pills */}
        <div className="flex rounded-md border border-border-2 bg-fill-1 p-0.5">
          {FILTER_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilterState(value)}
              className={`rounded px-2 py-0.5 ${TYPOGRAPHY.secondary} font-medium transition-colors ${
                filterState === value
                  ? "bg-primary-6 text-white"
                  : "text-text-2 hover:text-text-1"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex flex-1">
          <Input
            value={searchQuery}
            onChange={(val) => setSearchQuery(val)}
            placeholder={t(
              "git.issues.searchPlaceholder",
              "Filter by title or label…"
            )}
            prefix={<Search size={11} strokeWidth={2} />}
            size="small"
            className="w-full"
          />
        </div>

        {/* Refresh */}
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className={`${HEADER_BUTTON.actionDisabled} shrink-0`}
          title={t("actions.refresh", "Refresh")}
        >
          <RefreshCw
            size={HEADER_ICON_SIZE.sm}
            strokeWidth={2}
            className={loading ? "animate-spin" : undefined}
          />
        </button>
      </div>
    );

    let listContent: React.ReactNode;
    if (isInitialLoading) {
      listContent = (
        <div className="flex flex-1 items-center justify-center">
          <Button
            variant="tertiary"
            size="mini"
            loading
            iconOnly
            icon={<span />}
          />
        </div>
      );
    } else if (error) {
      listContent = (
        <Placeholder
          variant="error"
          placement="sidebar"
          title={t("git.issues.failedToLoad", "Failed to load issues")}
          subtitle={error}
          action={{ label: t("actions.retry", "Retry"), onClick: refresh }}
          fillParentHeight
        />
      );
    } else if (issues.length === 0) {
      listContent = (
        <Placeholder
          variant="empty"
          placement="sidebar"
          title={t("git.issues.empty", "No {{state}} issues", {
            state: filterState,
          })}
          fillParentHeight
        />
      );
    } else {
      listContent = (
        <div ref={listRef} className="flex flex-1 flex-col overflow-y-auto">
          {issues.map((issue) => (
            <IssueRow
              key={issue.number}
              issue={issue}
              isSelected={false}
              onClick={() => selectIssue(issue)}
            />
          ))}
        </div>
      );
    }

    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        {filterBar}
        {showNewIssueForm && (
          <NewIssueForm
            onSubmit={handleSubmitNewIssue}
            onCancel={handleCancelNewIssue}
            repoLabels={repoLabels}
            collaborators={collaborators}
            loading={creatingIssue}
          />
        )}
        {listContent}
      </div>
    );
  }
);

IssuesContent.displayName = "IssuesContent";

export default IssuesContent;
