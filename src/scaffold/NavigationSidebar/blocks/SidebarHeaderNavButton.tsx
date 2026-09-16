import React from "react";

import AnyIcon from "@src/components/AnyIcon";
import Button from "@src/components/Button";
import { KeyboardShortcutTooltipContent } from "@src/components/KeyboardShortcut";
import Tooltip, { type TooltipProps } from "@src/components/Tooltip";
import type { IconSvgElement } from "@src/icons";

import { SIDEBAR_TOOLTIP_HOVER_DELAY } from "../config";

interface SidebarHeaderNavButtonProps {
  icon: IconSvgElement;
  label: string;
  onClick: () => void;
  ariaLabel?: string;
  className?: string;
  bold?: boolean;
  /**
   * Tooltip copy. The row already prints `label`, so this describes what the
   * row does (e.g. "Close Settings") rather than repeating the destination.
   */
  tooltipLabel?: string;
  /** Shortcut id whose keys render beside `tooltipLabel`. */
  tooltipShortcutId?: string;
  tooltipPosition?: TooltipProps["position"];
}

const SidebarHeaderNavButton: React.FC<SidebarHeaderNavButtonProps> = ({
  icon,
  label,
  onClick,
  ariaLabel,
  className = "",
  bold = true,
  tooltipLabel,
  tooltipShortcutId,
  tooltipPosition = "bottom-start",
}) => {
  const button = (
    // `text-left` overrides the native <button> UA `text-align: center`, which
    // the flex-1 label column would otherwise inherit and center.
    <Button
      layout="custom"
      appearance="custom"
      className={`group mt-1 flex h-7 w-full cursor-pointer items-center justify-between overflow-hidden rounded-lg px-2 text-left text-text-1 transition-colors duration-150 hover:bg-sidebar-selected ${className}`}
      onClick={onClick}
      tabIndex={0}
      aria-label={ariaLabel ?? label}
    >
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <AnyIcon
          icon={icon}
          size={14}
          strokeWidth={2}
          className="shrink-0 text-text-1"
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0">
          <span
            className={`min-w-0 truncate text-[13px] text-text-1 ${bold ? "font-bold" : ""}`}
          >
            {label}
          </span>
        </span>
      </span>
    </Button>
  );

  if (!tooltipLabel) return button;

  // Shares the dwell time of every other sidebar-chrome tooltip so hovering
  // across the sidebar never mixes hover delays.
  return (
    <Tooltip
      content={
        <KeyboardShortcutTooltipContent
          label={tooltipLabel}
          shortcutId={tooltipShortcutId}
        />
      }
      position={tooltipPosition}
      mouseEnterDelay={SIDEBAR_TOOLTIP_HOVER_DELAY}
      framedPanel
      smartPlacement
    >
      {button}
    </Tooltip>
  );
};

export default SidebarHeaderNavButton;
