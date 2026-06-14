/**
 * planPreviewView
 *
 * Pure derivation for the plan-doc auto-preview behaviour. Replaces the old
 * "react to a pending plan with an Effect + dedup ref" anti-pattern with a
 * render-time derive-with-user-override model.
 *
 * Model:
 * - `currentPlanId` is the stable, view-independent id of the plan that is
 *   currently pending (null when no plan is pending). It is the keying unit
 *   for user overrides — a non-null value means "a plan is pending".
 * - When a plan is pending we default the replay view to "preview" and the
 *   source/preview toggle to "preview", UNLESS the user has explicitly chosen
 *   a value for THAT exact plan id (an override). A single per-plan intent
 *   object carries both the view and the source/preview choice, each optional —
 *   an undefined field means "no choice made for that facet yet". Overrides
 *   therefore stick while the same plan stays pending and are naturally
 *   discarded the moment a different plan id becomes pending (auto-preview
 *   re-triggers).
 */
import type { MessageViewMode } from "./types";

export interface PlanIntentOverride {
  /** The plan id these choices were made for. */
  planId: string;
  /** The replay view the user explicitly selected for that plan, if any. */
  view?: MessageViewMode;
  /** The source/preview toggle value the user explicitly selected, if any. */
  preview?: boolean;
}

export interface ComputeEffectivePlanViewArgs {
  /** The user's persistent view choice (used when no plan is pending). */
  baseView: MessageViewMode;
  /** Stable id of the pending plan, or null when nothing is pending. */
  currentPlanId: string | null;
  /** The user's per-plan intent override, if any. */
  override: PlanIntentOverride | null;
}

/**
 * Effective replay view:
 * - no pending plan             → the user's base view
 * - view override for this plan → the user's overridden view
 * - otherwise (pending)         → "preview" (auto-open)
 */
export function computeEffectivePlanView({
  baseView,
  currentPlanId,
  override,
}: ComputeEffectivePlanViewArgs): MessageViewMode {
  if (!currentPlanId) return baseView;
  if (
    override &&
    override.planId === currentPlanId &&
    override.view !== undefined
  ) {
    return override.view;
  }
  return "preview";
}

export interface ComputeEffectivePlanPreviewArgs {
  /** Stable id of the pending plan, or null when nothing is pending. */
  currentPlanId: string | null;
  /** The user's per-plan intent override, if any. */
  override: PlanIntentOverride | null;
}

/**
 * Effective source/preview toggle value (true = preview):
 * - preview override for this plan → the user's overridden choice
 * - otherwise                      → "preview" (default whenever a plan shows)
 *
 * The toggle is only surfaced while a plan is pending, so the no-plan case
 * simply falls back to the preview default.
 */
export function computeEffectivePlanPreview({
  currentPlanId,
  override,
}: ComputeEffectivePlanPreviewArgs): boolean {
  if (
    currentPlanId &&
    override &&
    override.planId === currentPlanId &&
    override.preview !== undefined
  ) {
    return override.preview;
  }
  return true;
}
