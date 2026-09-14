import React from "react";
import { flushSync } from "react-dom";
import { useTranslation } from "react-i18next";

import Button from "@src/components/Button";
import {
  DROPDOWN_CLASSES,
  DROPDOWN_ITEM,
} from "@src/components/Dropdown/tokens";
import {
  KEYBOARD_SHORTCUT_VARIANT,
  KeyboardShortcut,
} from "@src/components/KeyboardShortcut";
import {
  ArrowRight01Icon,
  BookOpen01Icon,
  CircleIcon,
  ContrastIcon,
  GaugeIcon,
  HugeiconsIcon,
  Layout01Icon,
  Login02Icon,
  Logout02Icon,
  RocketIcon,
  Settings01Icon,
} from "@src/icons";

import type { SettingsSubmenu } from "./SidebarSettingsMenuSubmenus";

const MENU_ICON_CLASS_NAME = "shrink-0 text-text-2";
const MENU_ARROW_CLASS_NAME = "shrink-0 text-text-3";

type SetActiveSubmenu = React.Dispatch<
  React.SetStateAction<SettingsSubmenu | null>
>;

interface SidebarSettingsMenuLeadingItemsProps {
  signedIn: boolean;
  devModeEnabled: boolean;
  setActiveSubmenu: SetActiveSubmenu;
  closeAll: () => void;
  setShowWiki: React.Dispatch<React.SetStateAction<boolean>>;
  handleSignOut: () => void;
  handleViewRam: () => void;
}

/** Sign out (signed-in only), Wiki, and View RAM (dev mode only). */
export function SidebarSettingsMenuLeadingItems({
  signedIn,
  devModeEnabled,
  setActiveSubmenu,
  closeAll,
  setShowWiki,
  handleSignOut,
  handleViewRam,
}: SidebarSettingsMenuLeadingItemsProps): React.ReactElement {
  const { t } = useTranslation("navigation");

  return (
    <>
      {signedIn && (
        <>
          <Button
            layout="custom"
            appearance="custom"
            htmlType="button"
            className={`${DROPDOWN_CLASSES.menuActionItem} gap-2`}
            onMouseEnter={() => setActiveSubmenu(null)}
            onFocus={() => setActiveSubmenu(null)}
            onClick={handleSignOut}
            data-testid="sidebar-menu-sign-out"
          >
            <HugeiconsIcon
              icon={Logout02Icon}
              data-icon="log-out"
              size={DROPDOWN_ITEM.iconSize}
              className={MENU_ICON_CLASS_NAME}
            />
            <span>{t("cloud.signOut")}</span>
          </Button>
          <div className={DROPDOWN_CLASSES.menuGroupSeparator} />
        </>
      )}
      <Button
        layout="custom"
        appearance="custom"
        htmlType="button"
        className={`${DROPDOWN_CLASSES.menuActionItem} gap-2`}
        onMouseEnter={() => setActiveSubmenu(null)}
        onFocus={() => setActiveSubmenu(null)}
        onClick={() => {
          flushSync(closeAll);
          setShowWiki(true);
        }}
        aria-haspopup="dialog"
        data-testid="sidebar-menu-wiki"
      >
        <HugeiconsIcon
          icon={BookOpen01Icon}
          size={DROPDOWN_ITEM.iconSize}
          className={MENU_ICON_CLASS_NAME}
        />
        <span className="truncate">Wiki</span>
      </Button>
      {devModeEnabled && (
        <Button
          layout="custom"
          appearance="custom"
          htmlType="button"
          className={`${DROPDOWN_CLASSES.menuActionItem} gap-2`}
          onMouseEnter={() => setActiveSubmenu(null)}
          onFocus={() => setActiveSubmenu(null)}
          onClick={handleViewRam}
        >
          <HugeiconsIcon
            icon={GaugeIcon}
            data-icon="gauge"
            size={DROPDOWN_ITEM.iconSize}
            className={MENU_ICON_CLASS_NAME}
          />
          <span>{t("sidebar.settingsMenu.viewRam")}</span>
        </Button>
      )}
    </>
  );
}

interface SidebarSettingsMenuSubmenuTriggersProps {
  activeSubmenu: SettingsSubmenu | null;
  openSubmenu: (submenu: SettingsSubmenu, target: HTMLElement) => void;
}

