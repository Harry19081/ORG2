import React from "react";
import { useTranslation } from "react-i18next";

import { TabBarTrailingIconButton } from "@src/components/TabPill/TabBarTrailingIconButton";
import { HeaderActionGroup } from "@src/components/WindowChrome/HeaderActionGroup";
import { TAB_BAR_CONTROLS_ROW_PADDING_FULL } from "@src/config/workstation/tokens";
import { Add01Icon, HugeiconsIcon } from "@src/icons";

interface TabBarControlsProps {
  hasTabs: boolean;
  onNewTab?: () => void;
  onNewTabShortcutId?: string;
  trailingSlot?: React.ReactNode;
}

/**
 * Right-aligned control buttons for the tab bar: new tab and trailing slot.
 */
export const TabBarControls: React.FC<TabBarControlsProps> = ({
  hasTabs,
  onNewTab,
  onNewTabShortcutId,
  trailingSlot,
}) => {
  const { t } = useTranslation();

  if (!hasTabs && !trailingSlot && !onNewTab) return null;
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

      {trailingSlot}
    </HeaderActionGroup>
  );
};
