// @vitest-environment jsdom
import { act, createElement } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PrLevelActions } from "./PrLevelActions";

// Every key resolves to a marker, so English text in the output means the
// label never went through a translation key at all.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => `[${key}]` }),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const identity = {
  number: 7,
  title: "Localize merge labels",
  url: "https://github.com/org/repo/pull/7",
  status: "open",
  headBranch: "fix/labels",
  baseBranch: "develop",
};

const noop = async () => {};

describe("PrLevelActions merge label", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function mergeLabel(detail: Record<string, unknown>): string | null {
    act(() => {
      root.render(
        createElement(PrLevelActions, {
          layout: "mergeBox",
          identity,
          detail,
          checks: null,
          disabled: false,
          pending: false,
          onMerge: noop,
          onSetAutoMerge: noop,
          onDraftChange: noop,
          onStateChange: noop,
        })
      );
    });
    return (
      container.querySelector('[data-testid="pr-merge-box-action"]')
        ?.textContent ?? null
    );
  }

  it.each([
    [
      "conflicts",
      { state: "open", mergeable: false, mergeable_state: "dirty" },
      "[git.pr.mergeStatus.conflicts]",
    ],
    [
      "ready",
      { state: "open", mergeable: true, mergeable_state: "clean" },
      "[git.pr.mergeStatus.ableToMerge]",
    ],
    ["draft", { state: "open", draft: true }, "[git.pr.actions.draft]"],
    ["merged", { state: "closed", merged: true }, "[git.pr.actions.merged]"],
    ["closed", { state: "closed", merged: false }, "[git.pr.actions.closed]"],
  ])("translates the %s verdict", (_name, detail, expected) => {
    expect(mergeLabel(detail)).toBe(expected);
  });
});
