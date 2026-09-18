// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { BUTTON_VARIANT } from "@src/config/workstation/tokens";

import Button from ".";

function readThemeColor(css: string, token: string): string {
  const match = css.match(
    new RegExp(`--color-${token}:\\s*(#[0-9a-f]{6})`, "i")
  );
  if (!match?.[1]) throw new Error(`Missing theme color: ${token}`);
  return match[1];
}

function relativeLuminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255);
  if (!channels || channels.length !== 3) return 0;
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
}

describe("Button", () => {
  it("uses GitHub purple for the merged variant", () => {
    const markup = renderToStaticMarkup(
      React.createElement(Button, { variant: "merged" }, "Merged")
    );
    expect(markup).toContain("bg-merged");
    expect(markup).toContain("text-merged-contrast");
  });

  it("keeps icon + label centered as one group by default", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        Button,
        { icon: React.createElement("i", null), long: true },
        "Close"
      )
    );
    expect(markup).not.toContain("right-full");
    expect(markup).toContain("mr-2");
  });

  it("lifts the icon out of flow so centerLabel centers the label alone", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        Button,
        { icon: React.createElement("i", null), long: true, centerLabel: true },
        "Close"
      )
    );
    // Icon anchored to the label's left edge (right: 100%) plus its mr-2 gap,
    // so only the label participates in the button's centering.
    expect(markup).toContain("absolute inset-y-0 inline-flex items-center");
    expect(markup).toContain("right-full");
  });

  it("keeps a right-positioned icon out of flow under centerLabel", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        Button,
        {
          icon: React.createElement("i", null),
          iconPosition: "right",
          long: true,
          centerLabel: true,
        },
        "Close"
      )
    );
    expect(markup).toContain("left-full");
    expect(markup).not.toContain("right-full");
  });

  it.each(["orgii_main.css", "orgii_dark.css"])(
    "keeps merged button states readable in %s",
    (themeFile) => {
      const css = readFileSync(resolve("public", themeFile), "utf8");
      const foreground = readThemeColor(css, "merged-button-contrast");

      for (const token of [
        "merged-button-bg",
        "merged-button-hover",
        "merged-button-active",
      ]) {
        expect(
          contrastRatio(foreground, readThemeColor(css, token)),
          `${themeFile} ${token}`
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  );
});

describe("compact shared actions", () => {
  beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });
  afterAll(() => {
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  });
  it("renders the sidebar icon at 20px with the shared small radius", () => {
    const markup = renderToStaticMarkup(
      React.createElement(Button, {
        size: "sidebar",
        variant: "tertiary",
        appearance: "soft",
        iconOnly: true,
        icon: React.createElement("svg", { "data-testid": "action-icon" }),
        "aria-label": "Stage file",
      })
    );
    expect(markup).toContain("height:20px");
    expect(markup).toContain("width:20px");
    expect(markup).toContain("border-radius:var(--radius-sm)");
    expect(markup).toContain("action-icon");
    expect(markup).toContain("btn-hover:bg-fill-2");
    expect(markup).not.toContain("bg-button-hover-no-drop");
    expect(markup).not.toContain("hover:bg-primary-3");
  });

  it("opts transparent controls into fill-2 without changing sidebar hover", () => {
    const markup = renderToStaticMarkup(
      React.createElement(Button, {
        variant: "tertiary",
        appearance: "soft-no-drop",
        size: "mini",
        iconOnly: true,
        icon: React.createElement("svg"),
      })
    );
    expect(markup).toContain("btn-hover:bg-button-hover-no-drop");
    expect(markup).toContain("btn-focus:bg-button-hover-no-drop");
    const theme = readFileSync(resolve("src/tailwind.css"), "utf8");
    expect(theme).toContain(
      "--color-button-hover-no-drop: var(--color-fill-2)"
    );
    for (const skin of ["orgii_main.css", "orgii_dark.css"]) {
      expect(readFileSync(resolve("public", skin), "utf8")).toContain(
        "--color-button-hover: var(--color-fill-3)"
      );
    }
  });

  it("keeps compact non-sidebar actions at 24px", () => {
    const markup = renderToStaticMarkup(
      React.createElement(Button, {
        size: "mini",
        iconOnly: true,
        icon: React.createElement("svg"),
      })
    );
    expect(markup).toContain("width:24px");
    expect(markup).toContain("border-radius:8px");
  });

  it("shows danger color at rest with light hover fills and native disabled behavior", async () => {
    let clicks = 0;
    const props = {
      size: "sidebar" as const,
      variant: "danger" as const,
      appearance: "soft" as const,
      iconOnly: true,
      "aria-label": "Discard file",
      icon: React.createElement("svg"),
      onClick: () => {
        clicks += 1;
      },
    };
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    try {
      await act(async () => root.render(React.createElement(Button, props)));
      const button = container.querySelector("button")!;
      expect(button.getAttribute("aria-label")).toBe("Discard file");
      expect(button.classList.contains("btn:text-danger-6")).toBe(true);
      expect(button.classList.contains("btn:text-text-2")).toBe(false);
      expect(button.className).toContain("btn-hover:bg-danger-2");
      expect(button.className).toContain("btn-focus:bg-danger-2");
      await act(async () =>
        root.render(
          React.createElement(Button, { ...props, appearance: "soft-no-drop" })
        )
      );
      expect(button.classList.contains("btn:text-danger-6")).toBe(true);
      expect(button.classList.contains("btn:text-text-2")).toBe(false);
      expect(button.className).toContain("btn-hover:bg-danger-1");
      expect(button.className).not.toContain("hover:bg-danger-2");
      expect(button.className).not.toContain("bg-danger-3");
      await act(async () => button.click());
      expect(clicks).toBe(1);
      await act(async () =>
        root.render(React.createElement(Button, { ...props, disabled: true }))
      );
      await act(async () => button.click());
      expect(clicks).toBe(1);
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });
});

