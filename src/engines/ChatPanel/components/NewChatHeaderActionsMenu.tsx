import { useAtom, useAtomValue, useSetAtom } from "jotai";
import React from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import Button from "@src/components/Button";
import {
  ActionMenuSurface,
  ActionSubmenu,
} from "@src/components/Dropdown/ActionMenuSurface";
import {
  DROPDOWN_CLASSES,
  DROPDOWN_ITEM,
  DROPDOWN_PANEL,
  DROPDOWN_WIDTHS,
} from "@src/components/Dropdown/tokens";
import SegmentedTextPill from "@src/components/SegmentedTextPill";
import SendOnEnterPill from "@src/components/SendOnEnterPill";
import Switch from "@src/components/Switch";
import { CREATOR_COMPOSER_POSITION } from "@src/config/sessionCreatorConfig";
import { HEADER_ICON_SIZE } from "@src/config/workstation/tokens";
import { getDropdownPanelStyle, useDropdownEngine } from "@src/hooks/dropdown";
import {
  HugeiconsIcon,
  InputCursorTextIcon,
  Layers01Icon,
  MoreHorizontalIcon,
} from "@src/icons";
import { chatSendOnEnterAtom } from "@src/store/config/configAtom";
import { cliUpdateAlertsEnabledAtom } from "@src/store/session/cliUpdateAlertsAtom";
import { creatorComposerPositionAtom } from "@src/store/session/creatorComposerPositionAtom";
import { creatorLaunchpadActionsVisibleAtom } from "@src/store/session/creatorLaunchpadActionsVisibleAtom";
import {
  changeCreatorComposerPositionAtom,
  creatorRepoChromePositionAtom,
} from "@src/store/session/creatorRepoChromePositionAtom";
import { pinnedActionsVisibleAtom } from "@src/store/session/pinnedActionsVisibleAtom";

