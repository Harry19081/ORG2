import { describe, expect, it } from "vitest";

import { KEY_SOURCE } from "@src/api/tauri/session";

import {
  type RecentModelEntry,
  recentEntriesEquivalent,
  recordRecentEntry,
} from "../recentModelEntriesAtom";

const entry = (
  modelId: string,
  accountId = "openai-key"
): RecentModelEntry => ({
  modelId,
  sourceType: KEY_SOURCE.OWN,
  accountId,
  accountName: "OpenAI",
  modelType: "codex",
});

describe("recentEntriesEquivalent", () => {
  it("treats variants of one model family on one key as the same selection", () => {
    expect(
      recentEntriesEquivalent(
        entry("gpt-6-astra-medium"),
        entry("gpt-6-astra-low")
      )
    ).toBe(true);
  });

  it("keeps different families and different keys apart", () => {
    expect(
      recentEntriesEquivalent(
        entry("gpt-6-astra-low"),
        entry("gpt-5.6-sol-low")
      )
    ).toBe(false);
    expect(
      recentEntriesEquivalent(
        entry("gpt-6-astra-low", "key-a"),
        entry("gpt-6-astra-low", "key-b")
      )
    ).toBe(false);
  });
});

describe("recordRecentEntry", () => {
  it("replaces an older variant of the same family instead of adding a row", () => {
    const stored = [entry("gpt-5.6-sol-xhigh"), entry("LongCat-2.0", "cat")];
    expect(recordRecentEntry(stored, entry("gpt-5.6-sol-high"))).toEqual([
      entry("gpt-5.6-sol-high"),
      entry("LongCat-2.0", "cat"),
    ]);
  });
});
