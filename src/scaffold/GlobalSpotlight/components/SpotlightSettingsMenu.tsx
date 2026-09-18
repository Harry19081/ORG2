/**
 * SpotlightSettingsMenu
 *
 * "…" button at the end of the keyboard-hint pill. Opens a small menu with
 * Spotlight's own view preferences — placement, background dim — and a
 * "Unpin all" action that clears both pin lists (commands + directories).
 *
 * The menu portals to <body> at DROPDOWN_PANEL.zIndex, which sits above the
 * Spotlight container. ActionMenuSurface owns Escape (capture phase), so
 * Escape closes this menu without also closing Spotlight.
 */
import { useAtom } from "jotai";
import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import Button from "@src/components/Button";
import { ActionMenuSurface } from "@src/components/Dropdown/ActionMenuSurface";
import DropdownActionItem from "@src/components/Dropdown/DropdownActionItem";
import {
  DROPDOWN_CLASSES,
  DROPDOWN_ITEM,
  DROPDOWN_PANEL,
  DROPDOWN_WIDTHS,
} from "@src/components/Dropdown/tokens";
import SegmentedTextPill from "@src/components/SegmentedTextPill";
import Switch from "@src/components/Switch";
import { useDropdownEngine } from "@src/hooks/dropdown";
import { useSetting } from "@src/hooks/settings/useSettings";
import { EllipsisIcon, HugeiconsIcon, PinOffIcon } from "@src/icons";
import {
  spotlightCommandPinsAtom,
  spotlightDirectoryPinsAtom,
} from "@src/store/ui/spotlightPinsAtom";
import {
  type SpotlightPlacement,
  spotlightPlacementAtom,
} from "@src/store/ui/uiAtom";

export const SpotlightSettingsMenu: React.FC = () => {
  const { t } = useTranslation();
  const { t: tSettings } = useTranslation("settings");
  const [open, setOpen] = useState(false);
  const { isPositioned, triggerRef, panelRef, panelPosition, toggle, close } =
    useDropdownEngine<HTMLSpanElement>({
      open,
      onOpenChange: setOpen,
      placement: "auto",
      align: "right",
      autoKeyboardNavigation: false,
      closeOnEsc: false,
    });

  const [placement, setPlacement] = useAtom(spotlightPlacementAtom);
  const [dimBackground, setDimBackground] = useSetting(
    "general.spotlightDimBackground"
  );
  const [commandPins, setCommandPins] = useAtom(spotlightCommandPinsAtom);
  const [directoryPins, setDirectoryPins] = useAtom(spotlightDirectoryPinsAtom);
  const hasPins = commandPins.length > 0 || directoryPins.length > 0;

  const label = t("selectors.spotlightFooter.settings");
  const placementLabel = tSettings("general.spotlightPlacement");
  const dimLabel = tSettings("general.spotlightDimBackground");

  const handleUnpinAll = () => {
    setCommandPins([]);
    setDirectoryPins([]);
    close();
  };

  return (
    // Clicks must not reach the footer's refocus-input handler, which would
    // pull focus out of the open menu.
    <span
      className="flex items-center gap-2"
      onClick={(event) => event.stopPropagation()}
    >
      <span aria-hidden className="h-3 w-px shrink-0 bg-border-2" />
      <span ref={triggerRef} className="-my-1.5 -mr-3 inline-flex">
        <Button
          variant="tertiary"
          appearance="soft-no-drop"
          size="small"
          shape="round"
          iconOnly
          icon={
            <HugeiconsIcon icon={EllipsisIcon} data-icon="ellipsis" size={14} />
          }
          htmlType="button"
          onClick={toggle}
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={open}
          title={label}
          className={`shrink-0 hover:bg-fill-2 hover:text-text-1 ${
            open ? "bg-fill-2 text-text-1" : ""
          }`}
          data-testid="spotlight-settings-button"
        />
      </span>
      {open &&
        isPositioned &&
        createPortal(
          <ActionMenuSurface
            panelRef={panelRef}
            onClose={close}
            aria-label={label}
            data-testid="spotlight-settings-menu"
            className={`${DROPDOWN_CLASSES.menuPanelBase} ${DROPDOWN_WIDTHS.panelWidthClass}`}
            style={{
              position: "fixed",
              top: panelPosition.top,
              bottom: panelPosition.bottom,
              right: panelPosition.right,
              maxHeight: panelPosition.maxHeight,
              overflowY: "auto",
              zIndex: DROPDOWN_PANEL.zIndex,
            }}
          >
            <div className={DROPDOWN_CLASSES.menuControlItem}>
              <span className="min-w-0 flex-1 truncate">{placementLabel}</span>
              <SegmentedTextPill<SpotlightPlacement>
                ariaLabel={placementLabel}
                size="small"
                value={placement}
                options={[
                  {
                    value: "top",
                    label: tSettings("general.spotlightPlacementOptions.top"),
                  },
                  {
                    value: "center",
                    label: tSettings(
                      "general.spotlightPlacementOptions.center"
                    ),
                  },
                ]}
                onChange={setPlacement}
              />
            </div>
            <div className={DROPDOWN_CLASSES.menuControlItem}>
              <span className="min-w-0 flex-1 truncate">{dimLabel}</span>
              <Switch
                size="small"
                ariaLabel={dimLabel}
                checked={dimBackground}
                onCheckedChange={setDimBackground}
              />
            </div>
            <div className={DROPDOWN_CLASSES.menuGroupSeparator} />
            <DropdownActionItem
              icon={
                <HugeiconsIcon
                  icon={PinOffIcon}
                  data-icon="pin-off"
                  size={DROPDOWN_ITEM.iconSize}
                />
              }
              disabled={!hasPins}
              onClick={handleUnpinAll}
            >
              {t("selectors.spotlightFooter.unpinAll")}
            </DropdownActionItem>
          </ActionMenuSurface>,
          document.body
        )}
    </span>
  );
};

export default SpotlightSettingsMenu;
