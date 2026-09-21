/**
 * @vitest-environment jsdom
 */
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createSmokeRoot } from "@src/test/reactSmokeHarness";

import { SettingsTableSearchInput } from "./SettingsTableSearchInput";

const roots: Array<ReturnType<typeof createSmokeRoot>> = [];

async function mount(
  props: Partial<React.ComponentProps<typeof SettingsTableSearchInput>> = {}
): Promise<HTMLElement> {
  const root = createSmokeRoot();
  roots.push(root);
  await root.render(
    React.createElement(SettingsTableSearchInput, {
      value: "",
      placeholder: "Search models...",
      onChange: vi.fn(),
      ...props,
    })
  );
  return root.container;
}

function hint(container: HTMLElement): HTMLElement | null {
  return container.querySelector("kbd");
}

afterEach(async () => {
  while (roots.length > 0) await roots.pop()?.unmount();
});

describe("SettingsTableSearchInput", () => {
  it("shows no key hint until a table opts into the shortcut", async () => {
    expect(hint(await mount())).toBeNull();
  });

  it("shows the key hint inside an empty, unfocused field", async () => {
    const container = await mount({ shortcut: true });
    expect(hint(container)?.textContent).toContain("F");
  });

  it("gets the hint out of the way once the field is in use", async () => {
    // Typed-in value: the clear button owns that end of the field.
    expect(hint(await mount({ shortcut: true, value: "gpt" }))).toBeNull();

    const container = await mount({ shortcut: true });
    const input = container.querySelector("input")!;
    input.focus();
    input.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
    await Promise.resolve();
    expect(hint(container)).toBeNull();
  });

  it("keeps the binding but drops the hint on request", async () => {
    const container = await mount({ shortcut: { hideHint: true } });
    expect(hint(container)).toBeNull();

    container.querySelector("input")!.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "f",
        code: "KeyF",
        ctrlKey: true,
        bubbles: true,
      })
    );
    expect(document.activeElement).toBe(container.querySelector("input"));
  });
});
