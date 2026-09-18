import { describe, expect, it } from "vitest";

import { KEY_SOURCE } from "@src/api/tauri/session";

import { entryMatchesActiveConfig } from "../modelSection";

describe("entryMatchesActiveConfig", () => {
  const entry = {
    modelId: "gpt-6-astra-medium",
    sourceType: KEY_SOURCE.OWN,
    accountId: "openai-key",
    accountName: "OpenAI",
    modelType: "codex" as const,
  };

  it("matches a recent entry holding another variant of the active family", () => {
    expect(
      entryMatchesActiveConfig(entry, {
        model: "gpt-6-astra-low",
        selectedAccountId: "openai-key",
      })
    ).toBe(true);
  });

  it("does not match another family or another key", () => {
    expect(
      entryMatchesActiveConfig(entry, {
        model: "gpt-5.6-sol-low",
        selectedAccountId: "openai-key",
      })
    ).toBe(false);
    expect(
      entryMatchesActiveConfig(entry, {
        model: "gpt-6-astra-low",
        selectedAccountId: "other-key",
      })
    ).toBe(false);
  });
});
