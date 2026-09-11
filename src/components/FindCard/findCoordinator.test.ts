// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { CURRENT_SHORTCUT_PLATFORM } from "@src/config/keyboard/shortcutBindings";

import {
  type FindScope,
  registerFindTarget,
  selectFindScope,
} from "./findCoordinator";

const cleanup: (() => void)[] = [];
afterEach(() => {
  cleanup.splice(0).forEach((dispose) => dispose());
  document.body.replaceChildren();
});
function target(scope: FindScope, visible = true) {
  const element = document.createElement("input");
  document.body.append(element);
  element.getClientRects = () =>
    (visible ? [{}] : []) as unknown as DOMRectList;
  const open = vi.fn(),
    close = vi.fn();
  cleanup.push(
    registerFindTarget({ scope, element: () => element, open, close })
  );
  return { element, open, close };
}
function press(element: HTMLElement) {
  const event = new KeyboardEvent("keydown", {
    key: "f",
    code: "KeyF",
    bubbles: true,
    cancelable: true,
    metaKey: CURRENT_SHORTCUT_PLATFORM === "mac",
    ctrlKey: CURRENT_SHORTCUT_PLATFORM !== "mac",
  });
  element.dispatchEvent(event);
  return event;
}
describe("consolidated Find cycle", () => {
  it.each(["session", "file"] as const)(
    "opens focused %s, switches, then closes",
    (scope) => {
      const first = target(scope),
        second = target(scope === "session" ? "file" : "session");
      first.element.focus();
      expect(press(first.element).defaultPrevented).toBe(true);
      expect(first.open).toHaveBeenCalledOnce();
      press(first.element);
      expect(first.close).toHaveBeenCalledOnce();
      expect(second.open).toHaveBeenCalledOnce();
      press(first.element);
      expect(second.close).toHaveBeenCalledOnce();
    }
  );
  it("skips hidden targets and closes on the second press", () => {
    const session = target("session"),
      file = target("file", false);
    session.element.focus();
    press(session.element);
    press(session.element);
    expect(session.close).toHaveBeenCalledOnce();
    expect(file.open).not.toHaveBeenCalled();
  });
  it("pill switching closes the previous engine and next Find closes", () => {
    const session = target("session"),
      file = target("file");
    session.element.focus();
    press(session.element);
    selectFindScope("file");
    expect(session.close).toHaveBeenCalledOnce();
    expect(file.open).toHaveBeenCalledOnce();
    press(session.element);
    expect(file.close).toHaveBeenCalledOnce();
  });
  it("returns to the last focused file instead of a different mounted editor", () => {
    const session = target("session"),
      file = target("file"),
      unrelated = target("file");
    file.element.focus();
    session.element.focus();
    press(session.element);
    press(session.element);
    expect(file.open).toHaveBeenCalledOnce();
    expect(unrelated.open).not.toHaveBeenCalled();
  });
  it("does not intercept outside focus and releases registration", () => {
    const session = target("session");
    session.element.focus();
    cleanup.pop()!();
    expect(press(session.element).defaultPrevented).toBe(false);
  });
});
