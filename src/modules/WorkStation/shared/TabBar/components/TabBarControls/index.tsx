import React from "react";
import { useTranslation } from "react-i18next";

import { TabBarTrailingIconButton } from "@src/components/TabPill/TabBarTrailingIconButton";
import { HeaderActionGroup } from "@src/components/WindowChrome/HeaderActionGroup";
import {
  HEADER_ICON_SIZE,
  TAB_BAR_CONTROLS_ROW_PADDING_FULL,
} from "@src/config/workstation/tokens";
import { Add01Icon, HugeiconsIcon, MoreHorizontalIcon } from "@src/icons";

interface TabBarControlsProps {
  hasTabs: boolean;
  onNewTab?: () => void;
  onNewTabShortcutId?: string;
  onMoreOptions?: () => void;
  trailingSlot?: React.ReactNode;
}

/**
 * Right-aligned control buttons for the tab bar:
 * new tab, more options, and trailing slot.
 */
export const TabBarControls: React.FC<TabBarControlsProps> = ({
  hasTabs,
  onNewTab,
  onNewTabShortcutId,
  onMoreOptions,
  trailingSlot,
}) => {
  const { t } = useTranslation();

  const hasBuiltInControls = Boolean(onNewTab || (hasTabs && onMoreOptions));

  if (!hasTabs && !trailingSlot && !hasBuiltInControls) return null;
  return (
    <HeaderActionGroup className={TAB_BAR_CONTROLS_ROW_PADDING_FULL}>
      {onNewTab && (
        <TabBarTrailingIconButton
          data-action="browser.newTab"
          title={t("common:commands.newTab")}
          shortcutId={onNewTabShortcutId}
          onClick={onNewTab}
        >
          <HugeiconsIcon
            icon={Add01Icon}
            data-icon="plus"
            size={18}
            strokeWidth={2}
          />
        </TabBarTrailingIconButton>
      )}

      {hasTabs && onMoreOptions && (
        <TabBarTrailingIconButton
          data-action="editor.moreOptions"
          title={t("tooltips.moreOptions")}
          onClick={onMoreOptions}
        >
          <HugeiconsIcon
            icon={MoreHorizontalIcon}
            data-icon="ellipsis"
            size={HEADER_ICON_SIZE.md}
            strokeWidth={1.75}
          />
        </TabBarTrailingIconButton>
      )}

      {trailingSlot}
    </HeaderActionGroup>
  );
};
