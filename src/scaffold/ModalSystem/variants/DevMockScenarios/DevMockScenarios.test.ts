// @vitest-environment jsdom
import { Provider } from "jotai";
import { act, createElement } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  activeDevMockScenariosAtom,
  devMockScenariosAtom,
  devMockScenariosModalOpenAtom,
  resetDevMockScenariosForTest,
} from "@src/store/dev/mockScenarios";
import {
  createInstrumentedStore,
  resetInstrumentedStore,
} from "@src/util/core/state/instrumentedStore";

import DevMockScenariosModal from "./index";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("DevMockScenariosModal", () => {
  let host: HTMLDivElement;
  let root: Root;
  let store: ReturnType<typeof createInstrumentedStore>;

  // Modal renders through a portal on document.body, not inside `host`.
  // Match on the test id: a footer button's text also carries its shortcut hint.
  const footerButton = (testId: string) =>
    document.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);

  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
    resetInstrumentedStore();
    store = createInstrumentedStore();
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    store.set(devMockScenariosModalOpenAtom, true);
    act(() =>
      root.render(
        createElement(Provider, { store }, createElement(DevMockScenariosModal))
      )
    );
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    resetInstrumentedStore();
    resetDevMockScenariosForTest();
    vi.unstubAllEnvs();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  });

  it("renders the same switch set as Settings → Dev mode", () => {
    expect(document.querySelectorAll('[role="switch"]')).toHaveLength(5);
  });

  it("renders wide and compact so a description fits on one line", () => {
    const content = document.querySelector<HTMLElement>(
      ".liquid-modal-content"
    );

    // Below SectionRow's @[480px] container query the switch stacks under
    // the text and every description wraps, so the dialog must stay wide.
    expect(content?.classList.contains("modal-large")).toBe(true);
    expect(content?.style.width).toBe("700px");
    // SectionRow's compact mode: 12px label, 11px description, py-1.5.
    expect(document.querySelector(".text-\\[11px\\]")).not.toBeNull();
  });

  it("turns every scenario off from the footer", () => {
    act(() => {
      store.set(devMockScenariosAtom, { id: "newUser", enabled: true });
      store.set(devMockScenariosAtom, { id: "noSessions", enabled: true });
    });

    const reset = footerButton("dev-mock-reset");
    expect(reset?.disabled).toBe(false);

    act(() => reset!.click());

    expect(store.get(activeDevMockScenariosAtom)).toEqual({
      newUser: false,
      noKeys: false,
      noWorkingDirectories: false,
      noSessions: false,
    });
    expect(footerButton("dev-mock-reset")?.disabled).toBe(true);
  });

  it("closes without undoing the scenarios that are on", () => {
    act(() => store.set(devMockScenariosAtom, { id: "noKeys", enabled: true }));

    act(() => footerButton("dev-mock-done")!.click());

    expect(store.get(devMockScenariosModalOpenAtom)).toBe(false);
    expect(store.get(activeDevMockScenariosAtom).noKeys).toBe(true);
  });
});
