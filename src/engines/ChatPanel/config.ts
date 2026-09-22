/**
 * ChatPanel Configuration Constants
 */

// CSS variable for chat width
export const CHAT_WIDTH_CSS_VAR = "--orgii-chat-width";

// Width written only while the divider is dragged, on the elements that size
// the pane. Registered non-inherited in index.scss: a per-frame write to the
// inherited root variable restyles every element in the app.
export const CHAT_LIVE_WIDTH_CSS_VAR = "--orgii-chat-live-width";
export const CHAT_WIDTH_STYLE_VALUE = `var(${CHAT_LIVE_WIDTH_CSS_VAR}, var(${CHAT_WIDTH_CSS_VAR}))`;

// Resize constraints
export const MIN_WIDTH = 420;
export const LEFT_PANEL_WIDTH = 64; // Navigation sidebar width
export const CHAT_PANEL_LAYOUT_GUTTER = 20;

/**
 * Presets for `general.chatPaneSplitRatio` — the share of the workbench the
 * chat pane takes, with the station (My Station / Agent Station) keeping the
 * rest. The preset is a *default*, not a constraint: it seeds the width on
 * first run and is re-applied the moment the user picks one, after which the
 * divider can still be dragged to any width in [MIN_WIDTH, getChatMaxWidth()].
 */
export const CHAT_SPLIT_RATIOS = {
  "one-third": 1 / 3,
  "two-fifths": 2 / 5,
  half: 1 / 2,
  "three-fifths": 3 / 5,
} as const;

export type ChatSplitRatio = keyof typeof CHAT_SPLIT_RATIOS;

/** Menu order, narrowest chat pane first. */
export const CHAT_SPLIT_RATIO_VALUES = [
  "one-third",
  "two-fifths",
  "half",
  "three-fifths",
] as const satisfies readonly ChatSplitRatio[];

/**
 * Fraction glyphs, used as the segmented-control labels. Digits and a solidus
 * read the same in every locale, so these are not translated.
 */
export const CHAT_SPLIT_RATIO_LABELS: Record<ChatSplitRatio, string> = {
  "one-third": "1/3",
  "two-fifths": "2/5",
  half: "1/2",
  "three-fifths": "3/5",
};

/**
 * Closest preset to the historical fixed 520px default on a typical window,
 * so an install that has never touched the setting keeps the layout it had.
 */
export const DEFAULT_CHAT_SPLIT_RATIO: ChatSplitRatio = "two-fifths";

/** The drag ceiling is the widest preset, so every preset stays reachable. */
export const MAX_WIDTH_RATIO = CHAT_SPLIT_RATIOS["three-fifths"];

/** Width the station and the chat pane divide between them. */
function getChatAvailableWidth(viewportWidth?: number): number {
  const width =
    viewportWidth ??
    (typeof window !== "undefined" ? window.innerWidth : MIN_WIDTH * 2);
  return Math.max(
    MIN_WIDTH,
    width - LEFT_PANEL_WIDTH - CHAT_PANEL_LAYOUT_GUTTER
  );
}

export function getChatMaxWidth(viewportWidth?: number): number {
  return Math.max(
    MIN_WIDTH,
    Math.floor(getChatAvailableWidth(viewportWidth) * MAX_WIDTH_RATIO)
  );
}

/** The pane width a preset asks for, clamped to the resize constraints. */
export function getChatWidthForRatio(
  ratio: ChatSplitRatio,
  viewportWidth?: number
): number {
  return clampVisibleChatWidth(
    Math.round(getChatAvailableWidth(viewportWidth) * CHAT_SPLIT_RATIOS[ratio]),
    viewportWidth
  );
}

export function clampVisibleChatWidth(
  value: number,
  viewportWidth?: number
): number {
  return Math.min(Math.max(value, MIN_WIDTH), getChatMaxWidth(viewportWidth));
}

export function clampChatWidth(value: number, viewportWidth?: number): number {
  return value > 0 ? clampVisibleChatWidth(value, viewportWidth) : value;
}

// Timing constants
export const RAPID_CLICK_THRESHOLD_MS = 300;
