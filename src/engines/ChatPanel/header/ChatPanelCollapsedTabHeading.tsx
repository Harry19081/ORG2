import { useAtomValue } from "jotai";
import React, { memo } from "react";

import {
  DeliveryBox01Icon,
  GaugeIcon,
  HugeiconsIcon,
  InboxIcon,
  KanbanIcon,
  ListTodoIcon,
  MessageAdd02Icon,
  PencilEdit02Icon,
  Settings02Icon,
} from "@src/icons";
import { type ChatPanelTab } from "@src/store/chatPanel/chatPanelTabsModel";
import { activeChatPanelTabAtom } from "@src/store/chatPanel/chatPanelTabsState";
import {
  CHAT_PANEL_CREATE_TARGET,
  chatPanelCreateTargetAtom,
} from "@src/store/ui/chatPanel/selectionAtoms";
import { WORK_MANAGEMENT_SECTION } from "@src/store/workstation";

import { useChatPanelTabDisplayTitle } from "../hooks/useChatPanelTabDisplayTitle";

const CollapsedTabHeadingLabel: React.FC<{ tab: ChatPanelTab }> = ({ tab }) => {
  const title = useChatPanelTabDisplayTitle(tab);
  const createTarget = useAtomValue(chatPanelCreateTargetAtom);
  const icon =
    tab.type === "start-page"
      ? createTarget === CHAT_PANEL_CREATE_TARGET.PROJECT
        ? DeliveryBox01Icon
        : createTarget === CHAT_PANEL_CREATE_TARGET.WORK_ITEM
          ? PencilEdit02Icon
          : MessageAdd02Icon
      : tab.type === "runtime"
        ? GaugeIcon
        : tab.type === "team-inbox"
          ? InboxIcon
          : tab.type === "work-management"
            ? tab.managementSection === WORK_MANAGEMENT_SECTION.KANBAN
              ? KanbanIcon
              : ListTodoIcon
            : tab.type === "organization"
              ? Settings02Icon
              : undefined;

  return (
    <span className="flex min-w-0 items-center gap-2 px-1 text-[13px] font-medium text-text-1">
      {icon && (
        <HugeiconsIcon
          icon={icon}
          size={16}
          strokeWidth={1.75}
          className="shrink-0"
          aria-hidden="true"
        />
      )}
      <span className="truncate">{title}</span>
    </span>
  );
};

/**
 * Names the lone surface in the collapsed 36px header.
 *
 * Only surfaces that publish no header content of their own reach this: with
 * the tab row folded away, a terminal or Launchpad tab would otherwise sit
 * under an unlabeled bar. The label is the pill's, so folding the row never
 * renames the surface.
 */
export const ChatPanelCollapsedTabHeading: React.FC = memo(() => {
  const activeTab = useAtomValue(activeChatPanelTabAtom);
  if (!activeTab) return null;
  return <CollapsedTabHeadingLabel tab={activeTab} />;
});

ChatPanelCollapsedTabHeading.displayName = "ChatPanelCollapsedTabHeading";
