// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

import HarnessConnectionsSection from "./HarnessConnectionsSection";

vi.mock("./AppConnectionPage", () => ({
  default: ({ target }: { target: string }) =>
    createElement("div", { "data-testid": "app-page", "data-target": target }),
}));

it("renders one app connection page per section tab", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const render = (activeTab?: string) =>
    act(async () =>
      root.render(createElement(HarnessConnectionsSection, { activeTab }))
    );
  const target = () =>
    container
      .querySelector('[data-testid="app-page"]')
      ?.getAttribute("data-target");
  try {
    // Every app is its own tab; an unknown or absent tab falls back to the CLI.
    for (const [tab, expected] of [
      ["claude-code", "claude_code"],
      ["claude-desktop", "claude_desktop"],
      ["codex", "codex"],
    ]) {
      await render(tab);
      expect(target()).toBe(expected);
    }
    await render(undefined);
    expect(target()).toBe("claude_code");
    // Provider configuration lives in the page's picker — no Advanced view.
    expect(
      container.querySelector('[data-testid="harness-connections-advanced"]')
    ).toBeNull();
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
