/**
 * SourceControlStickyHeader
 *
 * Renders the sticky scroll header rows used by VirtualizedStickyTree inside
 * SourceControlContent. Handles two distinct node types:
 *
 *  - "section-header": top-level section row (Merge Changes / Staged / Changes)
 *    with a count badge and optional warning colour.
 *  - "directory" / file: collapsed/expanded folder row (same sticky behaviour,
 *    different icon and badge).
 *
 * Extracted from SourceControlContent to keep that component under the
 * line limit.
 */
import { useAtomValue } from "jotai";
import React from "react";
import { useTranslation } from "react-i18next";

import FileTypeIcon from "@src/components/FileTypeIcon";
import { GitStatusBadge, type GitStatusInfo } from "@src/components/TreeRow";
import type { StickyScrollNode } from "@src/components/VirtualizedStickyTree";
import { StickyTreeRow } from "@src/components/VirtualizedStickyTree/StickyTreeRow";
import { getStatusColorForFile } from "@src/config/gitStatus";
import {
  COUNT_BADGE,
  getCountBadgeSizeClass,
} from "@src/config/workstation/tokens";
import { gitSourceControlColorFileNamesAtom } from "@src/store/ui/editorSettingsAtom";

import type { SourceControlNode } from "../utils/virtualizedTreeUtils";

interface SourceControlStickyHeaderProps {
  stickyNode: StickyScrollNode<SourceControlNode>;
  onClick: () => void;
  stickyBgClass?: string;
}

export const SourceControlStickyHeader: React.FC<
  SourceControlStickyHeaderProps
> = ({ stickyNode, onClick, stickyBgClass }) => {
  const { t } = useTranslation();
  const colorFileNames = useAtomValue(gitSourceControlColorFileNamesAtom);
  const { node, depth } = stickyNode;

  if (node.nodeType === "section-header") {
    const isWarning = node.variant === "warning";
    const sectionCount = node.count ?? 0;
    const countBadgeVariant = isWarning
      ? COUNT_BADGE.danger
      : sectionCount === 0
        ? COUNT_BADGE.muted
        : COUNT_BADGE.primary;
    return (
      <StickyTreeRow
        depth={depth}
        expanded={Boolean(node.expanded)}
        name={node.name}
        onClick={onClick}
        stickyBgClass={stickyBgClass}
        nameClassName="min-w-0 flex-1 truncate text-[11px] font-medium text-text-2 uppercase"
      >
        <span
          className={`${COUNT_BADGE.base} ${getCountBadgeSizeClass(sectionCount)} ${countBadgeVariant}`}
        >
          {sectionCount}
        </span>
      </StickyTreeRow>
    );
  }

  const isDirectory = node.nodeType === "directory";
  const gitStatus: GitStatusInfo | null =
    isDirectory && node.treeNode?.aggregateStatus
      ? { status: node.treeNode.aggregateStatus, staged: false }
      : node.file
        ? { status: node.file.status, staged: node.file.staged }
        : null;

  return (
    <StickyTreeRow
      depth={depth}
      expanded={Boolean(node.expanded)}
      name={node.name}
      onClick={onClick}
      stickyBgClass={stickyBgClass}
      title={t("tooltips.scrollToItem", { name: node.name })}
      nameClassName={
        !isDirectory && colorFileNames && gitStatus
          ? `min-w-0 flex-1 truncate text-[13px] ${getStatusColorForFile(gitStatus.status, gitStatus.staged)}`
          : undefined
      }
      icon={
        !isDirectory && (
          <FileTypeIcon
            fileName={node.name}
            size="small"
            className="shrink-0 text-text-2"
          />
        )
      }
    >
      <GitStatusBadge status={gitStatus} isDirectory={isDirectory} />
    </StickyTreeRow>
  );
};
