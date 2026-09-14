/**
 * High refresh rate — settings-backed toggle (macOS).
 *
 * Rust reads `general.highRefreshRate` from `~/.orgii/settings.jsonc` before
 * each app window is first shown, and re-applies it to open windows when the
 * settings file changes, so this atom only persists the preference.
 */
import { atom } from "jotai";

import {
  settingsAtom,
  updateSettingAtom,
} from "@src/store/settings/settingsAtom";

export const highRefreshRateAtom = atom(
  (get) => get(settingsAtom)["general.highRefreshRate"] ?? true,
  (_get, set, value: boolean) => {
    set(updateSettingAtom, {
      key: "general.highRefreshRate",
      value,
    });
  }
);
highRefreshRateAtom.debugLabel = "highRefreshRateAtom";
