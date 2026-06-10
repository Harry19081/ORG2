import { ArrowUp } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";

import { INPUT_AREA_BUTTONS } from "@src/config/inputAreaTokens";

export interface AgentControlSubmitButtonProps {
  disabled: boolean;
  onSubmit: () => void;
}

export const AgentControlSubmitButton: React.FC<
  AgentControlSubmitButtonProps
> = ({ disabled, onSubmit }) => {
  const { t } = useTranslation("common");

  return (
    <button
      type="button"
      onClick={onSubmit}
      disabled={disabled}
      className={`flex ${INPUT_AREA_BUTTONS.iconButtonSizeClass} shrink-0 items-center justify-center rounded-full transition-colors duration-200 focus:outline-none ${
        disabled
          ? INPUT_AREA_BUTTONS.iconButtonInactive
          : INPUT_AREA_BUTTONS.iconButtonActive
      }`}
      style={{ lineHeight: 0 }}
      aria-label={t("guiControl.submit")}
    >
      <ArrowUp size={INPUT_AREA_BUTTONS.iconSize} strokeWidth={2} />
    </button>
  );
};
