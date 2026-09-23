import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import CiCheckStateIcon from "./CiCheckStateIcon";
import PrCiStatusIndicator from "./PrCiStatusIndicator";

describe("pending CI presentation", () => {
  it("uses the same orange breathing dot for individual checks and PR rollups", () => {
    const check = renderToStaticMarkup(
      createElement(CiCheckStateIcon, { state: "pending", size: 13 })
    );
    const rollup = renderToStaticMarkup(
      createElement(PrCiStatusIndicator, {
        status: "pending",
        label: "Checks running",
      })
    );

    for (const markup of [check, rollup]) {
      expect(markup).toContain('data-icon="pending-dot"');
      expect(markup).toContain("animate-agent-pulse");
      expect(markup).toContain("bg-warning-6");
      expect(markup).toContain("motion-reduce:animate-none");
      expect(markup).not.toContain("animate-spin");
    }
    expect(check).toContain("width:13px;height:13px");
  });

  it("keeps completed and failed checks as verdict icons", () => {
    for (const state of ["success", "failure"] as const) {
      const markup = renderToStaticMarkup(
        createElement(CiCheckStateIcon, { state })
      );
      expect(markup).not.toContain('data-icon="pending-dot"');
    }
  });
});
