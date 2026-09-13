// @vitest-environment jsdom
import { act, createElement } from "react";
import { createPortal } from "react-dom";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ComposerShell from ".";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function renderShell(children?: React.ReactNode, editable = true) {
  act(() => {
    root.render(
      createElement(
        ComposerShell,
        { "data-testid": "shell" },
        createElement("div", {
          className: "composer-input-content",
          contentEditable: editable,
          tabIndex: 0,
        }),
        createElement("div", { "data-testid": "gap" }),
        children
      )
    );
  });
  return container.querySelector<HTMLElement>(".composer-input-content")!;
}

function click(element: Element) {
  act(() => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("ComposerShell background focus", () => {
  it.each(["shell", "gap"])("focuses the editor from the %s", (testId) => {
    const editor = renderShell();
    click(container.querySelector(`[data-testid="${testId}"]`)!);
    expect(document.activeElement).toBe(editor);
  });

  it.each([
    createElement("button", null, createElement("span", null, "Model")),
    createElement("button", { disabled: true }, "Send"),
    createElement("a", { href: "#" }, "Attachment"),
    createElement("div", { role: "button", tabIndex: 0 }, "Picker"),
    createElement("input"),
  ])("leaves controls alone (%#)", (control) => {
    const editor = renderShell(control);
    const focus = vi.spyOn(editor, "focus");
    const controlElement = container.firstElementChild!.lastElementChild!;
    click(controlElement.firstElementChild ?? controlElement);
    expect(focus).not.toHaveBeenCalled();
  });

  it("focuses inside an ancestor dialog", () => {
    container.setAttribute("role", "dialog");
    const editor = renderShell();
    click(container.firstElementChild!);
    expect(document.activeElement).toBe(editor);
  });

  it("preserves native editor clicks and selection", () => {
    const editor = renderShell();
    const focus = vi.spyOn(editor, "focus");
    click(editor);
    expect(focus).not.toHaveBeenCalled();
  });

  it("does not focus a disabled editor", () => {
    const editor = renderShell(undefined, false);
    const focus = vi.spyOn(editor, "focus");
    click(container.firstElementChild!);
    expect(focus).not.toHaveBeenCalled();
  });

  it("respects clicks handled by child content", () => {
    const editor = renderShell(
      createElement(
        "div",
        { onClick: (event) => event.preventDefault() },
        "Preview"
      )
    );
    const focus = vi.spyOn(editor, "focus");
    click(container.firstElementChild!.lastElementChild!);
    expect(focus).not.toHaveBeenCalled();
  });

  it("ignores clicks bubbling through React portals", () => {
    const portal = document.createElement("div");
    document.body.append(portal);
    const editor = renderShell(
      createPortal(createElement("div", null, "Popup"), portal)
    );
    const focus = vi.spyOn(editor, "focus");
    click(portal.firstElementChild!);
    expect(focus).not.toHaveBeenCalled();
    portal.remove();
  });
});
