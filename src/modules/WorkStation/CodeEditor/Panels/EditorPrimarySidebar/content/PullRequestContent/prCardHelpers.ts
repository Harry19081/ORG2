/**
 * Pure presentation helpers for the sidebar PR summary card.
 *
 * These are intentionally free of React / i18n so they can be unit-tested in
 * isolation (see __tests__/prCardHelpers.test.ts). The component layer maps
 * the returned class strings / labels onto design-system tokens and t(...).
 */

/** Visual variant (badge + status dot) for a normalized PR status. */
export interface PrStatusVariant {
  /** Tailwind classes for the badge pill background + text color. */
  badgeClass: string;
  /** Tailwind classes for the small leading status dot. */
  dotClass: string;
}

/**
 * Semantic colors per PR state. Kept in sync with the WorkItems `PrSection`
 * mapping so PR status reads consistently across the app:
 *   open → success (green), merged → primary, closed → danger (red),
 *   draft → warning (amber).
 */
const PR_STATUS_VARIANTS: Record<string, PrStatusVariant> = {
  open: { badgeClass: "bg-success-1 text-success-6", dotClass: "bg-success-6" },
  merged: {
    badgeClass: "bg-primary-1 text-primary-6",
    dotClass: "bg-primary-6",
  },
  closed: { badgeClass: "bg-danger-1 text-danger-6", dotClass: "bg-danger-6" },
  draft: {
    badgeClass: "bg-warning-1 text-warning-6",
    dotClass: "bg-warning-6",
  },
};

/** Neutral fallback for unknown / custom states (e.g. "pending_review"). */
const FALLBACK_STATUS_VARIANT: PrStatusVariant = {
  badgeClass: "bg-fill-2 text-text-3",
  dotClass: "bg-text-3",
};

/** Resolve a normalized status key to its badge + dot classes. */
export function getPrStatusVariant(statusKey: string): PrStatusVariant {
  return PR_STATUS_VARIANTS[statusKey] ?? FALLBACK_STATUS_VARIANT;
}

/**
 * Format an additions / deletions / files count for display.
 *
 * - Truncates to an integer and inserts thousands separators.
 * - Negative inputs keep their sign (callers add the leading +/- glyph).
 * - Non-finite / NaN inputs collapse to "0" so the card never shows "NaN".
 */
export function formatStatNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.trunc(value);
  const sign = rounded < 0 ? "-" : "";
  const abs = Math.abs(rounded).toString();
  return sign + abs.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Hard cap on a branch label's character length as a safety net for
 * pathologically long names. Normal responsive truncation is handled by CSS
 * (`truncate`); this prevents enormous DOM text nodes and keeps the full name
 * available via the `title` tooltip.
 */
export function truncateBranchLabel(branch: string, max = 80): string {
  const trimmed = (branch ?? "").trim();
  if (trimmed.length <= max) return trimmed;
  if (max <= 1) return "…";
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}
