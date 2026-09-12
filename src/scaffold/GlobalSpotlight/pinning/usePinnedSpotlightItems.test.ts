// @vitest-environment jsdom
import { Provider, createStore } from "jotai";
import { act, createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

import type { SpotlightItem } from "../types";
import { usePinnedSpotlightItems } from "./usePinnedSpotlightItems";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(() => {
  localStorage.clear();
  Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});

it("persists directory pins through remounts with a fresh store and isolates main command pins", () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const container = document.createElement("div");
  const input: SpotlightItem[] = [
    { id: "repo-1", label: "Repo", type: "repo" },
  ];
  let output: SpotlightItem[] = [];
  function Harness({
    scope,
    enabled = true,
  }: {
    scope: "commands" | "directories";
    enabled?: boolean;
  }) {
    const items = usePinnedSpotlightItems(input, scope, enabled);
    useEffect(() => {
      output = items;
    }, [items]);
    return null;
  }
  function mount(scope: "commands" | "directories", enabled = true) {
    const root = createRoot(container);
    act(() =>
      root.render(
        createElement(
          Provider,
          { store: createStore() },
          createElement(Harness, { scope, enabled })
        )
      )
    );
    return root;
  }
  let root = mount("directories");
  act(() => output[0].data?.pinState?.onToggle());
  expect(output[0].data?.isHeader).toBe(true);
  expect(
    JSON.parse(localStorage.getItem("orgii-spotlight-directory-pins")!)
  ).toEqual(["repo-1"]);
  act(() => root.unmount());
  root = mount("directories");
  expect(output[1].data?.pinState?.pinned).toBe(true);
  act(() => root.unmount());
  root = mount("commands");
  expect(output).toHaveLength(1);
  expect(output[0].data?.pinState).toBeUndefined();
  act(() => root.unmount());
  root = mount("directories", false);
  expect(output).toBe(input);
  act(() => root.unmount());
});
