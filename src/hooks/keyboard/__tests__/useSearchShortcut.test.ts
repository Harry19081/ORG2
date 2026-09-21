/**
 * @vitest-environment jsdom
 */
import React, { type RefObject } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { createSmokeRoot } from "@src/test/reactSmokeHarness";

import { useSearchShortcut } from "../useSearchShortcut";

// Test files are `.ts`, so the markup is built with createElement and the refs
// are filled in from the mounted DOM rather than handed to React.
interface HarnessProps {
  inputRef: RefObject<HTMLInputElement | null>;
  scopeRef?: RefObject<HTMLElement | null>;
  enabled?: boolean;
}

function Harness({ inputRef, scopeRef, enabled = true }: HarnessProps) {
  useSearchShortcut(inputRef, { enabled, scopeRef });

  return React.createElement(
    "div",
    null,
    React.createElement(
      "div",
      { "data-testid": "scope" },
      React.createElement("input", {
        defaultValue: "gpt",
        "data-testid": "search",
      }),
      React.createElement("button", { type: "button", "data-testid": "inside" })
    ),
    React.createElement("button", { type: "button", "data-testid": "outside" }),
    React.createElement("textarea", { "data-testid": "editor" })
  );
}

const roots: Array<ReturnType<typeof createSmokeRoot>> = [];

interface Mounted {
  input: HTMLInputElement;
  find: (testId: string) => HTMLElement;
}

async function mount(
  options: { scoped?: boolean; enabled?: boolean } = {}
): Promise<Mounted> {
  const root = createSmokeRoot();
  roots.push(root);

  const inputRef: RefObject<HTMLInputElement | null> = { current: null };
  const scopeRef: RefObject<HTMLElement | null> = { current: null };

  await root.render(
    React.createElement(Harness, {
      inputRef,
      scopeRef: options.scoped ? scopeRef : undefined,
      enabled: options.enabled,
    })
  );

  const find = (testId: string) =>
    root.container.querySelector<HTMLElement>(`[data-testid='${testId}']`)!;

  inputRef.current = find("search") as HTMLInputElement;
  scopeRef.current = find("scope");

  return { input: inputRef.current, find };
}

// jsdom reports no `navigator.platform`, so the registry resolves the Windows
// binding for `list_search` — Ctrl+F.
function pressFind(target: Element) {
  target.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "f",
      code: "KeyF",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
  );
}

afterEach(async () => {
  while (roots.length > 0) await roots.pop()?.unmount();
});

describe("useSearchShortcut", () => {
  it("focuses the field and selects what is already typed", async () => {
    const { input, find } = await mount();
    expect(document.activeElement).not.toBe(input);

    pressFind(find("outside"));

    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe("gpt".length);
  });

  it("leaves the chord to whatever editable surface already has focus", async () => {
    const { input, find } = await mount();

    pressFind(find("editor"));

    expect(document.activeElement).not.toBe(input);
  });

  it("answers only inside its subtree when scoped", async () => {
    const { input, find } = await mount({ scoped: true });

    pressFind(find("outside"));
    expect(document.activeElement).not.toBe(input);

    pressFind(find("inside"));
    expect(document.activeElement).toBe(input);
  });

  it("binds nothing while disabled", async () => {
    const { input, find } = await mount({ enabled: false });

    pressFind(find("outside"));

    expect(document.activeElement).not.toBe(input);
  });
});
