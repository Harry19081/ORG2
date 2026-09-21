import { type RefObject, useEffect } from "react";

import { matchesShortcut } from "@src/config/keyboard/shortcutBindings";

/** ⌘F / Ctrl+F — "Search the list", the default for list and table searches. */
export const DEFAULT_SEARCH_SHORTCUT_ID = "list_search";

export interface UseSearchShortcutOptions {
  /** Registered shortcut id. Default: {@link DEFAULT_SEARCH_SHORTCUT_ID}. */
  shortcutId?: string;
  /** No-op while false — e.g. the panel owning the field is hidden. */
  enabled?: boolean;
  /**
   * Limits the binding to keystrokes that happen inside this subtree, so two
   * searchable lists on one screen do not both answer the same chord. Omit it
   * only when exactly one such field can be mounted at a time.
   */
  scopeRef?: RefObject<HTMLElement | null>;
}

/**
 * Focuses a search field when its shortcut is pressed, and selects whatever is
 * already typed so the next keystroke replaces it.
 *
 * Keystrokes are ignored while another text field or editor has focus: ⌘F
 * inside a code editor means "find in this editor", not "jump to the list
 * search". The field this hook owns is the one exception — pressing the chord
 * again re-selects its text.
 */
export function useSearchShortcut(
  inputRef: RefObject<HTMLInputElement | null>,
  options: UseSearchShortcutOptions = {}
): void {
  const {
    shortcutId = DEFAULT_SEARCH_SHORTCUT_ID,
    enabled = true,
    scopeRef,
  } = options;

  useEffect(() => {
    if (!enabled) return;

    const handler = (event: KeyboardEvent) => {
      if (!matchesShortcut(event, shortcutId)) return;

      const input = inputRef.current;
      if (!input) return;

      const target = event.target;
      if (target instanceof Element && target !== input) {
        // Another editable surface owns this chord.
        if (
          target.closest(
            "input, textarea, select, [contenteditable='true'], .cm-editor"
          )
        ) {
          return;
        }
        // A scoped binding only answers inside its own subtree.
        if (scopeRef && !scopeRef.current?.contains(target)) return;
      }

      event.preventDefault();
      input.focus();
      input.select();
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [enabled, inputRef, scopeRef, shortcutId]);
}
