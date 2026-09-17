// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  placeCaretAfter,
  placeCaretAfterPill,
  placeCaretAtEnd,
} from "../selection";

describe("composer caret updates", () => {
  let host: HTMLDivElement;
  let pill: HTMLSpanElement;
  let trailing: Text;
  beforeEach(() => {
    host = document.createElement("div");
    host.setAttribute("contenteditable", "true");
    host.tabIndex = 0;
    pill = document.createElement("span");
    pill.setAttribute("contenteditable", "false");
    pill.textContent = "README.md";
    trailing = document.createTextNode(" ");
    host.append(document.createTextNode(""), pill, trailing);
    document.body.append(host);
    host.focus();
    window.getSelection()!.collapse(host, 0);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    host.remove();
    window.getSelection()?.removeAllRanges();
  });

  it("does not clear selection between the insertion caret and portal correction", () => {
    const selection = window.getSelection()!;
    const clear = vi.spyOn(selection, "removeAllRanges");
    const collapse = vi.spyOn(selection, "collapse");
    const focus = vi.spyOn(host, "focus");
    placeCaretAfter(trailing);
    // The portal layout effect and external focus requests target the same caret.
    placeCaretAfterPill(pill);
    placeCaretAtEnd(host);
    expect(clear).not.toHaveBeenCalled();
    // Every call targets the same caret, and every call re-collapses to it —
    // see the next test for why an "already there" shortcut is unsafe.
    expect(collapse).toHaveBeenCalledTimes(3);
    for (const call of collapse.mock.calls) {
      expect(call).toEqual([trailing, 1]);
    }
    expect(focus).not.toHaveBeenCalled();
    expect(selection.anchorNode).toBe(trailing);
    expect(selection.anchorOffset).toBe(1);
  });

  it("re-collapses even when the selection already reports the target", () => {
    // Regression: after a "\n" is inserted, WebKit reports the caret at the
    // target while painting it — and inserting typed text — at the end of the
    // previous line. Skipping the collapse as a no-op put text typed after
    // Enter on the line above.
    const selection = window.getSelection()!;
    selection.collapse(trailing, 1);
    const collapse = vi.spyOn(selection, "collapse");

    placeCaretAfter(trailing);

    expect(collapse).toHaveBeenCalledExactlyOnceWith(trailing, 1);
  });

  it("still collapses a non-empty selection whose anchor already matches the target", () => {
    const selection = window.getSelection()!;
    selection.setBaseAndExtent(trailing, 1, host, 0);
    expect(selection.isCollapsed).toBe(false);
    placeCaretAtEnd(host);
    expect(selection.isCollapsed).toBe(true);
    expect(selection.anchorNode).toBe(trailing);
    expect(selection.anchorOffset).toBe(1);
  });

  it("corrects an actual leading-edge caret and focuses an unfocused editor", () => {
    host.blur();
    placeCaretAfterPill(pill);
    expect(document.activeElement).toBe(host);
    expect(window.getSelection()!.anchorNode).toBe(trailing);
    expect(window.getSelection()!.anchorOffset).toBe(1);
  });
});
