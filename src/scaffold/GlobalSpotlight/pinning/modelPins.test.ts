import { describe, expect, it } from "vitest";

import { KEY_SOURCE } from "@src/api/tauri/session";
import type { RecentModelEntry } from "@src/store/session/recentModelEntriesAtom";
import { MAX_SPOTLIGHT_MODEL_PINS } from "@src/store/ui/spotlightPinsAtom";

import { isModelPinned, toggleModelPin } from "./modelPins";

const entry = (modelId: string, accountId = "key"): RecentModelEntry => ({
  modelId,
  sourceType: KEY_SOURCE.OWN,
  accountId,
  accountName: "OpenAI",
  modelType: "codex",
});

describe("toggleModelPin", () => {
  it("pins a selection and unpins it from any variant of the same family", () => {
    const pinned = toggleModelPin([], entry("gpt-6-astra-low"));
    expect(pinned).toEqual([entry("gpt-6-astra-low")]);
    expect(isModelPinned(pinned, entry("gpt-6-astra-high"))).toBe(true);
    expect(toggleModelPin(pinned, entry("gpt-6-astra-high"))).toEqual([]);
  });

  it("keeps the same model on another key as a separate pin", () => {
    const pinned = toggleModelPin(
      [entry("gpt-6-astra-low", "a")],
      entry("gpt-6-astra-low", "b")
    );
    expect(pinned).toHaveLength(2);
  });

  it("stops adding pins at the cap", () => {
    const full = Array.from({ length: MAX_SPOTLIGHT_MODEL_PINS }, (_, index) =>
      entry(`model-${index}`)
    );
    expect(toggleModelPin(full, entry("one-more"))).toEqual(full);
  });
});
