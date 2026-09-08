import { describe, expect, it } from "vitest";

import {
  computeCacheHitRate,
  formatTokenCount,
  resolveContextMaxTokens,
} from "./useContextUsageInfo";

describe("useContextUsageInfo helpers", () => {
  it("formats token counts for context rows", () => {
    expect(formatTokenCount(999)).toBe("999");
    expect(formatTokenCount(12_300)).toBe("12.3K");
    expect(formatTokenCount(1_250_000)).toBe("1.3M");
  });

  it("computes prompt-cache hit rate", () => {
    expect(computeCacheHitRate(0, 0)).toBe(0);
    expect(computeCacheHitRate(90, 10)).toBeCloseTo(0.9, 5);
    expect(computeCacheHitRate(0, 100)).toBe(0);
    // Negative noise is clamped, never produces NaN or a value outside [0,1].
    expect(computeCacheHitRate(-5, -5)).toBe(0);
  });
});

describe("context window provenance", () => {
  it("uses the source window rather than the composer model", () => {
    expect(resolveContextMaxTokens(272000, 1050000, true)).toBe(272000);
  });
  it("does not invent an external window when telemetry is unavailable", () => {
    for (const missing of [null, undefined, 0, -1, NaN]) {
      expect(resolveContextMaxTokens(missing, 200000, true)).toBe(0);
    }
  });
  it("retains the configured fallback for native sessions", () => {
    expect(resolveContextMaxTokens(null, 200000, false)).toBe(200000);
  });
});
