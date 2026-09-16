/**
 * SettingsSlot
 *
 * The Settings UI rendered inside the chat-panel slot. AppShell mounts
 * this whenever the URL starts with `/orgii/app/settings/*`. The route
 * stays deeplinkable; the matching React Router outlet renders nothing
 * and this slot displays the actual UI.
 *
 * Architecture:
 *
 *   - The slot is a pure shell (header + resize handle + radius +
 *     position-flip wrapper). It owns no settings logic.
 *   - The body is picked from `SETTINGS_BODY_BY_ROOT`, keyed off
 *     `classifySettingsRouteRoot(pathname)`. AGENT_ORGS and MY_ROLE
 *     delegate to existing full-page modules via lazy Suspense; APP
 *     renders the section/tab UI inline.
 *   - URL is the single source of truth for active section and tab —
 *     the slot derives both from `useLocation()` and writes back with
 *     `navigate(..., { replace: true })` on user interaction.
 */
import {
  DETAIL_PANEL_TOKENS,
  InternalHeader,
  ScrollFadeContainer,
} from "@/src/components/layout/blocks";
import { ResponsiveContainer } from "@/src/components/layout/blocks/NarrowPlaceholder";
import { useAtomValue, useSetAtom } from "jotai";
import React, { Suspense, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useLocation } from "react-router-dom";

import Button from "@src/components/Button";
import { KeyboardShortcutTooltipContent } from "@src/components/KeyboardShortcut";
import { Placeholder } from "@src/components/Placeholder";
import TabPill, { type TabPillItem } from "@src/components/TabPill";
import Tooltip from "@src/components/Tooltip";
// AGENT_ORGS and MY_ROLE roots host larger surfaces that already exist
// as full-page modules; the slot lazy-loads them on demand.
import { getPagePanelBackgroundStyle } from "@src/components/layout/tokens/viewContainerTokens";
import { useShortcutKeys } from "@src/config/keyboard/useShortcutBindings";
import {
  SETTINGS_ROUTE_ROOT,
  type SettingsRouteRoot,
  type SettingsSectionSegment,
  buildSettingsPath,
  classifySettingsRouteRoot,
  getDefaultSettingsSectionTab,
  getDevOnlyIntegrationRedirect,
  parseSettingsSectionTab,
} from "@src/config/mainAppPaths";
import { ROUTES } from "@src/config/routes";
import { getSettingsSectionById } from "@src/config/settingsUiManifest";
import { CHROME_TOOLTIP_HOVER_DELAY } from "@src/config/tooltip";
// Reuse ChatPanel's resize wiring so the seam between the slot and the
// workbench surface behaves identically across both slot occupants.
import { useChatPanelResize } from "@src/engines/ChatPanel/hooks/useChatPanelResize";
import { useAppNavigate as useNavigate } from "@src/hooks/navigation/useAppNavigate";
import { useShouldOffsetChatPanelHeader } from "@src/hooks/ui/sidebar/useCollapsedSidebarChromeOffset";
import {
  ArrowExpand01Icon,
  GalleryThumbnailsIcon,
  Home01Icon,
  HugeiconsIcon,
} from "@src/icons";
import IntegrationsDetailPanel from "@src/modules/MainApp/Integrations/IntegrationsDetailPanel";
import { IntegrationsPageListColumn } from "@src/modules/MainApp/Integrations/IntegrationsPageListColumn";
import { useIntegrationsPage } from "@src/modules/MainApp/Integrations/useIntegrationsPage";
import MainAppPageHeader from "@src/modules/MainApp/shared/MainAppPageHeader";
import { AgentOrgsPage, MyRolePage } from "@src/router/lazy/pages";
import { VerticalResizeHandle } from "@src/scaffold/Resize";
import SplitViewLayout from "@src/scaffold/layouts/SplitViewLayout";
import { devModeEnabledAtom } from "@src/store/platform/devModeAtom";
import { resolvedBackgroundConfigAtom } from "@src/store/ui/backgroundConfigAtom";
import { toggleChatPanelMaximizedAtom } from "@src/store/ui/chatPanel/surfaceAtoms";
import { settingsReturnPathAtom } from "@src/store/ui/settingsNavigationAtom";
import { sidebarCollapsedAtom } from "@src/store/ui/sidebarAtom";
import type { ChatPanelPosition } from "@src/store/ui/workStationLayout/chatPositionAtoms";

