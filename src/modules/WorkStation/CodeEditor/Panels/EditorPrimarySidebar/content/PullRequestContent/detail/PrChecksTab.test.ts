import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { useTestTranslation } from "@src/test/i18nTestTranslate";

import { PrChecksTab } from "./PrChecksTab";

vi.mock("react-i18next", () => ({
  useTranslation: (...args: Parameters<typeof useTestTranslation>) =>
    useTestTranslation(...args),
}));

describe("PrChecksTab", () => {
  it("shows the orange breathing dot while checks load", () => {
    const markup = renderToStaticMarkup(
      createElement(PrChecksTab, { checks: null, loading: true })
    );

    expect(markup).toContain('data-testid="pr-checks-loading"');
    expect(markup).toContain('role="status"');
    expect(markup).toContain('data-icon="pending-dot"');
    expect(markup).toContain("bg-warning-6");
    expect(markup).not.toContain("animate-spin");
  });
});
