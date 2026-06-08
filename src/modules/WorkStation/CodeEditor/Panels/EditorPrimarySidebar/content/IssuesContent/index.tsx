/**
 * IssuesContent
 *
 * GitHub Issues panel for the workstation primary sidebar.
 * Interaction patterns aligned with SourceControlContent:
 * - "Filter issues…" input (same style as "Filter changes…")
 * - CollapsibleSection grouping for Open/Closed issues
 * - State filter as compact header actions on the section header
 */
import { useSetAtom } from "jotai";
import { Filter as FilterIcon, RefreshCw } from "lucide-react";
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import Input from "@src/components/Input";
import {
  COUNT_BADGE,
  HEADER_BUTTON,
  HEADER_ICON_SIZE,
  getCountBadgeSizeClass,
} from "@src/config/workstation/tokens";
import { CollapsibleSection } from "@src/modules/WorkStation/shared/PrimarySidebarLayout";
import { usePrimarySidebarSurface } from "@src/modules/WorkStation/shared/hooks/usePrimarySidebarSurface";
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

const IssuesContent: React.FC<IssuesContentProps> = memo(
  ({ repoPath, repoId, branchName, remoteUrl }) => {
    const { t } = useTranslation("common");
    const setCallbackAtom = useSetAtom(workstationIssueCallbackAtom);
    const { surfaceBgClass } = usePrimarySidebarSurface();

    const {
      issues,
      loading,
      remoteUrlLoading,
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
    const [openCollapsed, setOpenCollapsed] = useState(false);
    const [closedCollapsed, setClosedCollapsed] = useState(false);
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

    // Show spinner while the remote URL is still being resolved (async) OR
    // while the first page of issues is loading. Without this guard the panel
    // would flash "No open issues" before the async fetch even starts.
    const isInitialLoading =
      remoteUrlLoading || (loading && issues.length === 0);

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

    const openIssues = issues.filter((i) => i.state === "open");
    const closedIssues = issues.filter((i) => i.state === "closed");

    const showOpenSection = filterState === "open" || filterState === "all";
    const showClosedSection = filterState === "closed" || filterState === "all";

    // State filter compact toggle actions rendered in the section header area
    const filterActions: { value: IssueFilterState; label: string }[] = [
      { value: "open", label: "Open" },
      { value: "closed", label: "Closed" },
      { value: "all", label: "All" },
    ];

    const stateFilterNode = (
      <div className="flex rounded border border-border-2 bg-fill-1">
        {filterActions.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setFilterState(value);
            }}
            className={`px-1.5 py-[1px] text-[10px] font-medium transition-colors first:rounded-l last:rounded-r ${
              filterState === value
                ? "bg-primary-6 text-white"
                : "text-text-3 hover:text-text-1"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    );

    // Count badge for section header (matching SectionHeader style)
    const openCountBadge = (
      <span
        className={`${COUNT_BADGE.base} ${getCountBadgeSizeClass(openIssues.length)} ${COUNT_BADGE.primary}`}
      >
        {openIssues.length}
      </span>
    );

    const closedCountBadge = (
      <span
        className={`${COUNT_BADGE.base} ${getCountBadgeSizeClass(closedIssues.length)} ${COUNT_BADGE.primary}`}
      >
        {closedIssues.length}
      </span>
    );

    // Section title with count badge embedded (mimics "STAGED CHANGES (4)" pattern)
    const openSectionTitle = (
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate">Open Issues</span>
        {openCountBadge}
      </span>
    );

    const closedSectionTitle = (
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate">Closed Issues</span>
        {closedCountBadge}
      </span>
    );

    // Refresh + state filter as section header actions
    const issuesSectionActions = [
      {
        key: "filter-state",
        customRender: stateFilterNode,
      },
      {
        key: "refresh",
        customRender: (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              refresh();
            }}
            disabled={loading}
            className={HEADER_BUTTON.actionDisabled}
            title={t("actions.refresh", "Refresh")}
          >
            <RefreshCw
              size={HEADER_ICON_SIZE.sm}
              strokeWidth={2}
              className={loading ? "animate-spin" : undefined}
            />
          </button>
        ),
      },
    ];

    let listContent: React.ReactNode;

    if (isInitialLoading) {
      listContent = (
        <Placeholder
          variant="loading"
          placement="sidebar"
          title={t("placeholders.loadingChanges", "Loading issues…")}
          fillParentHeight
        />
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
          {showOpenSection && (
            <CollapsibleSection
              title={openSectionTitle}
              collapsed={openCollapsed}
              onCollapseChange={setOpenCollapsed}
              collapsible
              resizable={false}
              isLast={!showClosedSection}
              autoHeight={!showClosedSection}
              hideSeparator={!showClosedSection}
              actions={issuesSectionActions}
            >
              {openIssues.length === 0 ? (
                <Placeholder
                  variant="empty"
                  placement="sidebar"
                  title="No open issues"
                />
              ) : (
                openIssues.map((issue) => (
                  <IssueRow
                    key={issue.number}
                    issue={issue}
                    isSelected={false}
                    onClick={() => selectIssue(issue)}
                  />
                ))
              )}
            </CollapsibleSection>
          )}

          {showClosedSection && (
            <CollapsibleSection
              title={closedSectionTitle}
              collapsed={closedCollapsed}
              onCollapseChange={setClosedCollapsed}
              collapsible
              resizable={false}
              isLast
              autoHeight
              hideSeparator
              actions={!showOpenSection ? issuesSectionActions : []}
            >
              {closedIssues.length === 0 ? (
                <Placeholder
                  variant="empty"
                  placement="sidebar"
                  title="No closed issues"
                />
              ) : (
                closedIssues.map((issue) => (
                  <IssueRow
                    key={issue.number}
                    issue={issue}
                    isSelected={false}
                    onClick={() => selectIssue(issue)}
                  />
                ))
              )}
            </CollapsibleSection>
          )}
        </div>
      );
    }

    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        {/* Filter input — mirrors "Filter changes…" in SourceControlContent */}
        <div className={`flex-shrink-0 px-3 pb-2 pt-2 ${surfaceBgClass}`}>
          <Input
            prefix={<FilterIcon size={14} strokeWidth={1.75} />}
            placeholder={t("git.issues.searchPlaceholder", "Filter issues…")}
            value={searchQuery}
            onChange={(val) => setSearchQuery(val)}
            size="small"
            className="input-pane-surface"
          />
        </div>

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
