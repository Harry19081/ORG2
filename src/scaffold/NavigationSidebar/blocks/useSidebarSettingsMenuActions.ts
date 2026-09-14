import { useCallback, useState } from "react";
import { flushSync } from "react-dom";

import type { AppearanceMode } from "@src/config/appearance/globalThemes";
import type { UseAppNavigationReturn } from "@src/hooks/navigation/useAppNavigation";
import { TUTORIALS_OPEN_EVENT } from "@src/scaffold/Tutorials/tutorialRegistry";

interface UseSidebarSettingsMenuActionsOptions {
  closeAll: () => void;
  goToSettings: UseAppNavigationReturn["goToSettings"];
  handleAppearanceModeChange: (mode: AppearanceMode) => Promise<void>;
}

/**
 * Wiki and account dialog visibility, plus the menu actions that close every
 * popover as they navigate, change the theme or open a dialog.
 */
export function useSidebarSettingsMenuActions({
  closeAll,
  goToSettings,
  handleAppearanceModeChange,
}: UseSidebarSettingsMenuActionsOptions) {
  const [showWiki, setShowWiki] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [showSignOutConfirmation, setShowSignOutConfirmation] = useState(false);

  const handleOpenOnboarding = useCallback(() => {
    flushSync(closeAll);
    window.dispatchEvent(new CustomEvent(TUTORIALS_OPEN_EVENT));
  }, [closeAll]);

  const handleOpenSettings = useCallback(() => {
    closeAll();
    goToSettings();
  }, [closeAll, goToSettings]);

  const handleModifyAppearance = useCallback(() => {
    closeAll();
    goToSettings({ section: "appearance" });
  }, [closeAll, goToSettings]);

  const handleSignIn = useCallback(() => {
    closeAll();
    setShowSignInModal(true);
  }, [closeAll]);

  const handleSignOut = useCallback(() => {
    closeAll();
    setShowSignOutConfirmation(true);
  }, [closeAll]);

  const handleSelectAppearanceMode = useCallback(
    async (mode: AppearanceMode) => {
      await handleAppearanceModeChange(mode);
      closeAll();
    },
    [closeAll, handleAppearanceModeChange]
  );

  return {
    showWiki,
    setShowWiki,
    showSignInModal,
    setShowSignInModal,
    showSignOutConfirmation,
    setShowSignOutConfirmation,
    handleOpenOnboarding,
    handleOpenSettings,
    handleModifyAppearance,
    handleSignIn,
    handleSignOut,
    handleSelectAppearanceMode,
  };
}
