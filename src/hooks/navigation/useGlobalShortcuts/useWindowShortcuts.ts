import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { isAppQuittingAtom } from "@src/store/ui/overlayAtom";
import { getInstrumentedStore } from "@src/util/core/state/instrumentedStore";
import { isTauriDesktop } from "@src/util/platform/tauri";

interface QuitConfirmationCopy {
  title: string;
  message: string;
  okLabel: string;
  cancelLabel: string;
}

let quitInProgress = false;
let quitDialogOpen = false;

async function confirmQuit(copy: QuitConfirmationCopy): Promise<boolean> {
  try {
    const { ask } = await import("@tauri-apps/plugin-dialog");
    return await ask(copy.message, {
      title: copy.title,
      kind: "warning",
      okLabel: copy.okLabel,
      cancelLabel: copy.cancelLabel,
    });
  } catch {
    return window.confirm(`${copy.title}\n\n${copy.message}`);
  }
}

export function useWindowShortcuts() {
  const { t } = useTranslation("common");

  const handleQuit = useCallback(async () => {
    if (!isTauriDesktop() || quitInProgress) return;

    quitInProgress = true;

    try {
      const jotaiStore = getInstrumentedStore();
      jotaiStore.set(isAppQuittingAtom, true);

      const { exit } = await import("@tauri-apps/plugin-process");
      await exit(0);
    } catch (error) {
      const jotaiStore = getInstrumentedStore();
      jotaiStore.set(isAppQuittingAtom, false);
      quitInProgress = false;
      console.error("Failed to quit app:", error);
    }
  }, []);

  const confirmAndQuit = useCallback(async () => {
    if (!isTauriDesktop() || quitInProgress || quitDialogOpen) {
      return;
    }

    quitDialogOpen = true;
    try {
      const confirmed = await confirmQuit({
        title: t("quitConfirmation.title"),
        message: t("quitConfirmation.message"),
        okLabel: t("quitConfirmation.okLabel"),
        cancelLabel: t("actions.cancel"),
      });
      if (confirmed) {
        await handleQuit();
      }
    } finally {
      quitDialogOpen = false;
    }
  }, [handleQuit, t]);

  const handleHideWindow = useCallback(async () => {
    if (!isTauriDesktop()) return;

    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const window = getCurrentWindow();
      await window.hide();
    } catch (_error) {
      // Hide is best-effort; failed window state changes should not interrupt shortcuts.
    }
  }, []);

  return {
    handleQuit,
    confirmAndQuit,
    handleHideWindow,
  };
}
