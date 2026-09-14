import { useAtom, useAtomValue } from "jotai";
import React, { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";

import updateImage from "@src/assets/illustrations/update.png";
import Button from "@src/components/Button";
import { PANEL_FOOTER_TOKENS } from "@src/modules/shared/layouts/blocks/PanelFooter";
import Modal from "@src/scaffold/ModalSystem";
import { settingsLoadedAtom } from "@src/store/settings/settingsAtom";

import { DownloadProgressOrb } from "./DownloadProgress";
import {
  expandDownloadProgressNotice,
  installAvailableAppUpdate,
  postponeAppUpdate,
  // skipAppUpdateVersion,
  startAutomaticAppUpdates,
  usesSeparateApplicationInstall,
} from "./service";
import {
  appBuildProvenanceAtom,
  appUpdateDownloadProgressAtom,
  appUpdateInstallPromptAtom,
  availableAppUpdateAtom,
} from "./state";

export const AppUpdater: React.FC = () => {
  const { t } = useTranslation(["settings", "common"]);
  const availableUpdate = useAtomValue(availableAppUpdateAtom);
  const buildProvenance = useAtomValue(appBuildProvenanceAtom);
  const downloadProgress = useAtomValue(appUpdateDownloadProgressAtom);
  const [installPromptVisible, setInstallPromptVisible] = useAtom(
    appUpdateInstallPromptAtom
  );
  const settingsLoaded = useAtomValue(settingsLoadedAtom);

  const handleInstallLater = useCallback(() => {
    postponeAppUpdate(availableUpdate?.version);
  }, [availableUpdate]);

  // const handleSkipVersion = useCallback(() => {
  //   skipAppUpdateVersion(availableUpdate?.version);
  //   setInstallPromptVisible(false);
  // }, [availableUpdate, setInstallPromptVisible]);

  const handleInstallConfirm = useCallback(async () => {
    await installAvailableAppUpdate({ confirmed: true });
    setInstallPromptVisible(false);
  }, [setInstallPromptVisible]);

  useEffect(() => {
    if (!settingsLoaded) return;

    return startAutomaticAppUpdates();
  }, [settingsLoaded]);

  return (
    <>
      <Modal
        visible={installPromptVisible && Boolean(availableUpdate)}
        title={
          buildProvenance && usesSeparateApplicationInstall(buildProvenance)
            ? t("update.installOfficialConfirmTitle")
            : t("update.installConfirmTitle")
        }
        size="medium"
        image={{ src: updateImage, alt: "" }}
        closable={false}
        maskClosable={false}
        escToExit={false}
        onCancel={handleInstallLater}
        onClose={handleInstallLater}
        footer={
          <div className={PANEL_FOOTER_TOKENS.container}>
            {/* Skip-version action temporarily disabled.
            <Button
              variant="tertiary"
              appearance="ghost"
              size="small"
              onClick={handleSkipVersion}
            >
              {t("update.skipVersion")}
            </Button>
            */}
            <div className="flex flex-1 items-center justify-end gap-2">
              <Button
                variant="secondary"
                size="small"
                onClick={handleInstallLater}
              >
                {t("common:actions.later")}
              </Button>
              <Button
                variant="primary"
                size="small"
                onClick={handleInstallConfirm}
                data-modal-primary-action
              >
                {buildProvenance &&
                usesSeparateApplicationInstall(buildProvenance)
                  ? t("update.installOfficial")
                  : t("update.installAndRestart")}
              </Button>
            </div>
          </div>
        }
      >
        <p className="text-sm text-text-2">
          {t(
            buildProvenance && usesSeparateApplicationInstall(buildProvenance)
              ? "update.installOfficialConfirmDesc"
              : "update.installConfirmDesc",
            { version: availableUpdate?.version }
          )}
        </p>
      </Modal>
      <DownloadProgressOrb
        progress={downloadProgress}
        onExpand={expandDownloadProgressNotice}
      />
    </>
  );
};
