import { useAtom } from "jotai";
import React from "react";
import { useTranslation } from "react-i18next";

import SegmentedTextPill from "@src/components/SegmentedTextPill";
import { SectionContainer, SectionRow } from "@src/components/layout/Section";
import {
  type ModelPickerStyle,
  modelPickerStyleAtom,
} from "@src/store/ui/chatPanel/displayPrefsAtoms";
import {
  type ChatPanelPosition,
  chatPanelPositionAtom,
} from "@src/store/ui/workStationLayout/chatPositionAtoms";
import {
  type LayoutMode,
  workStationLayoutModePersistAtom,
} from "@src/store/ui/workStationLayout/splitLayoutAtoms";

/**
 * App-level layout preferences. Each row binds the same atom as the sidebar
 * Layout quick menu, so a change on either surface shows on the other.
 */
export const AppearanceLayoutSection: React.FC = () => {
  const { t } = useTranslation("settings");
  const [chatPanelPosition, setChatPanelPosition] = useAtom(
    chatPanelPositionAtom
  );
  const [workstationSidebarPosition, setWorkstationSidebarPosition] = useAtom(
    workStationLayoutModePersistAtom
  );
  const [modelPickerStyle, setModelPickerStyle] = useAtom(modelPickerStyleAtom);
  const sideOptions = [
    { value: "left", label: t("common:layoutSettings.left") },
    { value: "right", label: t("common:layoutSettings.right") },
  ] as const;

  return (
    <SectionContainer title={t("general.layout")}>
      <SectionRow
        settingsSearchKeys="general.chatPanelPosition"
        label={t("common:layoutSettings.chatPanelLocation")}
      >
        <SegmentedTextPill<ChatPanelPosition>
          ariaLabel={t("common:layoutSettings.chatPanelLocation")}
          value={chatPanelPosition}
          onChange={setChatPanelPosition}
          options={[...sideOptions]}
          size="large"
          dataTestId="chat-panel-position-select"
        />
      </SectionRow>
      <SectionRow label={t("common:layoutSettings.sidebarPosition")}>
        <SegmentedTextPill<LayoutMode>
          ariaLabel={t("common:layoutSettings.sidebarPosition")}
          value={workstationSidebarPosition}
          onChange={setWorkstationSidebarPosition}
          options={[...sideOptions]}
          size="large"
          dataTestId="workstation-sidebar-position-select"
        />
      </SectionRow>
      <SectionRow
        settingsSearchKeys="general.modelPickerStyle"
        label={t("common:layoutSettings.modelPickerStyle")}
      >
        <SegmentedTextPill<ModelPickerStyle>
          ariaLabel={t("common:layoutSettings.modelPickerStyle")}
          value={modelPickerStyle}
          onChange={setModelPickerStyle}
          options={[
            {
              value: "spotlight",
              label: t("common:layoutSettings.modelPickerSpotlight"),
            },
            {
              value: "dropdown",
              label: t("common:layoutSettings.modelPickerMenu"),
            },
          ]}
          size="large"
          dataTestId="model-picker-style-select"
        />
      </SectionRow>
    </SectionContainer>
  );
};