describe("compound button surfaces", () => {
  it("preserves direct-child layout and caller-owned geometry", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        Button,
        {
          layout: "custom",
          appearance: "custom",
          className: "menu-row",
          style: { height: 48, padding: "4px 12px" },
          role: "menuitem",
          "aria-expanded": true,
        },
        React.createElement("div", { className: "label" }, "Two-line label"),
        React.createElement("span", { className: "suffix" }, "Shortcut")
      )
    );
    const host = document.createElement("div");
    host.innerHTML = markup;
    const button = host.querySelector("button")!;
    expect(button.className).toBe("menu-row");
    expect(button.style.height).toBe("48px");
    expect(button.style.padding).toBe("4px 12px");
    expect(button.style.width).toBe("");
    expect(button.style.borderRadius).toBe("");
    expect(button.querySelector(":scope > .label")?.textContent).toBe(
      "Two-line label"
    );
    expect(button.querySelector(":scope > .suffix")?.textContent).toBe(
      "Shortcut"
    );
    expect(button.getAttribute("aria-expanded")).toBe("true");
  });

  it("retains native refs, switch semantics, disabled behavior and form type", async () => {
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const ref = React.createRef<HTMLButtonElement>();
    let clicks = 0;
    const props = {
      layout: "custom" as const,
      appearance: "custom" as const,
      ref,
      role: "switch",
      "aria-checked": true,
      type: "submit" as const,
      htmlType: "button" as const,
      onClick: () => {
        clicks += 1;
      },
    };
    try {
      await act(async () =>
        root.render(React.createElement(Button, props, "Track"))
      );
      expect(ref.current).toBe(host.querySelector("button"));
      expect(ref.current?.getAttribute("role")).toBe("switch");
      expect(ref.current?.getAttribute("aria-checked")).toBe("true");
      expect(ref.current?.type).toBe("button");
      await act(async () => ref.current!.click());
      expect(clicks).toBe(1);
      await act(async () =>
        root.render(
          React.createElement(Button, { ...props, disabled: true }, "Track")
        )
      );
      await act(async () => ref.current!.click());
      expect(clicks).toBe(1);
      await act(async () =>
        root.render(
          React.createElement(Button, { ...props, htmlType: "submit" }, "Track")
        )
      );
      expect(ref.current?.type).toBe("submit");
    } finally {
      await act(async () => root.unmount());
      host.remove();
      Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
    }
  });
});

