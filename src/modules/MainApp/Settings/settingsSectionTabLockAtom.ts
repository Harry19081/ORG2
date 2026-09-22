/**
 * Set by a settings section that holds unsaved edits.
 *
 * The section shell renders one tab per sub-view and a tab click remounts the
 * body, so a section with a draft in progress would lose it silently. While
 * this is true the shell disables every tab but the active one, which is the
 * guard the in-section app switcher used to provide on its own.
 */
import { atom } from "jotai";

export const settingsSectionTabLockAtom = atom(false);
