import { useAtomValue } from "jotai";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";

import Button from "@src/components/Button";
import { quitConfirmationModalOpenAtom } from "@src/store/ui/overlayAtom";
import { getInstrumentedStore } from "@src/util/core/state/instrumentedStore";

async function invokeQuitCommand() {
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("confirm_quit_app");
}

async function invokeCancelQuitCommand() {
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("cancel_quit_confirmation");
}

const QuitConfirmationModal = () => {
  const isOpen = useAtomValue(quitConfirmationModalOpenAtom);
  const { t } = useTranslation("common");

  const handleCancel = useCallback(() => {
    getInstrumentedStore().set(quitConfirmationModalOpenAtom, false);
    void invokeCancelQuitCommand();
  }, []);

  const handleQuit = useCallback(() => {
    getInstrumentedStore().set(quitConfirmationModalOpenAtom, false);
    void invokeQuitCommand();
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return;

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        handleCancel();
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        handleQuit();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [handleCancel, handleQuit, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/35 px-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quit-confirm-title"
        className="w-full max-w-[360px] rounded-2xl border border-border-2 bg-bg-1 p-5 text-left shadow-2xl"
      >
        <div
          id="quit-confirm-title"
          className="text-[15px] font-semibold text-text-1"
        >
          {t("quitConfirmation.title")}
        </div>
        <div className="mt-2 text-[13px] leading-5 text-text-3">
          {t("quitConfirmation.subtitle")}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="tertiary" onClick={handleCancel}>
            {t("quitConfirmation.cancel")}
          </Button>
          <Button variant="secondary" onClick={handleQuit}>
            {t("quitConfirmation.confirm")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default QuitConfirmationModal;
