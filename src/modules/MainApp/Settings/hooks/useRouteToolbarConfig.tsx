/**
 * useRouteToolbarConfig Hook
 *
 * Derives per-route header action configuration synchronously from:
 * - Current pathname (via useLocation)
 * - Settings and integrations toolbar registrations for supplementary actions
 * Integration add and refresh actions live in the corresponding table headers.
 */
import { useAtomValue } from "jotai";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

import {
  WIZARD_IDS,
  buildAgentOrgsPath,
  buildWizardPath,
  parseCoreSettingsItem,
  parseSettingsTopTab,
} from "@src/config/mainAppPaths";
import { ROUTES } from "@src/config/routes";
import { useRefreshSpin } from "@src/hooks/ui/useRefreshSpin";
import {
  HierarchyCircle01Icon,
  Refresh04Icon,
  UserAdd01Icon,
} from "@src/icons";
import { integrationsToolbarAtom } from "@src/store/ui/integrationsToolbarAtom";
import type {
  RouteToolbarButton,
  RouteToolbarConfig,
} from "@src/store/ui/routeToolbarAtom";
import { settingsToolbarAtom } from "@src/store/ui/settingsToolbarAtom";

import { useSettingsRegionNoticeButton } from "./useSettingsRegionNoticeButton";

const SETTINGS_PREFIX = ROUTES.app.settings.path;

export function useRouteToolbarConfig(): RouteToolbarConfig | null {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation("integrations");

  const noop = useMemo(() => () => {}, []);

  const settingsToolbar = useAtomValue(settingsToolbarAtom);
  const settingsRegionNoticeButton = useSettingsRegionNoticeButton();
  const { spinClass: settingsSpinClass, handleClick: settingsRefreshClick } =
    useRefreshSpin(
      settingsToolbar.onRefresh ?? noop,
      settingsToolbar.loading ?? false
    );

  const openAgentAdd = useCallback(() => {
    const agentsPath = buildAgentOrgsPath({ tab: "agents" });
    navigate(buildWizardPath(agentsPath, WIZARD_IDS.AGENT_ADD));
  }, [navigate]);

  const openOrgAdd = useCallback(() => {
    const agentsPath = buildAgentOrgsPath({ tab: "agents" });
    navigate(buildWizardPath(agentsPath, WIZARD_IDS.ORG_ADD));
  }, [navigate]);

  const coreSettingsItem = useMemo(
    () => parseCoreSettingsItem(pathname),
    [pathname]
  );
  const integrationsToolbar = useAtomValue(integrationsToolbarAtom);
  return useMemo(() => {
    if (pathname.startsWith(SETTINGS_PREFIX)) {
      const topTab = parseSettingsTopTab(pathname);

      if (topTab === "agent-orgs") {
        return {
          extraButtons: settingsRegionNoticeButton
            ? [settingsRegionNoticeButton]
            : undefined,
          plusDropdownItems: [
            {
              id: "add-agent",
              label: t("toolbarPlusMenu.addAgent"),
              icon: UserAdd01Icon,
              onClick: openAgentAdd,
            },
            {
              id: "add-org",
              label: t("agentOrgs.addOrg"),
              icon: HierarchyCircle01Icon,
              onClick: openOrgAdd,
            },
          ],
        };
      }

      if (coreSettingsItem.category) {
        const extraButtons: RouteToolbarButton[] = [];

        if (settingsRegionNoticeButton) {
          extraButtons.push(settingsRegionNoticeButton);
        }

        extraButtons.push(...(integrationsToolbar.extraButtons ?? []));

        return {
          extraButtons: extraButtons.length > 0 ? extraButtons : undefined,
        };
      }

      const extraButtons: RouteToolbarButton[] = [];

      if (settingsRegionNoticeButton) {
        extraButtons.push(settingsRegionNoticeButton);
      }

      extraButtons.push(...(settingsToolbar.extraButtons ?? []));

      if (settingsToolbar.onRefresh) {
        extraButtons.push({
          id: "settings-refresh",
          icon: Refresh04Icon,
          onClick: settingsRefreshClick,
          title: t("common:actions.refresh"),
          iconClassName: settingsSpinClass,
          disabled: !!settingsSpinClass,
        });
      }

      return {
        extraButtons: extraButtons.length > 0 ? extraButtons : undefined,
      };
    }

    return null;
  }, [
    pathname,
    settingsToolbar,
    settingsRegionNoticeButton,
    settingsRefreshClick,
    settingsSpinClass,
    openAgentAdd,
    openOrgAdd,
    coreSettingsItem,
    integrationsToolbar,
    t,
  ]);
}