import SettingsBreadcrumb from "./SettingsBreadcrumb";
import SettingsHeaderActions from "./components/SettingsHeaderActions";
import { APP_SECTIONS, SECTION_IDS, SECTION_TAB_META } from "./config";
import SettingsSectionRenderer from "./renderer/SettingsSectionRenderer";

interface SettingsSlotProps {
  /** Maximized = edge-to-edge; disables the resize handle. */
  maximized: boolean;
  /** Which side of the workbench the slot sits on. */
  position: ChatPanelPosition;
  /** True when hosted as a flex sibling (full/compact); false when inset. */
  embedded: boolean;
  /** Unclipped boundary host for the centered resize indicator. */
  resizeIndicatorHost?: HTMLElement | null;
}

// ────────────────────────────────────────────────────────────────────────────
// Body: APP root
// ────────────────────────────────────────────────────────────────────────────

/**
 * APP-root body — the section list lives in the route-level
 * `SettingsSidebar`, so this just renders the active section's content
 * plus its sub-tab pill. Section/tab come from the URL.
 */
const SettingsSlotAppBody: React.FC = () => {
  const { t } = useTranslation("settings");
  const location = useLocation();
  const navigate = useNavigate();

  const { section: urlSection, tab: urlTab } = useMemo(
    () => parseSettingsSectionTab(location.pathname),
    [location.pathname]
  );

  const defaultSectionId =
    (APP_SECTIONS[0]?.id as SettingsSectionSegment) ??
    (SECTION_IDS.GENERAL as SettingsSectionSegment);
  const activeSection: SettingsSectionSegment = urlSection ?? defaultSectionId;
  const activeTab =
    urlTab ?? getDefaultSettingsSectionTab(activeSection) ?? activeSection;

  const sectionTitle = useMemo(() => {
    const def = getSettingsSectionById(activeSection);
    return def ? t(def.headingTitleKey) : "";
  }, [activeSection, t]);

  const tabs = useMemo<TabPillItem[]>(() => {
    const meta = SECTION_TAB_META[activeSection];
    if (meta) {
      return meta.map(({ key, labelKey }) => ({ key, label: t(labelKey) }));
    }
    return [{ key: activeSection, label: sectionTitle }];
  }, [activeSection, sectionTitle, t]);

  const handleTabChange = useCallback(
    (key: string) => {
      navigate(buildSettingsPath({ section: activeSection, tab: key }), {
        replace: true,
      });
    },
    [activeSection, navigate]
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <ResponsiveContainer className="min-h-0 flex-1">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <InternalHeader
            noPanelHeader
            contentPadding
            className={DETAIL_PANEL_TOKENS.headerWidth}
            tabs={
              <TabPill
                tabs={tabs}
                activeTab={activeTab}
                onChange={handleTabChange}
                variant="simple"
                fillWidth={false}
                size="large"
              />
            }
          />
          <ScrollFadeContainer
            className={`scroll-fade-at-top ${DETAIL_PANEL_TOKENS.scrollContentNoTop}`}
          >
            <div className={DETAIL_PANEL_TOKENS.contentWidthWithPaddingNoTop}>
              <SettingsSectionRenderer
                sectionId={activeSection}
                activeTab={activeTab}
              />
            </div>
          </ScrollFadeContainer>
        </div>
      </ResponsiveContainer>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Body: INTEGRATIONS root
// ────────────────────────────────────────────────────────────────────────────

const SettingsSlotIntegrationsBody: React.FC = () => {
  const { hasFullPageDetail, listColumnProps, detailPanelProps } =
    useIntegrationsPage();

  const content = hasFullPageDetail ? (
    <SplitViewLayout
      className="settings-page absolute inset-0 overflow-hidden"
      listWidth={300}
      minListWidth={220}
      maxListWidth={400}
      listContent={<IntegrationsPageListColumn {...listColumnProps} />}
      mainContent={<IntegrationsDetailPanel {...detailPanelProps} />}
    />
  ) : (
    <div className="settings-page absolute inset-0 overflow-hidden">
      <IntegrationsDetailPanel {...detailPanelProps} />
    </div>
  );

  return (
    <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
      {content}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Body: lazy full-page surfaces (AGENT_ORGS, MY_ROLE)
// ────────────────────────────────────────────────────────────────────────────

const LazyFullPageBody: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
    <Suspense
      fallback={<Placeholder variant="loading" placement="detail-panel" />}
    >
      {children}
    </Suspense>
  </div>
);

/**
 * Dispatch table: settings route root → body component. Adding a new
 * settings root (e.g. a future `WORKSPACE` family) means appending one
 * line here plus updating `classifySettingsRouteRoot`.
 */
const SETTINGS_BODY_BY_ROOT: Record<SettingsRouteRoot, React.FC> = {
  [SETTINGS_ROUTE_ROOT.APP]: SettingsSlotAppBody,
  [SETTINGS_ROUTE_ROOT.INTEGRATIONS]: SettingsSlotIntegrationsBody,
  [SETTINGS_ROUTE_ROOT.AGENT_ORGS]: () => (
    <LazyFullPageBody>
      <AgentOrgsPage />
    </LazyFullPageBody>
  ),
  [SETTINGS_ROUTE_ROOT.MY_ROLE]: () => (
    <LazyFullPageBody>
      <MyRolePage />
    </LazyFullPageBody>
  ),
};

function isAgentOrgsRoute(pathname: string): boolean {
  const routeRoot = classifySettingsRouteRoot(pathname);
  return routeRoot === SETTINGS_ROUTE_ROOT.AGENT_ORGS;
}

// ────────────────────────────────────────────────────────────────────────────
// Shell
// ────────────────────────────────────────────────────────────────────────────

const SettingsSlot: React.FC<SettingsSlotProps> = ({
  maximized,
  position,
  embedded,
  resizeIndicatorHost,
}) => {
  const { t } = useTranslation("settings");
  const { t: tCommon } = useTranslation("common");
  const { t: tNavigation } = useTranslation("navigation");
  const toggleMaximized = useSetAtom(toggleChatPanelMaximizedAtom);
  const location = useLocation();
  const navigate = useNavigate();
  const settingsReturnPath = useAtomValue(settingsReturnPathAtom);
  const sidebarCollapsed = useAtomValue(sidebarCollapsedAtom);
  const devModeEnabled = useAtomValue(devModeEnabledAtom);
  const backgroundConfig = useAtomValue(resolvedBackgroundConfigAtom);
  const pageOpacityStyle = getPagePanelBackgroundStyle(
    backgroundConfig.pageOpacity
  );
  const offsetForCollapsedSidebar = useShouldOffsetChatPanelHeader({
    position,
    useExternalWidth: maximized,
  });
  const { isDragging, panelRef, handleMouseDown } = useChatPanelResize({
    useExternalWidth: maximized,
    embedded,
    position,
  });

  const routeRoot = useMemo(
    () => classifySettingsRouteRoot(location.pathname),
    [location.pathname]
  );
  const Body = SETTINGS_BODY_BY_ROOT[routeRoot];
  const devOnlyRedirect = getDevOnlyIntegrationRedirect(
    location.pathname,
    devModeEnabled
  );
  const handleBack = useCallback(() => {
    if (isAgentOrgsRoute(location.pathname)) {
      navigate(buildSettingsPath());
      return;
    }
    navigate(settingsReturnPath || ROUTES.workStation.base.path);
  }, [location.pathname, navigate, settingsReturnPath]);

  // The collapsed-sidebar home button stands in for the sidebar's
  // close-Settings row, so it carries the same copy and ⌘W row — except on
  // Agent & Team routes, where `handleBack` drills up to the Settings root
  // instead of leaving Settings, and advertising the close shortcut would
  // describe something the button does not do.
  const drillsUpToSettingsRoot = isAgentOrgsRoute(location.pathname);
  const backLabel = drillsUpToSettingsRoot
    ? tCommon("actions.back")
    : tNavigation("labels.closeSettings");

  // Mirror ChatPanel's tooltip: same shortcut, same restore copy
  // (`sessions:chat.restoreSplitView` = "Show Workstation") — only the
  // maximize-direction label swaps to "Maximize Settings" so the button
  // describes the actual occupant of the slot. Shortcut IDs match the
  // chat panel exactly so the displayed keys stay in lockstep.
  const maximizeLabel = maximized
    ? t("sessions:chat.restoreSplitView", { defaultValue: "Show Workstation" })
    : t("panel.maximizeSettings", { defaultValue: "Maximize Settings" });
  const maximizeShortcut = useShortcutKeys(
    maximized ? "maximize_work_station" : "maximize_chat"
  );
  const maximizeTooltip = (
    <KeyboardShortcutTooltipContent
      label={maximizeLabel}
      shortcut={maximizeShortcut}
    />
  );

  // Match ChatPanel: handle + body are flex siblings, with row direction
  // flipped so the handle always sits on the workbench-facing edge.
  return (
    <div
      data-settings-surface
      className={`relative flex h-full w-full min-w-0 ${
        position === "left" ? "flex-row-reverse" : "flex-row"
      }`}
    >
      {!maximized && (
        <VerticalResizeHandle
          indicatorHost={resizeIndicatorHost}
          indicatorPlacement={
            resizeIndicatorHost
              ? "center"
              : position === "left"
                ? "start"
                : "end"
          }
          onMouseDown={handleMouseDown}
          variant={embedded ? "border" : "transparent"}
          noAccent={!embedded}
        />
      )}
      <div
        ref={panelRef}
        className="relative flex h-full max-w-full min-w-0 flex-1 flex-col overflow-hidden"
        style={
          {
            // Match ChatPanel: inset/comfort mode rounds the slot; full/
            // compact mode hosts the slot edge-to-edge and the wrapper
            // owns the radius.
            borderRadius: embedded ? 0 : "var(--radius-page)",
            contain: isDragging ? "strict" : undefined,
            willChange: isDragging ? "width" : undefined,
            WebkitAppRegion: "no-drag",
          } as React.CSSProperties
        }
      >
        <MainAppPageHeader
          // With the sidebar visible, mirror the folded Chat Pane's 15px
          // header inset. The collapsed-sidebar offset remains unchanged.
          className={sidebarCollapsed ? "" : "pl-[15px]!"}
          style={pageOpacityStyle}
          offsetForCollapsedSidebar={offsetForCollapsedSidebar}
          breadcrumb={
            <>
              {sidebarCollapsed ? (
                // Shares the sidebar-chrome dwell time so hovering between
                // the header and the sidebar never mixes hover delays.
                <Tooltip
                  content={
                    <KeyboardShortcutTooltipContent
                      label={backLabel}
                      shortcutId={
                        drillsUpToSettingsRoot ? undefined : "close_tab"
                      }
                    />
                  }
                  position="bottom-start"
                  mouseEnterDelay={CHROME_TOOLTIP_HOVER_DELAY}
                  framedPanel
                  smartPlacement
                >
                  <Button
                    htmlType="button"
                    variant="tertiary"
                    size="small"
                    iconOnly
                    onClick={handleBack}
                    aria-label={backLabel}
                    icon={
                      <HugeiconsIcon
                        icon={Home01Icon}
                        data-icon="home"
                        size={16}
                        strokeWidth={2}
                      />
                    }
                  />
                </Tooltip>
              ) : null}
              <SettingsBreadcrumb className={sidebarCollapsed ? "" : "px-1!"} />
            </>
          }
          actions={
            <>
              <SettingsHeaderActions />
              <Tooltip
                content={maximizeTooltip}
                position="bottom-end"
                mouseEnterDelay={200}
                framedPanel
              >
                <span className="inline-flex">
                  <Button
                    htmlType="button"
                    variant="tertiary"
                    size="small"
                    iconOnly
                    onClick={() => toggleMaximized()}
                    aria-label={maximizeLabel}
                    icon={
                      maximized ? (
                        <HugeiconsIcon
                          icon={GalleryThumbnailsIcon}
                          data-icon="gallery-thumbnails"
                          size={14}
                          strokeWidth={2}
                        />
                      ) : (
                        <HugeiconsIcon
                          icon={ArrowExpand01Icon}
                          data-icon="maximize-2"
                          size={14}
                          strokeWidth={2}
                        />
                      )
                    }
                  />
                </span>
              </Tooltip>
            </>
          }
        />

        <div
          className="flex min-h-0 flex-1 flex-col"
          style={
            {
              ...pageOpacityStyle,
              WebkitAppRegion: "no-drag",
            } as React.CSSProperties
          }
        >
          {devOnlyRedirect ? (
            <Navigate replace to={devOnlyRedirect} />
          ) : (
            <Body />
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsSlot;
