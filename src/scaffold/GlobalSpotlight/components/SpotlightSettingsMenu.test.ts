// @vitest-environment jsdom
import { Provider, createStore } from "jotai";
import React, { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  spotlightCommandPinsAtom,
  spotlightDirectoryPinsAtom,
} from "@src/store/ui/spotlightPinsAtom";

import { SpotlightSettingsMenu } from "./SpotlightSettingsMenu";

const mocks = vi.hoisted(() => ({ setDim: vi.fn() }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@src/hooks/settings/useSettings", () => ({
  useSetting: () => [true, mocks.setDim],
}));

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe("SpotlightSettingsMenu", () => {
  let container: HTMLDivElement;
  let root: Root;
  let store: ReturnType<typeof createStore>;

  const render = () =>
    act(() => {
      root.render(
        React.createElement(
          Provider,
          { store },
          React.createElement(SpotlightSettingsMenu)
        )
      );
    });
  const menu = () =>
    document.querySelector<HTMLElement>(
      '[data-testid="spotlight-settings-menu"]'
    );
  const openMenu = () =>
    act(() => {
      document
        .querySelector<HTMLButtonElement>(
          '[data-testid="spotlight-settings-button"]'
        )!
        .click();
    });

  beforeEach(() => {
    localStorage.clear();
    store = createStore();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    mocks.setDim.mockReset();
  });

  it("opens the menu with placement, dim and unpin controls", () => {
    render();
    expect(menu()).toBeNull();
    openMenu();
    const text = menu()?.textContent ?? "";
    expect(text).toContain("general.spotlightPlacement");
    expect(text).toContain("general.spotlightDimBackground");
    expect(text).toContain("selectors.spotlightFooter.unpinAll");
  });

  it("unpin all clears both command and directory pins", () => {
    store.set(spotlightCommandPinsAtom, ["cmd-a", "cmd-b"]);
    store.set(spotlightDirectoryPinsAtom, ["/repo"]);
    render();
    openMenu();
    const unpin = Array.from(
      menu()!.querySelectorAll<HTMLButtonElement>("button, [role=menuitem]")
    ).find((node) =>
      node.textContent?.includes("selectors.spotlightFooter.unpinAll")
    )!;
    act(() => unpin.click());
    expect(store.get(spotlightCommandPinsAtom)).toEqual([]);
    expect(store.get(spotlightDirectoryPinsAtom)).toEqual([]);
    expect(menu()).toBeNull();
  });

  it("disables unpin all when nothing is pinned", () => {
    render();
    openMenu();
    const unpin = Array.from(
      menu()!.querySelectorAll<HTMLElement>("button, [role=menuitem]")
    ).find((node) =>
      node.textContent?.includes("selectors.spotlightFooter.unpinAll")
    )!;
    expect(
      unpin.hasAttribute("disabled") ||
        unpin.getAttribute("aria-disabled") === "true"
    ).toBe(true);
  });

  it("Escape closes only the menu, not Spotlight", () => {
    // Stands in for SpotlightShellChrome's bubble-phase Escape handler.
    const spotlightEscape = vi.fn();
    document.addEventListener("keydown", spotlightEscape);
    try {
      render();
      openMenu();
      act(() => {
        document.activeElement!.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
        );
      });
      expect(menu()).toBeNull();
      expect(spotlightEscape).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener("keydown", spotlightEscape);
    }
  });
});
