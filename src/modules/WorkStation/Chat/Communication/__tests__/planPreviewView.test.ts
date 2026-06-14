/**
 * Unit tests for the plan-doc auto-preview derivation (planPreviewView.ts).
 *
 * These cover the behaviour that previously lived in an Effect + dedup ref:
 * auto-open to preview when a plan pends, sticky user overrides while the same
 * plan is pending, re-triggering for a new plan id, and falling back to the
 * base view once the plan resolves.
 */
import { describe, expect, it } from "vitest";

import {
  type PlanIntentOverride,
  computeEffectivePlanPreview,
  computeEffectivePlanView,
} from "../planPreviewView";
import type { MessageViewMode } from "../types";

function viewOverride(
  overrides: Partial<PlanIntentOverride> = {}
): PlanIntentOverride {
  return { planId: "plan-A", view: "chat", ...overrides };
}

function previewOverride(
  overrides: Partial<PlanIntentOverride> = {}
): PlanIntentOverride {
  return { planId: "plan-A", preview: false, ...overrides };
}

describe("computeEffectivePlanView", () => {
  it("returns the base view when no plan is pending", () => {
    expect(
      computeEffectivePlanView({
        baseView: "chat",
        currentPlanId: null,
        override: null,
      })
    ).toBe("chat");
  });

  it("preserves a non-chat base view when no plan is pending", () => {
    const bases: MessageViewMode[] = [
      "chat",
      "think",
      "todo",
      "interaction",
      "preview",
    ];
    for (const base of bases) {
      expect(
        computeEffectivePlanView({
          baseView: base,
          currentPlanId: null,
          override: null,
        })
      ).toBe(base);
    }
  });

  it("auto-opens to preview when a plan is pending and there is no override", () => {
    expect(
      computeEffectivePlanView({
        baseView: "chat",
        currentPlanId: "plan-A",
        override: null,
      })
    ).toBe("preview");
  });

  it("honours a user override for the currently pending plan (sticks)", () => {
    expect(
      computeEffectivePlanView({
        baseView: "chat",
        currentPlanId: "plan-A",
        override: viewOverride({ planId: "plan-A", view: "chat" }),
      })
    ).toBe("chat");
  });

  it("keeps honouring the override regardless of base view churn", () => {
    // Base view flipping to "preview" (e.g. user navigated through preview)
    // must not dislodge an override that targets the same pending plan.
    expect(
      computeEffectivePlanView({
        baseView: "preview",
        currentPlanId: "plan-A",
        override: viewOverride({ planId: "plan-A", view: "interaction" }),
      })
    ).toBe("interaction");
  });

  it("re-triggers auto preview when a new plan id becomes pending", () => {
    // Override was recorded for plan-A; a different plan pends now.
    expect(
      computeEffectivePlanView({
        baseView: "chat",
        currentPlanId: "plan-B",
        override: viewOverride({ planId: "plan-A", view: "chat" }),
      })
    ).toBe("preview");
  });

  it("falls back to the base view once the plan resolves", () => {
    expect(
      computeEffectivePlanView({
        baseView: "interaction",
        currentPlanId: null,
        override: viewOverride({ planId: "plan-A", view: "chat" }),
      })
    ).toBe("interaction");
  });

  it("auto-opens to preview when the intent only carries a preview choice", () => {
    // A preview-only intent (no view chosen yet) must not affect the view: it
    // still auto-opens to preview for the pending plan.
    expect(
      computeEffectivePlanView({
        baseView: "chat",
        currentPlanId: "plan-A",
        override: previewOverride({ planId: "plan-A", preview: false }),
      })
    ).toBe("preview");
  });
});

describe("computeEffectivePlanPreview", () => {
  it("defaults to preview (true) when a plan is pending with no override", () => {
    expect(
      computeEffectivePlanPreview({ currentPlanId: "plan-A", override: null })
    ).toBe(true);
  });

  it("honours a source override for the currently pending plan (sticks)", () => {
    expect(
      computeEffectivePlanPreview({
        currentPlanId: "plan-A",
        override: previewOverride({ planId: "plan-A", preview: false }),
      })
    ).toBe(false);
  });

  it("re-defaults to preview when a new plan id becomes pending", () => {
    expect(
      computeEffectivePlanPreview({
        currentPlanId: "plan-B",
        override: previewOverride({ planId: "plan-A", preview: false }),
      })
    ).toBe(true);
  });

  it("ignores a stale override and defaults to preview when nothing is pending", () => {
    expect(
      computeEffectivePlanPreview({
        currentPlanId: null,
        override: previewOverride({ planId: "plan-A", preview: false }),
      })
    ).toBe(true);
  });

  it("defaults to preview when the intent only carries a view choice", () => {
    // A view-only intent (no preview chosen yet) must not affect the toggle: it
    // still defaults to preview for the pending plan.
    expect(
      computeEffectivePlanPreview({
        currentPlanId: "plan-A",
        override: viewOverride({ planId: "plan-A", view: "chat" }),
      })
    ).toBe(true);
  });
});
