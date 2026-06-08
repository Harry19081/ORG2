import type { ReactNode } from "react";
import React, { memo } from "react";

import { KeyboardShortcutTooltipContent } from "@src/components/KeyboardShortcut";
import Tooltip, { type TooltipProps } from "@src/components/Tooltip";
import { getShortcutKeys } from "@src/config/keyboard/shortcutDisplay";

export interface WorkstationToolbarTooltipProps {
  label: ReactNode;
  shortcut?: string;
  shortcutId?: string;
  position?: TooltipProps["position"];
  disabled?: boolean;
  children: ReactNode;
}

export const WorkstationToolbarTooltip: React.FC<WorkstationToolbarTooltipProps> =
  memo(
    ({
      label,
      shortcut,
      shortcutId,
      position = "bottom",
      disabled = false,
      children,
    }) => {
      const resolvedShortcut = shortcutId
        ? getShortcutKeys(shortcutId)
        : shortcut;

      return (
        <Tooltip
          content={
            <KeyboardShortcutTooltipContent
              label={label}
              shortcut={resolvedShortcut}
            />
          }
          position={position}
          mouseEnterDelay={200}
          framedPanel
          disabled={disabled}
          smartPlacement
        >
          <span className="inline-flex">{children}</span>
        </Tooltip>
      );
    }
  );

WorkstationToolbarTooltip.displayName = "WorkstationToolbarTooltip";
