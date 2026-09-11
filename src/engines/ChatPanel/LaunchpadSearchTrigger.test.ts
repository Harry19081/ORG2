// @vitest-environment jsdom
import { Provider, createStore } from "jotai";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

import { spotlightOpenAtom } from "@src/store/ui/uiAtom";

import { LaunchpadSearchTrigger } from "./LaunchpadSearchTrigger";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: () => "Search" }),
}));
vi.mock("@src/components/KeyboardShortcut", () => ({
  KeyboardShortcut: () => null,
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("runs waves only while hovered and stops on hide, click and unmount", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  const removeListener = vi.spyOn(document, "removeEventListener");
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const store = createStore();
  act(() =>
    root.render(
      createElement(Provider, { store }, createElement(LaunchpadSearchTrigger))
    )
  );
  const button = host.querySelector("button")!;
  const hover = () =>
    act(() => {
      button.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    });
  expect(button.hasAttribute("data-wave-active")).toBe(false);
  hover();
  expect(button.dataset.waveActive).toBe("true");
  act(() => {
    button.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
  });
  expect(button.hasAttribute("data-wave-active")).toBe(false);
  hover();
  vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(button.hasAttribute("data-wave-active")).toBe(false);
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  hover();
  act(() => button.click());
  expect(button.hasAttribute("data-wave-active")).toBe(false);
  expect(store.get(spotlightOpenAtom)).toBe(true);
  hover();
  const removalsBeforeUnmount = removeListener.mock.calls.filter(
    ([type]) => type === "visibilitychange"
  ).length;
  act(() => root.unmount());
  expect(
    removeListener.mock.calls.filter(([type]) => type === "visibilitychange")
      .length
  ).toBe(removalsBeforeUnmount + 1);
  host.remove();
});
