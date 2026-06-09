/**
 * Settings Toolbar Atom
 *
 * Pub-sub channel used by Settings pages to register header actions
 * (refresh button, loading state).
 *
 * Lives in src/store/ui/ so shared header surfaces can read it without
 * reaching into a module's private store path.
 */
import { atom } from "jotai";

import type { RouteToolbarButton } from "@src/store/ui/routeToolbarAtom";

export interface SettingsToolbarEntry {
  onRefresh?: () => void;
  loading?: boolean;
  extraButtons?: RouteToolbarButton[];
}

export const settingsToolbarAtom = atom<SettingsToolbarEntry>({});
settingsToolbarAtom.debugLabel = "settings/toolbar";
