// @vitest-environment jsdom
import { Provider, createStore } from "jotai";
import React, { act, useState } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TUTORIALS } from "@src/scaffold/Tutorials/tutorialRegistry";

import OnboardingModal from "./OnboardingModal";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("OnboardingModal", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    function Host() {
      const [open, setOpen] = useState(true);
      return React.createElement(
        React.Fragment,
        null,
        React.createElement(
          "button",
          { onClick: () => setOpen(true), "data-testid": "reopen" },
          "Reopen"
        ),
        React.createElement(OnboardingModal, {
          open,
          onClose: () => setOpen(false),
        })
      );
    }
    act(() =>
      root.render(
        React.createElement(
          Provider,
          { store: createStore() },
          React.createElement(Host)
        )
      )
    );
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.resetAllMocks();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  });
  function click(id: string) {
    const button = document.querySelector<HTMLButtonElement>(
      `[data-testid="${id}"]`
    );
    expect(button?.tagName).toBe("BUTTON");
    act(() => button!.click());
  }
  it("uses the shared image-modal treatment with decorative onboarding artwork", () => {
    const image = document.querySelector<HTMLImageElement>(
      ".liquid-modal-image"
    );

    expect(image).not.toBeNull();
    expect(image?.getAttribute("src")).toContain("onboarding.png");
    expect(image?.getAttribute("alt")).toBe("");
  });
  it("shows tutorials without the legacy quick-action cards", () => {
    expect(
      document.querySelector('[data-testid="onboarding-start-session"]')
    ).toBeNull();
    expect(
      document.querySelector('[data-testid="onboarding-working-directories"]')
    ).toBeNull();
    expect(
      document.querySelector('[data-testid="onboarding-workspace"]')
    ).toBeNull();

    for (const tutorial of TUTORIALS) {
      expect(
        document.querySelector(`[data-testid="onboarding-tour-${tutorial.id}"]`)
      ).not.toBeNull();
    }
  });
  it.each(TUTORIALS)("launches the $id tour after closing", (tutorial) => {
    const listener = vi.fn(() =>
      expect(document.querySelector('[role="dialog"]')).toBeNull()
    );
    window.addEventListener(tutorial.eventName, listener);
    try {
      click(`onboarding-tour-${tutorial.id}`);
      expect(listener).toHaveBeenCalledOnce();
    } finally {
      window.removeEventListener(tutorial.eventName, listener);
    }
  });
  it("can be dismissed with Escape and reopened with all cards available", () => {
    act(() =>
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      )
    );
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    click("reopen");
    expect(
      document.querySelector(
        `[data-testid="onboarding-tour-${TUTORIALS[0].id}"]`
      )
    ).not.toBeNull();
  });
});
