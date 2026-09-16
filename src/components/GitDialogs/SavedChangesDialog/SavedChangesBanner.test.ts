// @vitest-environment jsdom
import React, { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { SavedChangesBanner } from "./SavedChangesBanner";

const available = vi.hoisted(() => vi.fn());
vi.mock("@src/api/http/git/branchSwitch", () => ({
  branchSwitchApi: { available },
}));
vi.mock("./index", () => ({ openSavedChanges: vi.fn() }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (_key: string, text: string) => text }),
}));
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  vi.resetAllMocks();
  available.mockResolvedValue(false);
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});
const render = (branch = "main") =>
  act(async () => {
    root.render(
      React.createElement(SavedChangesBanner, { repoPath: "/repo", branch })
    );
  });
function changed() {
  window.dispatchEvent(
    new CustomEvent("orgii-branch-switch-completed", {
      detail: { repoPath: "/repo" },
    })
  );
}
it("coalesces invalidations during an outstanding read and revalidates after it", async () => {
  let finish!: (v: boolean) => void;
  available.mockImplementationOnce(
    () =>
      new Promise<boolean>((resolve) => {
        finish = resolve;
      })
  );
  await render();
  expect(available).toHaveBeenCalledTimes(1);
  await act(async () => {
    changed();
    changed();
    changed();
  });
  expect(available).toHaveBeenCalledTimes(1);
  await act(async () => finish(true));
  expect(available).toHaveBeenCalledTimes(2);
  expect(container.textContent).not.toContain("available for this branch");
});
it("rejects a stale branch result", async () => {
  let finish!: (v: boolean) => void;
  available.mockImplementationOnce(
    () =>
      new Promise<boolean>((resolve) => {
        finish = resolve;
      })
  );
  await render();
  await render("develop");
  await act(async () => finish(true));
  expect(container.textContent).not.toContain("available for this branch");
});
it("does no hidden reads, revalidates on return, and removes listeners on close", async () => {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "hidden",
  });
  await render();
  await act(async () => changed());
  expect(available).not.toHaveBeenCalled();
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(available).toHaveBeenCalledTimes(1);
  await act(async () => root.render(null));
  await act(async () => changed());
  expect(available).toHaveBeenCalledTimes(1);
});
