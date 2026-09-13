/**
 * WorkstationItemRow — one actionable rail row (open tab, terminal session,
 * Review, PR link, …) with its optional diff stats, CI status and close button.
 */
import type React from "react";

import AnyIcon from "@src/components/AnyIcon";
import Button from "@src/components/Button";
import DiffStatsBadge from "@src/components/DiffStatsBadge";
import FileTypeIcon from "@src/components/FileTypeIcon";
import { KeyboardShortcutTooltipContent } from "@src/components/KeyboardShortcut";
import Tooltip from "@src/components/Tooltip";
import { useWorkingTreeDiffTotals } from "@src/hooks/git/useWorkingTreeDiffTotals";
import {
  ArrowRight01Icon,
  ArrowUpRight01Icon,
  Cancel01Icon,
  HugeiconsIcon,
  StopIcon,
} from "@src/icons";

import {
  WORKSTATION_TRAIL_ROW,
  WORKSTATION_TRAIL_ROW_HOVER_CLASS,
} from "../blocks/workstationTrailTokens";
import { RailItemStatus } from "./RailItemStatus";
import type { FocusedChatRailItem } from "./types";

export function WorkstationItemRow({
  compact = false,
  item,
  onRequestClose,
}: {
  compact?: boolean;
  item: FocusedChatRailItem;
  onRequestClose?: () => void;
}) {
  const liveDiffTotals = useWorkingTreeDiffTotals(
    item.workingTreeRepo?.repoId,
    item.workingTreeRepo?.repoPath
  );
  const additions = item.workingTreeRepo
    ? liveDiffTotals.additions
    : item.additions;
  const deletions = item.workingTreeRepo
    ? liveDiffTotals.deletions
    : item.deletions;

  const runAction = (event: React.MouseEvent<HTMLButtonElement>) => {
    // A submenu trigger keeps its host menu open; the popup it anchors is
    // part of that menu, not a destination.
    if (!item.submenu) onRequestClose?.();
    item.onClick?.(event);
  };

  const action = (
    <Button
      htmlType="button"
      variant="tertiary"
      appearance="soft-no-drop"
      size={compact ? "small" : "sidebar"}
      className={`${WORKSTATION_TRAIL_ROW.button} h-full! ${compact ? WORKSTATION_TRAIL_ROW.compact : WORKSTATION_TRAIL_ROW.wide} ${item.onClick ? "" : "cursor-default"}`}
      onClick={runAction}
      disabled={!item.onClick}
      role={compact ? "menuitem" : undefined}
      aria-haspopup={item.submenu ? "menu" : undefined}
    >
      <span
        className={`${WORKSTATION_TRAIL_ROW.content} ${compact ? WORKSTATION_TRAIL_ROW.compactContent : WORKSTATION_TRAIL_ROW.wideContent}`}
      >
        <span className={WORKSTATION_TRAIL_ROW.icon}>
          {item.fileName ? (
            <FileTypeIcon
              fileName={item.fileName}
              size="small"
              className="size-3.5"
            />
          ) : (
            <AnyIcon
              icon={item.icon}
              size={WORKSTATION_TRAIL_ROW.iconSize}
              strokeWidth={1.75}
            />
          )}
        </span>
        <span className={WORKSTATION_TRAIL_ROW.label}>{item.label}</span>
        {(additions ?? 0) > 0 || (deletions ?? 0) > 0 ? (
          <DiffStatsBadge
            additions={additions}
            deletions={deletions}
            variant="plain"
            size="sm"
            reserveValueWidth={false}
            valueClassName="font-normal"
            className="shrink-0"
          />
        ) : null}
        {item.status ? <RailItemStatus status={item.status} /> : null}
        {item.external ? (
          <HugeiconsIcon
            icon={ArrowUpRight01Icon}
            data-icon="arrow-up-right"
            aria-hidden
            className="shrink-0 text-text-1"
            size={14}
            strokeWidth={1.75}
          />
        ) : null}
        {item.submenu ? (
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            data-icon="chevron-right"
            aria-hidden
            className="shrink-0 text-text-1"
            size={14}
            strokeWidth={1.75}
          />
        ) : null}
      </span>
    </Button>
  );

  return (
    <div
      className={`group ${WORKSTATION_TRAIL_ROW.shell} ${compact ? WORKSTATION_TRAIL_ROW.compact : WORKSTATION_TRAIL_ROW.wide} ${WORKSTATION_TRAIL_ROW_HOVER_CLASS}`}
    >
      {item.shortcut ? (
        <Tooltip
          content={
            <KeyboardShortcutTooltipContent
              label={item.label}
              shortcut={item.shortcut}
            />
          }
          position="left"
          framedPanel
          mouseEnterDelay={200}
          smartPlacement
        >
          {action}
        </Tooltip>
      ) : (
        action
      )}
      {item.onStop ? (
        <Button
          variant="tertiary"
          appearance="soft-no-drop"
          iconOnly
          icon={<HugeiconsIcon icon={StopIcon} data-icon="stop" size={14} />}
          size="sidebar"
          aria-label={item.stopLabel ?? item.label}
          title={item.stopLabel ?? item.label}
          className={`opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 ${compact ? "ml-0.5" : "mr-1"}`}
          onClick={(event) => {
            event.stopPropagation();
            item.onStop?.();
          }}
          role={compact ? "menuitem" : undefined}
        />
      ) : item.onClose ? (
        <Button
          size="sidebar"
          variant="tertiary"
          className={`shrink-0 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 ${
            compact ? "ml-0.5" : "mr-1"
          }`}
          onClick={(event) => {
            event.stopPropagation();
            item.onClose?.();
          }}
          aria-label={item.closeLabel}
          role={compact ? "menuitem" : undefined}
          appearance="soft-no-drop"
          iconOnly
          icon={<HugeiconsIcon icon={Cancel01Icon} data-icon="x" size={12} />}
        />
      ) : null}
    </div>
  );
}
