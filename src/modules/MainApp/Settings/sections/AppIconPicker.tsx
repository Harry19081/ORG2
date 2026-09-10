/**
 * Two-tile picker for the running app's Dock / taskbar icon.
 *
 * A radio group rather than a Select: the choice is visual, and the tile
 * itself is the only honest label — "Dark tile" says less than showing it.
 * Roving tabindex + arrow keys give it the keyboard contract of native
 * radios, with the previews being the same bundled PNGs Rust applies.
 */
import React, { useCallback } from "react";

import darkIcon from "@src/assets/appIcons/dark.png";
import lightIcon from "@src/assets/appIcons/light.png";
import type { DockIconVariant } from "@src/hooks/settings";

const APP_ICON_PREVIEWS: Record<DockIconVariant, string> = {
  dark: darkIcon,
  light: lightIcon,
};

export interface AppIconPickerOption {
  value: DockIconVariant;
  label: string;
}

interface AppIconPickerProps {
  value: DockIconVariant;
  options: readonly AppIconPickerOption[];
  onChange: (value: DockIconVariant) => void;
  ariaLabel: string;
  dataTestId?: string;
}

const TILE_BASE_CLASSES =
  "flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center rounded-xl border bg-fill-1 p-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-6/30";
const TILE_SELECTED_CLASSES = "border-text-1";
const TILE_IDLE_CLASSES = "border-border-2 hover:border-border-3";

export const AppIconPicker: React.FC<AppIconPickerProps> = ({
  value,
  options,
  onChange,
  ariaLabel,
  dataTestId,
}) => {
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      const step =
        event.key === "ArrowRight" || event.key === "ArrowDown"
          ? 1
          : event.key === "ArrowLeft" || event.key === "ArrowUp"
            ? -1
            : 0;
      if (step === 0) return;
      event.preventDefault();
      const index = options.findIndex((option) => option.value === value);
      const next = options[(index + step + options.length) % options.length];
      if (next) onChange(next.value);
    },
    [onChange, options, value]
  );

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex items-center gap-2"
      data-testid={dataTestId}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.label}
            title={option.label}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={handleKeyDown}
            className={`${TILE_BASE_CLASSES} ${selected ? TILE_SELECTED_CLASSES : TILE_IDLE_CLASSES}`}
            data-testid={
              dataTestId ? `${dataTestId}-${option.value}` : undefined
            }
          >
            <img
              src={APP_ICON_PREVIEWS[option.value]}
              alt=""
              draggable={false}
              className="h-10 w-10 select-none"
            />
          </button>
        );
      })}
    </div>
  );
};

export default AppIconPicker;
