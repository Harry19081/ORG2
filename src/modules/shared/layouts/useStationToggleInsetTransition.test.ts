// @vitest-environment jsdom
import { Provider, createStore } from "jotai";
import { act, createElement } from "react";
import { type Root, createRoot } from "react-dom/client";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { chatPanelMaximizedAtom } from "@src/store/ui/chatPanel/surfaceAtoms";

import {
  STATION_TOGGLE_INSET_TRANSITION_MS,
  useStationToggleInsetTransition,
} from "./useStationToggleInsetTransition";
import { CHROME_INSET_TRANSITION_CLASSES } from "./viewContainerTokens";

const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

/** Stands in for a header row; `activeTabId` changes like a tab switch would. */
function InsetProbe({ activeTabId }: { activeTabId: string }) {
  const className = useStationToggleInsetTransition();
  return createElement("div", {
    "data-testid": "inset-probe",
    "data-active-tab": activeTabId,
    className,
  });
}

describe("useStationToggleInsetTransition", () => {
  let container: HTMLDivElement;
  let root: Root;
  let store: ReturnType<typeof createStore>;

  beforeAll(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    vi.useFakeTimers();
    // The maximized flag is persisted; start every test with the station open.
    localStorage.clear();
    store = createStore();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  afterAll(() => {
    Reflect.deleteProperty(reactActEnvironment, "IS_REACT_ACT_ENVIRONMENT");
  });

  function render(activeTabId = "tab-a"): void {
    act(() => {
      root.render(
        createElement(
          Provider,
          { store },
          createElement(InsetProbe, { activeTabId })
        )
      );
    });
  }

  function probeClassName(): string | null {
    return container
      .querySelector('[data-testid="inset-probe"]')
      ?.getAttribute("class") as string | null;
  }

  function advance(ms: number): void {
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  }

  it("keeps insets still at rest and when tabs change inside the station", () => {
    render("tab-a");
    expect(probeClassName()).toBe("");

    render("tab-b");
    expect(probeClassName()).toBe("");
  });

  it("animates insets while the station closes and opens, then stops", () => {
    render();

    act(() => store.set(chatPanelMaximizedAtom, true));
    expect(probeClassName()).toBe(CHROME_INSET_TRANSITION_CLASSES);
    advance(STATION_TOGGLE_INSET_TRANSITION_MS);
    expect(probeClassName()).toBe("");

    act(() => store.set(chatPanelMaximizedAtom, false));
    expect(probeClassName()).toBe(CHROME_INSET_TRANSITION_CLASSES);
    advance(STATION_TOGGLE_INSET_TRANSITION_MS);
    expect(probeClassName()).toBe("");
  });

  it("does not let an earlier toggle cut a quick reopen short", () => {
    render();

    act(() => store.set(chatPanelMaximizedAtom, true));
    advance(STATION_TOGGLE_INSET_TRANSITION_MS - 100);
    act(() => store.set(chatPanelMaximizedAtom, false));

    // The first toggle's timer would have fired here.
    advance(100);
    expect(probeClassName()).toBe(CHROME_INSET_TRANSITION_CLASSES);

    advance(STATION_TOGGLE_INSET_TRANSITION_MS - 100);
    expect(probeClassName()).toBe("");
  });

  it("stops animating once the station finishes toggling, even if tabs change meanwhile", () => {
    render("tab-a");

    act(() => store.set(chatPanelMaximizedAtom, true));
    render("tab-b");
    expect(probeClassName()).toBe(CHROME_INSET_TRANSITION_CLASSES);

    advance(STATION_TOGGLE_INSET_TRANSITION_MS);
    render("tab-c");
    expect(probeClassName()).toBe("");
  });
});
