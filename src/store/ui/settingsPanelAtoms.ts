/**
 * Settings panel atoms (side-channel state).
 *
 * Navigation state (active section, current subpage) lives in the URL via
 * `@src/config/mainAppPaths` — see `parseSettingsPath`. This file only
 * hosts orthogonal atoms used by individual settings sections to
 * coordinate initial filters.
 */
import { atom } from "jotai";

/**
 * Optional status filter applied when opening the learnings browser via
 * the Status Card pill deep-link. `null` == "no filter" (show all).
 */
export type LearningsBrowserStatusFilter =
  | null
  | "pending"
  | "active"
  | "merged"
  | "deprecated";

/**
 * Initial status filter for the learnings browser when opened via deep
 * link. Consumed once on mount; the browser owns its own filter state
 * afterwards.
 */
export const learningsBrowserInitialFilterAtom =
  atom<LearningsBrowserStatusFilter>(null);
learningsBrowserInitialFilterAtom.debugLabel =
  "settings/learningsBrowserInitialFilter";
