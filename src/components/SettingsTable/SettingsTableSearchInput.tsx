/**
 * The search field shared by SettingsTable's two toolbar layouts (the stacked
 * `SearchSortBar` and the inline toolbar), so both get the same prefix icon,
 * clear affordance, and optional keyboard shortcut.
 *
 * Opting a table into `searchShortcut` binds ⌘F / Ctrl+F (or the id you pass)
 * to focusing this field, and shows the key hint inside the field while it is
 * empty and unfocused — the hint gets out of the way the moment it has served
 * its purpose, and never collides with the clear button.
 */
import React, { useId, useRef, useState } from "react";

import Input, { type InputProps } from "@src/components/Input";
import KeyboardShortcut from "@src/components/KeyboardShortcut";
import {
  DEFAULT_SEARCH_SHORTCUT_ID,
  useSearchShortcut,
} from "@src/hooks/keyboard/useSearchShortcut";
import { HugeiconsIcon, Search01Icon } from "@src/icons";

/** Opt-in keyboard shortcut for a table's search field. `true` takes the
 *  defaults: ⌘F / Ctrl+F, with the key hint shown inside the field. */
export type SettingsTableSearchShortcut =
  | boolean
  | {
      /** Registered shortcut id. Default: `list_search` (⌘F / Ctrl+F). */
      shortcutId?: string;
      /** Keep the binding but drop the inline key hint. */
      hideHint?: boolean;
      /** Limits the binding to keystrokes inside this subtree — pass it when
       *  more than one searchable list can be on screen at once. */
      scopeRef?: React.RefObject<HTMLElement | null>;
    };

export interface SettingsTableSearchInputProps {
  value: string;
  placeholder?: string;
  size?: InputProps["size"];
  onChange: (value: string) => void;
  onClear?: () => void;
  allowClear?: boolean;
  shortcut?: SettingsTableSearchShortcut;
  className?: string;
}

export function SettingsTableSearchInput({
  value,
  placeholder,
  size,
  onChange,
  onClear,
  allowClear = true,
  shortcut,
  className = "w-full min-w-0",
}: SettingsTableSearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const hintId = useId();

  const config = typeof shortcut === "object" ? shortcut : {};
  const shortcutEnabled = shortcut === true || typeof shortcut === "object";
  const shortcutId = config.shortcutId ?? DEFAULT_SEARCH_SHORTCUT_ID;

  useSearchShortcut(inputRef, {
    shortcutId,
    enabled: shortcutEnabled,
    scopeRef: config.scopeRef,
  });

  const showHint =
    shortcutEnabled && !config.hideHint && !focused && value.length === 0;

  return (
    <Input
      ref={inputRef}
      className={className}
      type="search"
      size={size}
      value={value}
      placeholder={placeholder}
      aria-describedby={showHint ? hintId : undefined}
      prefix={
        <HugeiconsIcon
          icon={Search01Icon}
          data-icon="search"
          size={14}
          className="text-text-3"
          aria-hidden
        />
      }
      suffix={
        showHint ? (
          <span id={hintId} className="pointer-events-none flex items-center">
            <KeyboardShortcut shortcutId={shortcutId} size="sm" />
          </span>
        ) : undefined
      }
      onChange={(next) => onChange(next)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      allowClear={allowClear}
      onClear={onClear}
    />
  );
}

export default SettingsTableSearchInput;
