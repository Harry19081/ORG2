/**
 * FileHeaderSidebarSettingsSubmenu
 *
 * "Sidebar settings" flyout in the file header's more menu: WorkStation
 * primary-sidebar visibility, left/right location, tree indent lines, and
 * Source Control file-name colors.
 * Mounted only while the menu is open, so its atom subscriptions are too.
 */
import { useAtom } from "jotai";
import React from "react";
import { useTranslation } from "react-i18next";

import { ActionSubmenu } from "@src/components/Dropdown/ActionMenuSurface";
import {
  DROPDOWN_CLASSES,
  DROPDOWN_ITEM,
} from "@src/components/Dropdown/tokens";
import SegmentedTextPill from "@src/components/SegmentedTextPill";
import Switch from "@src/components/Switch";
import { usePrimarySidebarState } from "@src/hooks/tabHost/useWorkStationPanels";
import { HugeiconsIcon, SidebarLeftIcon, SidebarRightIcon } from "@src/icons";
import {
  editorShowTreeIndentGuidesAtom,
  gitSourceControlColorFileNamesAtom,
} from "@src/store/ui/editorSettingsAtom";
import type { LayoutMode } from "@src/store/ui/workStationLayout/splitLayoutAtoms";

function SwitchRow({
  label,
  checked,
  onChange,
  dataTestId,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  dataTestId: string;
}) {
  return (
    <div className={DROPDOWN_CLASSES.menuControlItem}>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        size="small"
        ariaLabel={label}
        dataTestId={dataTestId}
      />
    </div>
  );
}

export function FileHeaderSidebarSettingsSubmenu() {
  const { t } = useTranslation("common");
  const {
    layoutMode,
    setLayoutMode,
    primarySidebarCollapsed,
    setPrimarySidebarCollapsed,
  } = usePrimarySidebarState();
  const [indentLinesEnabled, setIndentLinesEnabled] = useAtom(
    editorShowTreeIndentGuidesAtom
  );
  const [colorFileNames, setColorFileNames] = useAtom(
    gitSourceControlColorFileNamesAtom
  );
  const handleColorFileNamesChange = React.useCallback(
    (value: boolean) => {
      setColorFileNames(value).catch(() => undefined);
    },
    [setColorFileNames]
  );
  const locationLabel = t("sidebarSettings.location");

  return (
    <ActionSubmenu
      label={t("sidebarSettings.title")}
      icon={
        <HugeiconsIcon
          icon={layoutMode === "right" ? SidebarRightIcon : SidebarLeftIcon}
          size={DROPDOWN_ITEM.iconSize}
          strokeWidth={1.75}
        />
      }
      dataTestId="file-header-sidebar-settings-submenu"
    >
      <SwitchRow
        label={t("sidebarSettings.showSidebar")}
        checked={!primarySidebarCollapsed}
        onChange={(visible) => setPrimarySidebarCollapsed(!visible)}
        dataTestId="file-header-sidebar-visible-toggle"
      />
      <div className={DROPDOWN_CLASSES.menuControlItem}>
        <span className="min-w-0 flex-1 truncate">{locationLabel}</span>
        <SegmentedTextPill<LayoutMode>
          size="small"
          ariaLabel={locationLabel}
          dataTestId="file-header-sidebar-location"
          value={layoutMode}
          options={[
            { value: "left", label: t("layoutSettings.left") },
            { value: "right", label: t("layoutSettings.right") },
          ]}
          onChange={setLayoutMode}
        />
      </div>
      <div
        role="separator"
        aria-hidden
        className={DROPDOWN_CLASSES.menuGroupSeparator}
        data-testid="file-header-sidebar-indent-lines-separator"
      />
      <SwitchRow
        label={t("sidebarSettings.showIndentLines")}
        checked={indentLinesEnabled}
        onChange={setIndentLinesEnabled}
        dataTestId="file-header-sidebar-indent-lines-toggle"
      />
      <SwitchRow
        label={t("sidebarSettings.colorSourceControlFiles")}
        checked={colorFileNames}
        onChange={handleColorFileNamesChange}
        dataTestId="file-header-sidebar-diff-colors-toggle"
      />
    </ActionSubmenu>
  );
}
