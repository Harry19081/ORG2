// @vitest-environment jsdom
import { createInstance } from "i18next";
import { Provider, createStore } from "jotai";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { beforeAll, describe, expect, it, vi } from "vitest";

import enSessions from "@src/i18n/locales/en/sessions.json";
import { workStationEditorSecondaryCollapsedAtom } from "@src/store/ui/workStationLayout/bottomPanelAtoms";
import { perAppStatusBarCallbacksAtom } from "@src/store/ui/workStationLayout/statusBarAtoms";

import { TabBarBottomPanelToggle } from "./TabBarTrailingControls";

vi.mock("@src/components/Tooltip", () => ({
  default: ({
    children,
    content,
  }: {
    children: React.ReactNode;
    content: React.ReactNode;
  }) =>
    createElement(
      "div",
      null,
      children,
      createElement("span", { "data-testid": "tooltip-content" }, content)
    ),
}));

describe("TabBarBottomPanelToggle", () => {
  const i18n = createInstance();

  beforeAll(async () => {
    await i18n.use(initReactI18next).init({
      lng: "en",
      fallbackLng: false,
      defaultNS: "sessions",
      ns: ["sessions"],
      resources: { en: { sessions: enSessions } },
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    });
  });

  it("uses the localized bottom-panel label", () => {
    const store = createStore();
    store.set(workStationEditorSecondaryCollapsedAtom, true);
    store.set(perAppStatusBarCallbacksAtom, {
      code: { onToggleBottomPanel: vi.fn() },
      browser: {},
      project: {},
    });

    const markup = renderToStaticMarkup(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(
          Provider,
          { store },
          createElement(TabBarBottomPanelToggle)
        )
      )
    );

    expect(markup).not.toContain('title="Show bottom panel"');
    const host = document.createElement("div");
    host.innerHTML = markup;
    expect(
      host.querySelector('[data-testid="tooltip-content"]')?.textContent
    ).toBe("Show bottom panel");
    expect(markup).toContain('aria-label="Show bottom panel"');
    expect(markup).not.toContain("titleBar.showBottomPanel");
  });
});
