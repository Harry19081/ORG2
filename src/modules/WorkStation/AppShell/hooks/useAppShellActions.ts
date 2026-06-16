import { useSetAtom } from "jotai";
import { useCallback } from "react";

import { openWorkspaceSpotlight } from "@src/scaffold/GlobalSpotlight/openSpotlight";
import { workstationLayoutAtom } from "@src/store/workstation/tabs/atoms";
import { createSettingsTab } from "@src/store/workstation/tabs/factories";
import { openTab as openTabMutation } from "@src/store/workstation/tabs/tabMutations";
import type { WorkStationLayoutState } from "@src/store/workstation/tabs/types";

interface AppShellActions {
  handleSelectRepo: () => void;
  handleOpenSettings: () => void;
}

export function useAppShellActions(): AppShellActions {
  const setLayout = useSetAtom(workstationLayoutAtom);

  const handleSelectRepo = useCallback(() => {
    openWorkspaceSpotlight("switch");
  }, []);

  const handleOpenSettings = useCallback(() => {
    const settingsTab = createSettingsTab();
    setLayout((layout: WorkStationLayoutState) => {
      if (!layout?.mainPane) return layout;
      return {
        ...layout,
        mainPane: openTabMutation(layout.mainPane, settingsTab),
      };
    });
  }, [setLayout]);

  return { handleSelectRepo, handleOpenSettings };
}
