/**
 * IssuesContent
 *
 * GitHub Issues panel for the workstation primary sidebar.
 * Interaction patterns aligned with SourceControlContent:
 * - "Filter issues…" input (same style as "Filter changes…")
 * - Refresh and filter controls in the regular section header actions
 * - The outer CollapsibleSection header ("ISSUES") is provided by the sidebar module
 */
import { useSetAtom } from "jotai";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import type { GitHubIssue } from "@src/api/tauri/github";
import { TreeRowBase, type TreeRowNode } from "@src/components/TreeRow";
import { buildIntegrationsPath } from "@src/config/mainAppPaths/integrations";
import { SectionFilterInput } from "@src/modules/WorkStation/CodeEditor/Panels/EditorPrimarySidebar/components/SectionFilterInput";
import {
  COUNT_BADGE,
  getCountBadgeSizeClass,
} from "@src/modules/WorkStation/shared/tokens";
import { Placeholder } from "@src/modules/shared/layouts/blocks";
import { workstationIssueCallbackAtom } from "@src/store/workstation/codeEditor/workstationIssueAtom";
import type { SourceControlHistorySelection } from "@src/store/workstation/tabs";

import { useWorkstationIssues } from "../../hooks/useWorkstationIssues";
import { IssueRow } from "./IssueRow";
import { NewIssueForm } from "./NewIssueForm";

export interface IssuesContentProps {
  repoPath: string;
  repoId?: string;
  branchName?: string;
  remoteUrl?: string;
  onOpenNewIssueForm?: () => void;
  onHistorySelectionChange?: (selection: SourceControlHistorySelection) => void;
  /** Whether the filter input row is currently open */
  showFilter?: boolean;
  /** Active filter query (synced with external useSectionFilter) */
  filterQuery?: string;
  /** Called when filter query changes */
  onFilterQueryChange?: (q: string) => void;
  /** Called when the filter input should close (Escape pressed) */
  onFilterClose?: () => void;
}

