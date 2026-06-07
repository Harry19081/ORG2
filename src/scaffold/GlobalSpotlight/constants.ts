/**
 * GlobalSpotlight Constants
 *
 * Centralized config for spotlight positioning and limits. All spotlight
 * chrome lives in SpotlightShell — constants here are the single source of
 * truth it reads from.
 */

export const SPOTLIGHT_CONFIG = {
  /** Width of the spotlight in pixels */
  width: 680,
  /** Distance from top of viewport in pixels */
  topOffset: 8,
  /** Z-index for backdrop overlay */
  backdropZIndex: 9998,
  /** Z-index for spotlight container */
  containerZIndex: 9999,
} as const;

// ============ LIMITS ============

export const LIMITS = {
  pageSize: 25,
  quickActionsMax: 25,
  unifiedSearchMax: 25,
  scrollThreshold: 100,
};