/** Presence, Appearance and Layout: rows that open a submenu on hover or focus. */
export function SidebarSettingsMenuSubmenuTriggers({
  activeSubmenu,
  openSubmenu,
}: SidebarSettingsMenuSubmenuTriggersProps): React.ReactElement {
  const { t } = useTranslation("navigation");
  const { t: tSettings } = useTranslation("settings");

  return (
    <>
      <Button
        layout="custom"
        appearance="custom"
        htmlType="button"
        className={`${DROPDOWN_CLASSES.menuActionItem} ${activeSubmenu === "presence" ? DROPDOWN_CLASSES.itemActive : ""}`}
        onMouseEnter={(event) => openSubmenu("presence", event.currentTarget)}
        onFocus={(event) => openSubmenu("presence", event.currentTarget)}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <HugeiconsIcon
            icon={CircleIcon}
            data-icon="circle"
            size={DROPDOWN_ITEM.iconSize}
            className="shrink-0 text-success-6"
          />
          <span className="truncate">{tSettings("myRoles.tabs.presence")}</span>
        </span>
        <HugeiconsIcon
          icon={ArrowRight01Icon}
          data-icon="chevron-right"
          size={DROPDOWN_ITEM.iconSize}
          className={MENU_ARROW_CLASS_NAME}
        />
      </Button>
      <Button
        layout="custom"
        appearance="custom"
        htmlType="button"
        className={`${DROPDOWN_CLASSES.menuActionItem} ${activeSubmenu === "appearance" ? DROPDOWN_CLASSES.itemActive : ""}`}
        onMouseEnter={(event) => openSubmenu("appearance", event.currentTarget)}
        onFocus={(event) => openSubmenu("appearance", event.currentTarget)}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <HugeiconsIcon
            icon={ContrastIcon}
            data-icon="contrast"
            size={DROPDOWN_ITEM.iconSize}
            className={MENU_ICON_CLASS_NAME}
          />
          <span className="truncate">
            {t("sidebar.settingsMenu.appearance")}
          </span>
        </span>
        <HugeiconsIcon
          icon={ArrowRight01Icon}
          data-icon="chevron-right"
          size={DROPDOWN_ITEM.iconSize}
          className={MENU_ARROW_CLASS_NAME}
        />
      </Button>
      <Button
        layout="custom"
        appearance="custom"
        htmlType="button"
        className={`${DROPDOWN_CLASSES.menuActionItem} ${activeSubmenu === "layout" ? DROPDOWN_CLASSES.itemActive : ""}`}
        onMouseEnter={(event) => openSubmenu("layout", event.currentTarget)}
        onFocus={(event) => openSubmenu("layout", event.currentTarget)}
        data-testid="sidebar-settings-layout"
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <HugeiconsIcon
            icon={Layout01Icon}
            data-icon="layout"
            size={DROPDOWN_ITEM.iconSize}
            className={MENU_ICON_CLASS_NAME}
          />
          <span className="truncate">{tSettings("general.layout")}</span>
        </span>
        <HugeiconsIcon
          icon={ArrowRight01Icon}
          data-icon="chevron-right"
          size={DROPDOWN_ITEM.iconSize}
          className={MENU_ARROW_CLASS_NAME}
        />
      </Button>
    </>
  );
}

interface SidebarSettingsMenuTrailingItemsProps {
  signedIn: boolean;
  devModeEnabled: boolean;
  onSignIn?: () => void;
  openSettingsShortcut: string;
  setActiveSubmenu: SetActiveSubmenu;
  handleOpenOnboarding: () => void;
  handleOpenSettings: () => void;
  handleSignIn: () => void;
}

/** Onboarding (dev mode only), Open settings, and Sign in (signed out, with `onSignIn`). */
export function SidebarSettingsMenuTrailingItems({
  signedIn,
  devModeEnabled,
  onSignIn,
  openSettingsShortcut,
  setActiveSubmenu,
  handleOpenOnboarding,
  handleOpenSettings,
  handleSignIn,
}: SidebarSettingsMenuTrailingItemsProps): React.ReactElement {
  const { t } = useTranslation("navigation");
  const { t: tOnboarding } = useTranslation("onboarding");

  return (
    <>
      {devModeEnabled && (
        <Button
          layout="custom"
          appearance="custom"
          htmlType="button"
          className={`${DROPDOWN_CLASSES.menuActionItem} gap-2`}
          onMouseEnter={() => setActiveSubmenu(null)}
          onFocus={() => setActiveSubmenu(null)}
          onClick={handleOpenOnboarding}
          aria-haspopup="dialog"
          data-testid="sidebar-menu-onboarding"
        >
          <HugeiconsIcon
            icon={RocketIcon}
            size={DROPDOWN_ITEM.iconSize}
            className={MENU_ICON_CLASS_NAME}
          />
          <span className="truncate">{tOnboarding("discovery.title")}</span>
        </Button>
      )}
      <Button
        layout="custom"
        appearance="custom"
        htmlType="button"
        className={`${DROPDOWN_CLASSES.menuActionItem} justify-between`}
        onMouseEnter={() => setActiveSubmenu(null)}
        onFocus={() => setActiveSubmenu(null)}
        onClick={handleOpenSettings}
      >
        <span className="flex min-w-0 items-center gap-2">
          <HugeiconsIcon
            icon={Settings01Icon}
            data-icon="settings"
            size={DROPDOWN_ITEM.iconSize}
            className={MENU_ICON_CLASS_NAME}
          />
          <span className="truncate">
            {t("sidebar.settingsMenu.openSettings")}
          </span>
        </span>
        <KeyboardShortcut
          shortcut={openSettingsShortcut}
          variant={KEYBOARD_SHORTCUT_VARIANT.dropdown}
        />
      </Button>
      {!signedIn && onSignIn && (
        <>
          <div className={DROPDOWN_CLASSES.menuGroupSeparator} />
          <Button
            layout="custom"
            appearance="custom"
            htmlType="button"
            className={`${DROPDOWN_CLASSES.menuActionItem} gap-2`}
            onMouseEnter={() => setActiveSubmenu(null)}
            onFocus={() => setActiveSubmenu(null)}
            onClick={handleSignIn}
            data-testid="sidebar-menu-sign-in"
          >
            <HugeiconsIcon
              icon={Login02Icon}
              data-icon="log-in"
              size={DROPDOWN_ITEM.iconSize}
              className={MENU_ICON_CLASS_NAME}
            />
            <span>{t("cloud.signIn")}</span>
          </Button>
        </>
      )}
    </>
  );
}