export function NewChatHeaderActionsMenu(): React.ReactNode {
  const { t } = useTranslation(["sessions", "common"]);
  const [cliUpdateAlertsEnabled, setCliUpdateAlertsEnabled] = useAtom(
    cliUpdateAlertsEnabledAtom
  );
  const composerPosition = useAtomValue(creatorComposerPositionAtom);
  const setComposerPosition = useSetAtom(changeCreatorComposerPositionAtom);
  const [repoBarPosition, setRepoBarPosition] = useAtom(
    creatorRepoChromePositionAtom
  );
  const [launchpadActionsVisible, setLaunchpadActionsVisible] = useAtom(
    creatorLaunchpadActionsVisibleAtom
  );
  const [pinnedActionsVisible, setPinnedActionsVisible] = useAtom(
    pinnedActionsVisibleAtom
  );
  const [sendOnEnter, setSendOnEnter] = useAtom(chatSendOnEnterAtom);
  const {
    isOpen,
    isPositioned,
    toggle,
    close,
    triggerRef,
    panelRef,
    panelPosition,
  } = useDropdownEngine<HTMLButtonElement>({
    align: "right",
    placement: "bottom",
    captureKeyboardFocus: true,
    // ActionMenuSurface owns keyboard navigation across the submenu.
    autoKeyboardNavigation: false,
    closeOnEsc: false,
  });
  const showQuickActionsLabel = t("chat.startPage.showQuickActions");
  const showSkillsLabel = t("chat.startPage.showSkills");
  const showCliUpdateLabel = t("chat.startPage.showCliUpdate");
  const sendMethodLabel = t("chat.sendMethod");

  return (
    <>
      <Button
        ref={triggerRef}
        htmlType="button"
        variant="tertiary"
        size="small"
        iconOnly
        className={isOpen ? "bg-fill-1! text-primary-6!" : ""}
        onClick={(event) => {
          event.stopPropagation();
          toggle();
        }}
        aria-label={t("common:actions.more")}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        data-testid="new-chat-header-more-button"
        icon={
          <HugeiconsIcon
            icon={MoreHorizontalIcon}
            data-icon="ellipsis"
            size={HEADER_ICON_SIZE.sm}
            strokeWidth={2}
          />
        }
      />
      {isOpen &&
        isPositioned &&
        createPortal(
          <ActionMenuSurface
            panelRef={panelRef}
            onClose={close}
            className={`${DROPDOWN_CLASSES.menuPanelBase} ${DROPDOWN_WIDTHS.sidebarMenuClass}`}
            style={{
              ...getDropdownPanelStyle(panelPosition, { widthMode: "none" }),
              position: "fixed",
              zIndex: DROPDOWN_PANEL.zIndex,
            }}
          >
            <ActionSubmenu
              label={t("common:common.display")}
              icon={
                <HugeiconsIcon
                  icon={Layers01Icon}
                  size={DROPDOWN_ITEM.iconSize}
                  strokeWidth={1.75}
                />
              }
              dataTestId="new-chat-ui-settings-submenu"
            >
              <div className={DROPDOWN_CLASSES.menuControlItem}>
                <span className="min-w-0 flex-1 truncate">
                  {t("chat.startPage.inputPosition")}
                </span>
                <SegmentedTextPill
                  size="small"
                  ariaLabel={t("chat.startPage.inputPosition")}
                  dataTestId="new-chat-composer-position"
                  value={composerPosition}
                  options={[
                    {
                      value: CREATOR_COMPOSER_POSITION.BOTTOM,
                      label: t("chat.startPage.positionBottom"),
                    },
                    {
                      value: CREATOR_COMPOSER_POSITION.MIDDLE,
                      label: t("chat.startPage.positionMiddle"),
                    },
                  ]}
                  onChange={setComposerPosition}
                />
              </div>
              <div className={DROPDOWN_CLASSES.menuControlItem}>
                <span className="min-w-0 flex-1 truncate">
                  {showQuickActionsLabel}
                </span>
                <Switch
                  checked={launchpadActionsVisible}
                  onCheckedChange={setLaunchpadActionsVisible}
                  size="small"
                  ariaLabel={showQuickActionsLabel}
                  dataTestId="new-chat-show-quick-actions-toggle"
                />
              </div>
              <div className={DROPDOWN_CLASSES.menuControlItem}>
                <span className="min-w-0 flex-1 truncate">
                  {showCliUpdateLabel}
                </span>
                <Switch
                  checked={cliUpdateAlertsEnabled}
                  onCheckedChange={setCliUpdateAlertsEnabled}
                  size="small"
                  ariaLabel={showCliUpdateLabel}
                  dataTestId="new-chat-show-cli-update-toggle"
                />
              </div>
            </ActionSubmenu>
            <ActionSubmenu
              label={t("chat.inputSettings")}
              icon={
                <HugeiconsIcon
                  icon={InputCursorTextIcon}
                  size={DROPDOWN_ITEM.iconSize}
                  strokeWidth={1.75}
                />
              }
              dataTestId="new-chat-input-settings-submenu"
            >
              <div className={DROPDOWN_CLASSES.menuControlItem}>
                <span className="min-w-0 flex-1 truncate">
                  {t("chat.startPage.repoBarPosition")}
                </span>
                <SegmentedTextPill
                  size="small"
                  ariaLabel={t("chat.startPage.repoBarPosition")}
                  dataTestId="new-chat-repo-bar-position"
                  value={repoBarPosition}
                  options={[
                    { value: "top", label: t("chat.startPage.positionUp") },
                    {
                      value: "bottom",
                      label: t("chat.startPage.positionDown"),
                    },
                  ]}
                  onChange={setRepoBarPosition}
                />
              </div>
              <div className={DROPDOWN_CLASSES.menuControlItem}>
                <span className="min-w-0 flex-1 truncate">
                  {sendMethodLabel}
                </span>
                <SendOnEnterPill
                  size="small"
                  ariaLabel={sendMethodLabel}
                  dataTestId="new-chat-send-on-enter"
                  sendOnEnter={sendOnEnter}
                  onChange={setSendOnEnter}
                />
              </div>
              <div className={DROPDOWN_CLASSES.menuControlItem}>
                <span className="min-w-0 flex-1 truncate">
                  {showSkillsLabel}
                </span>
                <Switch
                  checked={pinnedActionsVisible}
                  onCheckedChange={setPinnedActionsVisible}
                  size="small"
                  ariaLabel={showSkillsLabel}
                  dataTestId="new-chat-show-skills-toggle"
                />
              </div>
            </ActionSubmenu>
          </ActionMenuSurface>,
          document.body
        )}
    </>
  );
}