describe("Button shortcut hints", () => {
  it("renders a trailing display hint without leaking a DOM attribute", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(
      React.createElement(
        Button,
        {
          shortcut: "Esc",
          "aria-keyshortcuts": "Escape",
        },
        "Cancel"
      )
    );
    const button = host.querySelector("button")!;
    expect(button.textContent).toBe("CancelEsc");
    expect(button.hasAttribute("shortcut")).toBe(false);
    expect(button.getAttribute("aria-keyshortcuts")).toBe("Escape");
    expect(
      button.querySelector("kbd")?.closest('[aria-hidden="true"]')
    ).not.toBeNull();
  });

  it.each([undefined, "", "   "])("omits an empty hint (%s)", (shortcut) => {
    const markup = renderToStaticMarkup(
      React.createElement(Button, { shortcut }, "Action")
    );
    expect(markup).not.toContain("<kbd");
  });

  it("preserves icon-only geometry without rendering a shortcut", () => {
    const markup = renderToStaticMarkup(
      React.createElement(Button, {
        iconOnly: true,
        icon: React.createElement("svg"),
        shortcut: "Enter",
        "aria-label": "Send",
      })
    );
    expect(markup).not.toContain("<kbd");
  });
});

describe("Button hover intent", () => {
  const classesOf = (props: Record<string, unknown>) => {
    const markup = renderToStaticMarkup(
      React.createElement(Button, {
        iconOnly: true,
        icon: React.createElement("svg"),
        ...props,
      })
    );
    const match = markup.match(/class="([^"]*)"/);
    return new Set((match?.[1] ?? "").split(/\s+/));
  };

  it.each([
    ["tertiary", undefined, "btn-hover:bg-surface-hover"],
    ["tertiary", "soft", "btn-hover:bg-fill-2"],
    ["tertiary", "soft-no-drop", "btn-hover:bg-button-hover-no-drop"],
    ["tertiary", "ghost", null],
    ["secondary", "solid", "btn-hover:bg-fill-3"],
  ])(
    "swaps the neutral hover text for the intent on %s/%s",
    (variant, appearance, hoverSurface) => {
      const neutral = classesOf({ variant, appearance });
      const danger = classesOf({ variant, appearance, hoverIntent: "danger" });
      const primary = classesOf({
        variant,
        appearance,
        hoverIntent: "primary",
      });

      for (const intent of [danger, primary]) {
        expect(intent.has("btn-hover:text-text-1")).toBe(false);
        expect(intent.has("btn-focus:text-text-1")).toBe(false);
        if (hoverSurface) expect(intent.has(hoverSurface)).toBe(true);
        // Resting color is untouched.
        for (const restClass of ["btn:text-text-1", "btn:text-text-2"]) {
          expect(intent.has(restClass)).toBe(neutral.has(restClass));
        }
      }
      for (const [classes, color] of [
        [danger, "danger-6"],
        [primary, "primary-6"],
      ] as const) {
        expect(classes.has(`btn-hover:text-${color}`)).toBe(true);
        expect(classes.has(`btn-active:text-${color}`)).toBe(true);
        expect(classes.has(`btn-focus:text-${color}`)).toBe(true);
      }
    }
  );

  it("keeps the neutral hover text when no intent is requested", () => {
    for (const appearance of [undefined, "soft", "soft-no-drop", "ghost"]) {
      expect(
        classesOf({ variant: "tertiary", appearance }).has(
          "btn-hover:text-text-1"
        )
      ).toBe(true);
    }
  });

  it("leaves semantic variants on their own palette", () => {
    for (const variant of ["primary", "danger", "warning", "success"]) {
      for (const appearance of ["solid", "soft", "ghost"]) {
        expect(
          classesOf({ variant, appearance, hoverIntent: "danger" })
        ).toEqual(classesOf({ variant, appearance }));
      }
    }
  });
});

