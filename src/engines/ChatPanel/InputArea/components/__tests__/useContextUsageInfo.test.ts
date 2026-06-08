import { describe, expect, it } from "vitest";

import { formatTokenCount } from "../useContextUsageInfo";

describe("useContextUsageInfo helpers", () => {
  it("formats token counts for context rows", () => {
    expect(formatTokenCount(999)).toBe("999");
    expect(formatTokenCount(12_300)).toBe("12.3K");
    expect(formatTokenCount(1_250_000)).toBe("1.3M");
  });
});
