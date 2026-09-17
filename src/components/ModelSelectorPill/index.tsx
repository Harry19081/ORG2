/** Desktop adapter. Mobile consumers import ModelSelectorPillView directly. */
import React, { forwardRef, useMemo } from "react";

import {
  resolveModelDisplaySelection,
  useModelAccountLookup,
  useModelEffortSegment,
  useModelPillLabel,
} from "@src/hooks/models";
import type { LastModelSelection } from "@src/store/session/creatorDefaultModelAtom";

import ModelSelectorPillView, {
  type ModelSelectorPillViewProps,
} from "./ModelSelectorPillView";

interface ModelSelectorPillProps extends Omit<
  ModelSelectorPillViewProps,
  "displaySelection" | "modelLabel" | "effortSegment"
> {
  selection: LastModelSelection | null | undefined;
  onVariantApply?: (nextModelId: string) => void;
  /** Historical sessions must keep their stored model, not account defaults. */
  isActiveSession?: boolean;
}

const ModelSelectorPill = forwardRef<HTMLButtonElement, ModelSelectorPillProps>(
  ({ selection, isActiveSession = false, onVariantApply, ...props }, ref) => {
    const { accounts } = useModelAccountLookup();
    const displaySelection = useMemo(
      () => resolveModelDisplaySelection(selection, accounts, isActiveSession),
      [accounts, selection, isActiveSession]
    );
    const modelLabel = useModelPillLabel(displaySelection, props.defaultLabel);
    const effortSegment = useModelEffortSegment({
      selection,
      isActiveSession,
      onApply: onVariantApply,
    });
    return (
      <ModelSelectorPillView
        {...props}
        ref={ref}
        displaySelection={displaySelection}
        modelLabel={modelLabel}
        effortSegment={effortSegment}
      />
    );
  }
);
ModelSelectorPill.displayName = "ModelSelectorPill";
export default ModelSelectorPill;
