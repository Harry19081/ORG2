import { useAtom } from "jotai";
import React from "react";
import { useTranslation } from "react-i18next";

import { ActionSubmenu } from "@src/components/Dropdown/ActionMenuSurface";
import {
  DROPDOWN_CLASSES,
  DROPDOWN_ITEM,
} from "@src/components/Dropdown/tokens";
import SendOnEnterPill from "@src/components/SendOnEnterPill";
import Switch from "@src/components/Switch";
import { HugeiconsIcon, InputCursorTextIcon } from "@src/icons";
import { chatSendOnEnterAtom } from "@src/store/config/configAtom";
import { compactComposerInputAtom } from "@src/store/session/compactComposerInputAtom";
import { composerGlowVisibleAtom } from "@src/store/session/composerGlowVisibleAtom";
import { pinnedActionsVisibleAtom } from "@src/store/session/pinnedActionsVisibleAtom";
import { separateEffortPillAtom } from "@src/store/session/separateEffortPillAtom";

interface InputSettingSwitchProps {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  dataTestId: string;
}

function InputSettingSwitch({
  label,
  checked,
  onCheckedChange,
  dataTestId,
}: InputSettingSwitchProps) {
  return (
    <div className={DROPDOWN_CLASSES.menuControlItem}>
      <span className="flex-1 truncate">{label}</span>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        size="small"
        ariaLabel={label}
        dataTestId={dataTestId}
      />
    </div>
  );
}

/** The session "…" menu's Input settings flyout: composer preferences only. */
export function SessionInputSettingsSubmenu(): React.ReactNode {
  const { t } = useTranslation("sessions");
  const [sendOnEnter, setSendOnEnter] = useAtom(chatSendOnEnterAtom);
  const [pinnedActionsVisible, setPinnedActionsVisible] = useAtom(
    pinnedActionsVisibleAtom
  );
  const [compactComposerInput, setCompactComposerInput] = useAtom(
    compactComposerInputAtom
  );
  const [composerGlowVisible, setComposerGlowVisible] = useAtom(
    composerGlowVisibleAtom
  );
  const [separateEffortPill, setSeparateEffortPill] = useAtom(
    separateEffortPillAtom
  );
  const sendMethodLabel = t("chat.sendMethod");

  return (
    <ActionSubmenu
      label={t("chat.inputSettings")}
      icon={
        <HugeiconsIcon
          icon={InputCursorTextIcon}
          size={DROPDOWN_ITEM.iconSize}
          strokeWidth={1.75}
        />
      }
      dataTestId="session-input-settings-submenu"
    >
      <div className={DROPDOWN_CLASSES.menuControlItem}>
        <span className="flex-1 truncate">{sendMethodLabel}</span>
        <SendOnEnterPill
          size="small"
          ariaLabel={sendMethodLabel}
          dataTestId="session-menu-send-on-enter"
          sendOnEnter={sendOnEnter}
          onChange={setSendOnEnter}
        />
      </div>
      <InputSettingSwitch
        label={t("chat.startPage.showSkills")}
        checked={pinnedActionsVisible}
        onCheckedChange={setPinnedActionsVisible}
        dataTestId="session-menu-show-skills-toggle"
      />
      <InputSettingSwitch
        label={t("chat.compactInput")}
        checked={compactComposerInput}
        onCheckedChange={setCompactComposerInput}
        dataTestId="session-menu-compact-input-toggle"
      />
      <InputSettingSwitch
        label={t("chat.composerGlow")}
        checked={composerGlowVisible}
        onCheckedChange={setComposerGlowVisible}
        dataTestId="session-menu-composer-glow-toggle"
      />
      <InputSettingSwitch
        label={t("chat.separateEffortPill")}
        checked={separateEffortPill}
        onCheckedChange={setSeparateEffortPill}
        dataTestId="session-menu-separate-effort-pill-toggle"
      />
    </ActionSubmenu>
  );
}
