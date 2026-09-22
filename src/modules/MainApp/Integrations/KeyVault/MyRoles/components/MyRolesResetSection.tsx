/**
 * My Roles → Status → Reset to defaults.
 *
 * Restores every setting this tab edits — the three built-in guidance
 * strings plus the four by-presence policy records — to the value the
 * settings registry declares, in one partial-file write.
 *
 * Custom statuses are user-authored data, not settings, and are left alone.
 */
import { useSetAtom } from "jotai";
import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import Button from "@src/components/Button";
import Message from "@src/components/Message";
import { SectionContainer, SectionRow } from "@src/components/layout/Section";
import { HugeiconsIcon, RotateLeft01Icon } from "@src/icons";
import { saveSettingsBatchAtom } from "@src/store/settings/settingsAtom";
import { confirmDestructiveAction } from "@src/util/dialogs/confirmDestructiveAction";

import {
  PRESENCE_SETTING_KEYS,
  buildPresenceSettingDefaults,
} from "../myRolesConstants";

export const MyRolesResetSection: React.FC = () => {
  const { t } = useTranslation("settings");
  const saveSettingsBatch = useSetAtom(saveSettingsBatchAtom);
  const [resetting, setResetting] = useState(false);

  const handleReset = useCallback(async () => {
    const confirmed = await confirmDestructiveAction({
      title: t("myRoles.reset.confirmTitle"),
      message: t("myRoles.reset.confirmMessage"),
      okLabel: t("myRoles.reset.button"),
      cancelLabel: t("myRoles.reset.confirmCancel"),
    });
    if (!confirmed) return;

    setResetting(true);
    try {
      await saveSettingsBatch(buildPresenceSettingDefaults());
      Message.success(t("myRoles.reset.done"));
    } catch (error) {
      Message.error(String(error));
    } finally {
      setResetting(false);
    }
  }, [saveSettingsBatch, t]);

  return (
    <SectionContainer>
      <SectionRow
        label={t("myRoles.reset.label")}
        description={t("myRoles.reset.description")}
        settingsSearchKeys={PRESENCE_SETTING_KEYS}
      >
        <Button
          icon={
            <HugeiconsIcon
              icon={RotateLeft01Icon}
              data-icon="rotate-ccw"
              size={14}
            />
          }
          loading={resetting}
          disabled={resetting}
          onClick={() => void handleReset()}
        >
          {t("myRoles.reset.button")}
        </Button>
      </SectionRow>
    </SectionContainer>
  );
};
