import React from "react";

import ModelSelectorPill from "@src/components/ModelSelectorPill";
import type { LastModelSelection } from "@src/store/session/creatorDefaultModelAtom";

import { AgentControlModePill } from "./AgentControlModePill";
import { AgentControlSubmitButton } from "./AgentControlSubmitButton";
import type { GuiControlMode } from "./types";

export interface AgentControlInputTrailingProps {
  mode: GuiControlMode;
  onToggleMode: () => void;
  selection: LastModelSelection | null;
  selectModelLabel: string;
  modelSelectorActive: boolean;
  onOpenModelSelector: () => void;
  submitDisabled: boolean;
  onSubmit: () => void;
}

export const AgentControlInputTrailing: React.FC<
  AgentControlInputTrailingProps
> = ({
  mode,
  onToggleMode,
  selection,
  selectModelLabel,
  modelSelectorActive,
  onOpenModelSelector,
  submitDisabled,
  onSubmit,
}) => {
  return (
    <div className="flex items-center gap-2">
      <AgentControlModePill mode={mode} onClick={onToggleMode} />
      <ModelSelectorPill
        selection={selection}
        defaultLabel={selectModelLabel}
        active={modelSelectorActive}
        className="h-[28px] max-w-[180px] shrink-0 text-[13px]"
        dataTestId="agent-control-model-pill"
        ariaLabel={selectModelLabel}
        onClick={onOpenModelSelector}
      />
      <AgentControlSubmitButton disabled={submitDisabled} onSubmit={onSubmit} />
    </div>
  );
};