const IssuesContent: React.FC<IssuesContentProps> = memo(
  ({
    repoPath,
    repoId,
    branchName,
    remoteUrl,
    onHistorySelectionChange,
    showFilter = false,
    filterQuery = "",
    onFilterQueryChange,
    onFilterClose,
  }) => {
    const { t } = useTranslation("common");
    const navigate = useNavigate();
    const setCallbackAtom = useSetAtom(workstationIssueCallbackAtom);

    const {
      openIssues,
      closedIssues,
      openLoadState,
      closedLoadState,
      openError,
      closedError,
      fetchClosed,
      loading,
      remoteUrlLoading,
      needsReAuth,
      error,
      setSearchQuery,
      selectIssue,
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
    // Closed section: collapsed by default; first expand triggers fetch
    const [closedCollapsed, setClosedCollapsed] = useState(true);
    const listRef = useRef<HTMLDivElement>(null);

    // Keep internal debounced search in sync with the externally controlled query
    useEffect(() => {
      setSearchQuery(filterQuery);
    }, [filterQuery, setSearchQuery]);

    const handleOpenNewIssueForm = useCallback(() => {
      setShowNewIssueForm(true);
    }, []);

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
            onHistorySelectionChange?.({
              type: "issue",
              issueNumber: created.number,
              issueTitle: created.title,
              issueUrl: created.html_url,
            });
          }
        } finally {
          setCreatingIssue(false);
        }
      },
      [handleCreateIssue, selectIssue, onHistorySelectionChange]
    );

    // Register callbacks so PinnedActionsBar, agents, and the github-issue-detail
    // tab renderer can trigger issue actions without coupling to this component.
    useEffect(() => {
      setCallbackAtom({
        openNewIssueForm: handleOpenNewIssueForm,
        closeIssue: handleCloseIssue,
        reopenIssue: handleReopenIssue,
        addComment: (number, body) => handleAddComment(number, body),
        refreshIssues: refresh,
      });
      return () => {
        setCallbackAtom({
          openNewIssueForm: null,
          closeIssue: null,
          reopenIssue: null,
          addComment: null,
          refreshIssues: null,
        });
      };
    }, [
      setCallbackAtom,
      handleOpenNewIssueForm,
      handleCloseIssue,
      handleReopenIssue,
      handleAddComment,
      refresh,
    ]);

    const isInitialLoading =
      remoteUrlLoading ||
      (loading && openIssues.length === 0 && openLoadState !== "ready");

    const handleToggleClosed = useCallback(() => {
      setClosedCollapsed((prev) => {
        const nowExpanded = prev; // true → expanding
        if (nowExpanded && closedLoadState === "idle") {
          void fetchClosed();
        }
        return !prev;
      });
    }, [closedLoadState, fetchClosed]);

    const openSectionNode: TreeRowNode = {
      id: "open-issues",
      name: "Open",
      path: "open-issues",
      type: "directory",
      expanded: !openCollapsed,
      icon: (
        <div className="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center">
          {openCollapsed ? (
            <ChevronRight size={14} className="text-text-3" />
          ) : (
            <ChevronDown size={14} className="text-text-3" />
          )}
        </div>
      ),
    };

    const closedSectionNode: TreeRowNode = {
      id: "closed-issues",
      name: "Closed",
      path: "closed-issues",
      type: "directory",
      expanded: !closedCollapsed,
      icon: (
        <div className="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center">
          {closedCollapsed ? (
            <ChevronRight size={14} className="text-text-3" />
          ) : (
            <ChevronDown size={14} className="text-text-3" />
          )}
        </div>
      ),
    };

    const handleOpenIssue = useCallback(
      (issue: GitHubIssue) => {
        selectIssue(issue);
        onHistorySelectionChange?.({
          type: "issue",
          issueNumber: issue.number,
          issueTitle: issue.title,
          issueUrl: issue.html_url,
        });
      },
      [onHistorySelectionChange, selectIssue]
    );

    const renderSectionHeader = (
      node: TreeRowNode,
      count: number | null,
      onToggle: () => void
    ) => (
      <TreeRowBase
        node={node}
        depth={0}
        onClick={onToggle}
        showIndentGuides={false}
        className="[&_.min-w-0]:text-[11px] [&_.min-w-0]:font-medium [&_.min-w-0]:uppercase [&_.min-w-0]:text-text-2"
      >
        {count !== null && (
          <span
            className={`${COUNT_BADGE.base} ${getCountBadgeSizeClass(count)} ${COUNT_BADGE.primary}`}
          >
            {count}
          </span>
        )}
      </TreeRowBase>
    );

    // ── Render ────────────────────────────────────────────────────────────────

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
    } else if (needsReAuth) {
      listContent = (
        <Placeholder
          variant="error"
          placement="sidebar"
          title={t(
            "git.issues.reAuthRequired",
            "GitHub Authorization Required"
          )}
          subtitle={t(
            "git.issues.reAuthDescription",
            "Your GitHub token has expired. Go to Settings → Integrations → Git to reconnect."
          )}
          action={{
            label: t("git.issues.goToSettings", "Go to Settings"),
            onClick: () => navigate(buildIntegrationsPath({ category: "git" })),
          }}
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
    } else {
      listContent = (
        <div ref={listRef} className="flex flex-1 flex-col overflow-y-auto">
          {/* Open section */}
          {renderSectionHeader(openSectionNode, openIssues.length, () =>
            setOpenCollapsed((prev) => !prev)
          )}
          {!openCollapsed &&
            (openLoadState === "error" ? (
              <p className="text-text-error px-3 py-2 text-[11px]">
                {openError ?? t("git.issues.failedToLoad", "Failed to load")}
              </p>
            ) : openIssues.length === 0 ? (
              <p className="px-3 py-2 text-[11px] text-text-3">
                {t("labels.noIssues", "No issues")}
              </p>
            ) : (
              openIssues.map((issue) => (
                <IssueRow
                  key={issue.number}
                  issue={issue}
                  depth={1}
                  isSelected={false}
                  onClick={() => handleOpenIssue(issue)}
                />
              ))
            ))}

          {/* Closed section — lazy loaded on first expand */}
          {renderSectionHeader(
            closedSectionNode,
            closedLoadState === "ready" ? closedIssues.length : null,
            handleToggleClosed
          )}
          {!closedCollapsed &&
            (closedLoadState === "loading" ? (
              <div className="flex items-center gap-1.5 px-3 py-2">
                <Loader2 size={12} className="animate-spin text-text-3" />
                <span className="text-[11px] text-text-3">
                  {t("actions.loading", "Loading…")}
                </span>
              </div>
            ) : closedLoadState === "error" ? (
              <p className="text-text-error px-3 py-2 text-[11px]">
                {closedError ?? t("git.issues.failedToLoad", "Failed to load")}
              </p>
            ) : closedLoadState === "ready" && closedIssues.length === 0 ? (
              <p className="px-3 py-2 text-[11px] text-text-3">
                {t("labels.noIssues", "No issues")}
              </p>
            ) : (
              closedIssues.map((issue) => (
                <IssueRow
                  key={issue.number}
                  issue={issue}
                  depth={1}
                  isSelected={false}
                  onClick={() => handleOpenIssue(issue)}
                />
              ))
            ))}
        </div>
      );
    }

    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        {showFilter && (
          <SectionFilterInput
            query={filterQuery}
            onChange={(q) => onFilterQueryChange?.(q)}
            onClose={() => onFilterClose?.()}
            placeholder={t("git.issues.searchPlaceholder", "Filter issues…")}
          />
        )}

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
