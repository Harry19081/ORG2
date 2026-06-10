import { MessageCircle, MousePointer2 } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";

import { GUI_CONTROL_MODE } from "./constants";
import type { GuiControlMode } from "./types";

export interface AgentControlModePillProps {
  mode: GuiControlMode;
  onClick: () => void;
}

export const AgentControlModePill: React.FC<AgentControlModePillProps> = ({
  mode,
  onClick,
}) => {
  const { t } = useTranslation("common");
  const isAnswer = mode === GUI_CONTROL_MODE.SELECTION;
  const Icon = isAnswer ? MessageCircle : MousePointer2;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-border-2 bg-bg-2 px-2 text-[12px] font-medium text-text-2 transition-colors hover:bg-fill-2 hover:text-text-1"
      aria-label={t("guiControl.toggleMode")}
    >
      <Icon size={14} strokeWidth={1.75} className="text-text-2" />
      <span>
        {isAnswer ? t("guiControl.selectionMode") : t("guiControl.inputMode")}
      </span>
    </button>
  );
};
