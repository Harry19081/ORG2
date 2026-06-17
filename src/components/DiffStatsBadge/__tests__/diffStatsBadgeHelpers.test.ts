import { describe, expect, it } from "vitest";

import {
  DIFF_STATS_SIZE_CLASSES,
  type DiffStatsBadgeSize,
  getDiffStatsSizeClass,
} from "../diffStatsBadgeHelpers";

describe("getDiffStatsSizeClass", () => {
  it("maps each named size to its font-size class", () => {
    expect(getDiffStatsSizeClass("xs")).toBe("text-[11px]");
    expect(getDiffStatsSizeClass("sm")).toBe("text-[12px]");
    expect(getDiffStatsSizeClass("md")).toBe("text-[13px]");
  });

  it("emits no class for the explicit inherit size", () => {
    expect(getDiffStatsSizeClass("inherit")).toBe("");
  });

  it("defaults to inherit (no class) when size is undefined", () => {
    expect(getDiffStatsSizeClass()).toBe("");
    expect(getDiffStatsSizeClass(undefined)).toBe("");
  });

  it("falls back to inherit for unknown values", () => {
    const unknown = "lg" as unknown as DiffStatsBadgeSize;
    expect(getDiffStatsSizeClass(unknown)).toBe("");
  });

  it("keeps every mapped class as a single token (no accidental spaces)", () => {
    for (const cls of Object.values(DIFF_STATS_SIZE_CLASSES)) {
      expect(cls.trim()).toBe(cls);
      expect(cls.split(" ").filter(Boolean).length).toBeLessThanOrEqual(1);
    }
  });

  it("reuses the established 11px/12px diff-stat scale", () => {
    expect(DIFF_STATS_SIZE_CLASSES.xs).toContain("11px");
    expect(DIFF_STATS_SIZE_CLASSES.sm).toContain("12px");
  });
});
