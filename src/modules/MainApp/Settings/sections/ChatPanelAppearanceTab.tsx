import {
  SECTION_CONTROL_STYLE,
  SectionContainer,
  SectionRow,
} from "@/src/components/layout/Section";
import React from "react";
import { useTranslation } from "react-i18next";

import NumberInput from "@src/components/NumberInput";
import SendOnEnterPill from "@src/components/SendOnEnterPill";
import Switch from "@src/components/Switch";
import { useAgentConfig } from "@src/hooks/config/useAgentConfig";
import { DEFAULT_CHAT_APPEARANCE } from "@src/store/config/configAtom";

export const ChatPanelAppearanceTab: React.FC = () => {
  const { t } = useTranslation("settings");
  const { t: tCommon } = useTranslation("common");
  const { chatAppearance, updateChatAppearance } = useAgentConfig();

  return (
    <>
      <SectionContainer>
        <SectionRow
          settingsSearchKeys="chat.fontSize"
          label={t("agentSessions.chatFontSize")}
        >
          <NumberInput
            value={chatAppearance.fontSize}
            min={10}
            max={16}
            step={1}
            suffix={tCommon("common.px")}
            controlsPosition="sides"
            onValueChange={(value) => {
              updateChatAppearance({
                fontSize: value ?? DEFAULT_CHAT_APPEARANCE.fontSize,
              });
            }}
            size="default"
            style={SECTION_CONTROL_STYLE}
          />
        </SectionRow>
        <SectionRow
          settingsSearchKeys="chat.codeFontSize"
          label={t("agentSessions.codeFontSize")}
        >
          <NumberInput
            value={chatAppearance.codeFontSize}
            min={10}
            max={16}
            step={1}
            suffix={tCommon("common.px")}
            controlsPosition="sides"
            onValueChange={(value) => {
              updateChatAppearance({ codeFontSize: value ?? 13 });
            }}
            size="default"
            style={SECTION_CONTROL_STYLE}
          />
        </SectionRow>
        <SectionRow
          settingsSearchKeys="chat.lineHeight"
          label={t("agentSessions.lineHeight")}
        >
          <NumberInput
            value={chatAppearance.lineHeight}
            min={1.2}
            max={2.0}
            step={0.1}
            suffix={tCommon("common.multiplier")}
            controlsPosition="sides"
            onValueChange={(value) => {
              updateChatAppearance({ lineHeight: value ?? 1.6 });
            }}
            size="default"
            style={SECTION_CONTROL_STYLE}
          />
        </SectionRow>
      </SectionContainer>

      <SectionContainer>
        <SectionRow
          settingsSearchKeys="chat.typingEffectEnabled"
          label={t("agentSessions.typingAnimation")}
          description={t("agentSessions.typingAnimationDesc")}
        >
          <Switch
            checked={chatAppearance.typingEffectEnabled}
            onCheckedChange={(checked) => {
              updateChatAppearance({ typingEffectEnabled: checked });
            }}
          />
        </SectionRow>
        {chatAppearance.typingEffectEnabled && (
          <SectionRow
            settingsSearchKeys="chat.typingSpeed"
            label={t("agentSessions.typingSpeed")}
            description={t("agentSessions.typingSpeedDesc")}
            indent
          >
            <NumberInput
              value={chatAppearance.typingSpeed}
              min={1}
              max={50}
              suffix={tCommon("common.ms")}
              controlsPosition="sides"
              onValueChange={(value) => {
                updateChatAppearance({ typingSpeed: value ?? 5 });
              }}
              size="default"
              style={SECTION_CONTROL_STYLE}
            />
          </SectionRow>
        )}
        <SectionRow
          settingsSearchKeys="chat.sendOnEnter"
          label={t("agentSessions.sendOnEnter")}
          description={t("agentSessions.sendOnEnterDesc")}
        >
          <SendOnEnterPill
            ariaLabel={t("agentSessions.sendOnEnter")}
            sendOnEnter={chatAppearance.sendOnEnter}
            onChange={(sendOnEnter) => {
              updateChatAppearance({ sendOnEnter });
            }}
          />
        </SectionRow>
      </SectionContainer>
    </>
  );
};
