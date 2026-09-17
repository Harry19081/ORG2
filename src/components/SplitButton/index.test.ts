import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import SplitButton from ".";

type SplitVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "warning"
  | "success"
  | "merged";

function renderSplitButton(variant: SplitVariant, menuOpen = false): string {
  return renderToStaticMarkup(
    React.createElement(
      SplitButton,
      {
        variant,
        menu: React.createElement("div", { "data-testid": "menu" }),
        menuOpen,
        onMenuButtonClick: vi.fn(),
        menuButtonLabel: "More actions",
      },
      "Action"
    )
  );
}

function menuButtonClassName(markup: string): string {
  const buttonClassNames = [...markup.matchAll(/<button[^>]*class="([^"]*)"/g)];
  return buttonClassNames.at(-1)?.[1] ?? "";
}

describe("SplitButton", () => {
  it("uses the success tone while hovered or open", () => {
    expect(menuButtonClassName(renderSplitButton("success"))).toContain(
      "enabled:hover:bg-success-5"
    );
    expect(menuButtonClassName(renderSplitButton("success", true))).toContain(
      "bg-success-5 enabled:hover:bg-success-5"
    );
  });

  it("uses GitHub purple for the merged variant and its open state", () => {
    expect(menuButtonClassName(renderSplitButton("merged"))).toContain(
      "enabled:hover:bg-merged-hover"
    );
    expect(menuButtonClassName(renderSplitButton("merged", true))).toContain(
      "bg-merged-hover enabled:hover:bg-merged-hover"
    );
  });

  it.each([
    ["primary", "primary"],
    ["danger", "danger"],
    ["warning", "warning"],
  ] as const)("uses the %s tone for its semantic variant", (variant, tone) => {
    expect(menuButtonClassName(renderSplitButton(variant))).toContain(
      `enabled:hover:bg-${tone}-5`
    );
  });

  it("keeps neutral solid split buttons neutral", () => {
    expect(menuButtonClassName(renderSplitButton("secondary"))).toContain(
      "enabled:hover:bg-fill-3"
    );
  });

  it("keeps the main segment light while the menu segment has a stronger hover fill", () => {
    const markup = renderToStaticMarkup(
      React.createElement(SplitButton, {
        variant: "tertiary",
        appearance: "soft-no-drop",
        menu: React.createElement("div"),
        menuOpen: false,
        onMenuButtonClick: vi.fn(),
        menuButtonLabel: "Choose shell",
      })
    );
    const classes = [...markup.matchAll(/<button[^>]*class="([^"]*)"/g)];
    expect(classes).toHaveLength(2);
    expect(classes[0][1]).toContain(
      "group-hover/button-split:bg-button-hover-no-drop"
    );
    expect(classes[0][1]).toContain("btn-hover:bg-button-hover-no-drop");
    // The menu segment's own stronger fill is a caller class, so it overrides
    // the soft-no-drop default the underlying Button still emits.
    const menuClasses = classes[1][1].split(" ");
    expect(menuClasses).toContain("enabled:hover:bg-button-hover");
    expect(menuClasses).toContain("focus-visible:bg-button-hover");
    expect(menuClasses).not.toContain("enabled:hover:bg-button-hover-no-drop");
  });

  it.each([false, true])(
    "retains open highlights only while enabled (disabled=%s)",
    (disabled) => {
      const markup = renderToStaticMarkup(
        React.createElement(SplitButton, {
          variant: "tertiary",
          appearance: "soft-no-drop",
          menu: React.createElement("div"),
          menuOpen: true,
          disabled,
          onMenuButtonClick: vi.fn(),
          menuButtonLabel: "Choose shell",
        })
      );
      const classes = [...markup.matchAll(/<button[^>]*class="([^"]*)"/g)];
      const mainClasses = classes[0][1].split(" ");
      const menuClasses = classes[1][1].split(" ");
      expect(mainClasses.includes("bg-button-hover-no-drop!")).toBe(!disabled);
      expect(mainClasses.includes("text-primary-6!")).toBe(!disabled);
      expect(menuClasses.includes("bg-button-hover")).toBe(!disabled);
      expect(menuClasses.includes("text-primary-6")).toBe(!disabled);
    }
  );

  it("puts menu semantics and the accessible name on the menu trigger", () => {
    const markup = renderSplitButton("primary", true);
    const buttons = [...markup.matchAll(/<button([^>]*)>/g)];
    const mainButton = buttons[0]?.[1] ?? "";
    const menuButton = buttons[1]?.[1] ?? "";

    expect(mainButton).not.toContain("aria-expanded");
    expect(menuButton).toContain('aria-label="More actions"');
    expect(menuButton).toContain('aria-haspopup="menu"');
    expect(menuButton).toContain('aria-expanded="true"');
  });

  it("renders the controlled menu only while open", () => {
    expect(renderSplitButton("primary")).not.toContain('data-testid="menu"');
    expect(renderSplitButton("primary", true)).toContain('data-testid="menu"');
  });

  it("disables both segments while loading", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        SplitButton,
        {
          loading: true,
          menu: React.createElement("div"),
          menuOpen: false,
          onMenuButtonClick: vi.fn(),
          menuButtonLabel: "More actions",
        },
        "Action"
      )
    );

    expect([...markup.matchAll(/<button[^>]* disabled=""/g)]).toHaveLength(2);
  });

  it("preserves explicit icon-only segment widths", () => {
    const markup = renderToStaticMarkup(
      React.createElement(SplitButton, {
        iconOnly: true,
        icon: React.createElement("span"),
        mainSegmentWidth: 40,
        menuSegmentWidth: 20,
        menu: React.createElement("div"),
        menuOpen: false,
        onMenuButtonClick: vi.fn(),
        menuButtonLabel: "More actions",
      })
    );

    expect(markup).toContain("width:60px");
    expect(markup).toContain("width:20px");
  });
});
