import { describe, expect, it } from "vitest";

import {
  formatStatNumber,
  getPrStatusVariant,
  truncateBranchLabel,
} from "../prCardHelpers";

describe("getPrStatusVariant", () => {
  it("maps each known status to its semantic badge + dot classes", () => {
    expect(getPrStatusVariant("open")).toEqual({
      badgeClass: "bg-success-1 text-success-6",
      dotClass: "bg-success-6",
    });
    expect(getPrStatusVariant("merged")).toEqual({
      badgeClass: "bg-primary-1 text-primary-6",
      dotClass: "bg-primary-6",
    });
    expect(getPrStatusVariant("closed")).toEqual({
      badgeClass: "bg-danger-1 text-danger-6",
      dotClass: "bg-danger-6",
    });
    expect(getPrStatusVariant("draft")).toEqual({
      badgeClass: "bg-warning-1 text-warning-6",
      dotClass: "bg-warning-6",
    });
  });

  it("falls back to a neutral variant for unknown states", () => {
    expect(getPrStatusVariant("pending_review")).toEqual({
      badgeClass: "bg-fill-2 text-text-3",
      dotClass: "bg-text-3",
    });
  });

  it("falls back to a neutral variant for an empty key", () => {
    expect(getPrStatusVariant("")).toEqual({
      badgeClass: "bg-fill-2 text-text-3",
      dotClass: "bg-text-3",
    });
  });
});

describe("formatStatNumber", () => {
  it("returns 0 for zero", () => {
    expect(formatStatNumber(0)).toBe("0");
  });

  it("formats small numbers without separators", () => {
    expect(formatStatNumber(45)).toBe("45");
    expect(formatStatNumber(104)).toBe("104");
    expect(formatStatNumber(999)).toBe("999");
  });

  it("inserts thousands separators for large numbers", () => {
    expect(formatStatNumber(1000)).toBe("1,000");
    expect(formatStatNumber(12345)).toBe("12,345");
    expect(formatStatNumber(1000000)).toBe("1,000,000");
  });

  it("truncates fractional values to integers", () => {
    expect(formatStatNumber(104.9)).toBe("104");
    expect(formatStatNumber(-45.9)).toBe("-45");
  });

  it("preserves the sign for negative numbers", () => {
    expect(formatStatNumber(-45)).toBe("-45");
    expect(formatStatNumber(-12345)).toBe("-12,345");
  });

  it("collapses non-finite / NaN inputs to 0", () => {
    expect(formatStatNumber(Number.NaN)).toBe("0");
    expect(formatStatNumber(Number.POSITIVE_INFINITY)).toBe("0");
    expect(formatStatNumber(Number.NEGATIVE_INFINITY)).toBe("0");
  });
});

describe("truncateBranchLabel", () => {
  it("returns short branch names unchanged", () => {
    expect(truncateBranchLabel("test/pr-system-check")).toBe(
      "test/pr-system-check"
    );
  });

  it("trims surrounding whitespace", () => {
    expect(truncateBranchLabel("  feat/x  ")).toBe("feat/x");
  });

  it("returns an empty string for empty / nullish input", () => {
    expect(truncateBranchLabel("")).toBe("");
    expect(truncateBranchLabel(undefined as unknown as string)).toBe("");
  });

  it("caps very long branch names with an ellipsis", () => {
    const long = `feature/${"x".repeat(200)}`;
    const result = truncateBranchLabel(long);
    expect(result).toHaveLength(80);
    expect(result.endsWith("…")).toBe(true);
  });

  it("respects a custom max length", () => {
    expect(truncateBranchLabel("feature/long-branch", 8)).toBe("feature…");
  });

  it("returns just an ellipsis when max is degenerate", () => {
    expect(truncateBranchLabel("anything", 1)).toBe("…");
  });
});