describe("Button default utilities sit below caller classes", () => {
  const VARIANTS = [
    "primary",
    "secondary",
    "tertiary",
    "danger",
    "warning",
    "success",
    "merged",
  ] as const;
  const APPEARANCES = [
    undefined,
    "solid",
    "outline",
    "dashed",
    "ghost",
    "soft",
    "soft-no-drop",
  ] as const;
  const classesOf = (props: Record<string, unknown>) => {
    const markup = renderToStaticMarkup(
      React.createElement(Button, props, "Label")
    );
    return (markup.match(/class="([^"]*)"/)?.[1] ?? "").split(/\s+/);
  };

  it("emits every own utility through a component-default variant", () => {
    for (const variant of VARIANTS) {
      for (const appearance of APPEARANCES) {
        for (const extra of [
          {},
          { disabled: true },
          { hoverIntent: "danger" },
        ]) {
          const unlayered = classesOf({ variant, appearance, ...extra }).filter(
            (name) =>
              name !== "button" &&
              !/^btn(-hover|-active|-focus|-pressed)?:/.test(name)
          );
          expect(unlayered, `${variant}/${appearance}`).toEqual([]);
        }
      }
    }
  });

  it("passes caller classes through unprefixed so they outrank the defaults", () => {
    const classes = classesOf({
      variant: "tertiary",
      className: "hidden bg-fill-2 hover:text-text-2",
    });
    expect(classes).toEqual(
      expect.arrayContaining(["hidden", "bg-fill-2", "hover:text-text-2"])
    );
    expect(classes).toEqual(
      expect.arrayContaining([
        "btn:inline-flex",
        "btn:bg-transparent",
        "btn-hover:text-text-1",
      ])
    );
  });

  it.each([
    ["tertiary", "soft", "default"],
    ["tertiary", "soft-no-drop", "noDrop"],
    ["primary", "soft", "primary"],
    ["danger", "soft", "danger"],
    ["danger", "soft-no-drop", "dangerNoDrop"],
    ["success", "soft", "success"],
  ] as const)(
    "keeps the %s/%s palette in sync with BUTTON_VARIANT.%s",
    (variant, appearance, token) => {
      const TO_TAILWIND: Record<string, string> = {
        "btn:": "",
        "btn-hover:": "enabled:hover:",
        "btn-active:": "enabled:active:",
        "btn-focus:": "focus-visible:",
        "btn-pressed:": "aria-pressed:",
      };
      const unprefixed = new Set(
        classesOf({ variant, appearance }).map((name) =>
          name.replace(
            /^btn(-hover|-active|-focus|-pressed)?:/,
            (prefix) => TO_TAILWIND[prefix] ?? prefix
          )
        )
      );
      for (const name of BUTTON_VARIANT[token].split(" ")) {
        expect(unprefixed.has(name), name).toBe(true);
      }
    }
  );

  it("declares the component-default variants", () => {
    const theme = readFileSync(resolve("src/tailwind.css"), "utf8");
    expect(theme).toMatch(
      /@custom-variant btn\s*{\s*@layer button\s*{\s*@slot;\s*}\s*}/
    );
    expect(theme).toMatch(
      /@custom-variant btn-hover\s*{\s*@media \(hover: hover\)\s*{\s*&:where\(:enabled:hover\)\s*{\s*@slot;/
    );
    expect(theme).toContain(
      "@custom-variant btn-active (&:where(:enabled:active));"
    );
    expect(theme).toContain(
      "@custom-variant btn-focus (&:where(:focus-visible));"
    );
    expect(theme).toContain(
      '@custom-variant btn-pressed (&:where([aria-pressed="true"]));'
    );
  });

  it("follows the pointer-cursor preference instead of a fixed pointer", () => {
    const classes = classesOf({ variant: "tertiary" });
    expect(classes).toContain("btn:cursor-[var(--interactive-cursor,default)]");
    expect(classes).not.toContain("btn:cursor-pointer");
  });
});
