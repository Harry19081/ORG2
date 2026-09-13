import { useAtomValue } from "jotai";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";

import quitImage from "@src/assets/illustrations/quit.png";
import Modal from "@src/scaffold/ModalSystem";
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

  return (
    <Modal
      visible={isOpen}
      size="medium"
      image={{ src: quitImage, alt: "" }}
      title={t("quitConfirmation.title")}
      closable={false}
      maskClosable={false}
      onCancel={handleCancel}
      onOk={handleQuit}
      okText={t("quitConfirmation.confirm")}
      cancelText={t("quitConfirmation.cancel")}
    >
      <p className="text-sm text-text-2">{t("quitConfirmation.subtitle")}</p>
    </Modal>
  );
};

export default QuitConfirmationModal;
