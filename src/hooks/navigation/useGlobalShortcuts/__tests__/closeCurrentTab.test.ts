// @vitest-environment jsdom
import { Provider } from "jotai";
import { act, createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";

import { ROUTES } from "@src/config/routes";
import { settingsReturnPathAtom } from "@src/store/ui/settingsNavigationAtom";
import {
  createStartTab,
  workstationLayoutAtom,
} from "@src/store/workstation/tabs";
import {
  createInstrumentedStore,
  getInstrumentedStore,
  resetInstrumentedStore,
} from "@src/util/core/state/instrumentedStore";

import { useTabShortcuts } from "../useTabShortcuts";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const navigationEvents: Array<{ path: string; replace?: boolean }> = [];
const handleNavigate = (event: Event) => {
  navigationEvents.push(
    (event as CustomEvent<{ path: string; replace?: boolean }>).detail
  );
};

beforeEach(() => {
  resetInstrumentedStore();
  createInstrumentedStore();
  navigationEvents.length = 0;
  window.addEventListener("action-system-navigate", handleNavigate);
});

afterEach(() => {
  window.removeEventListener("action-system-navigate", handleNavigate);
  resetInstrumentedStore();
});

type TabShortcutsApi = ReturnType<typeof useTabShortcuts>;

function Harness({ onReady }: { onReady: (api: TabShortcutsApi) => void }) {
  const api = useTabShortcuts();
  useEffect(() => {
    onReady(api);
  }, [api, onReady]);
  return null;
}

/** Mount the hook against the app's singleton store and hand back its API. */
async function mountTabShortcuts() {
  const store = getInstrumentedStore();
  let mounted: TabShortcutsApi | null = null;
  const onReady = (api: TabShortcutsApi) => {
    mounted = api;
  };
  const node = document.createElement("div");
  document.body.append(node);
  const root = createRoot(node);
  await act(async () => {
    root.render(
      createElement(Provider, { store }, createElement(Harness, { onReady }))
    );
  });
  return {
    get handleCloseCurrentTab() {
      if (!mounted) throw new Error("harness did not render");
      return mounted.handleCloseCurrentTab;
    },
    async unmount() {
      await act(async () => root.unmount());
      node.remove();
    },
  };
}

it("closes Settings instead of the WorkStation tab hidden behind it", async () => {
  const store = getInstrumentedStore();
  const launchpad = createStartTab();
  store.set(workstationLayoutAtom, {
    mainPane: { tabs: [launchpad], activeTabId: launchpad.id },
  });
  store.set(settingsReturnPathAtom, ROUTES.workStation.code.path);
  window.history.replaceState({}, "", `${ROUTES.app.settings.path}/appearance`);

  const harness = await mountTabShortcuts();
  let closed = false;
  await act(async () => {
    closed = harness.handleCloseCurrentTab();
  });

  expect(closed).toBe(true);
  expect(navigationEvents).toEqual([{ path: ROUTES.workStation.code.path }]);
  expect(store.get(workstationLayoutAtom).mainPane.tabs).toHaveLength(1);

  await harness.unmount();
});

it("still closes the active tab on a WorkStation URL", async () => {
  const store = getInstrumentedStore();
  const launchpad = createStartTab();
  store.set(workstationLayoutAtom, {
    mainPane: { tabs: [launchpad], activeTabId: launchpad.id },
  });
  window.history.replaceState({}, "", ROUTES.workStation.base.path);

  const harness = await mountTabShortcuts();
  let closed = false;
  await act(async () => {
    closed = harness.handleCloseCurrentTab();
  });

  expect(closed).toBe(true);
  expect(navigationEvents).toEqual([]);
  expect(store.get(workstationLayoutAtom).mainPane.tabs).toEqual([]);

  await harness.unmount();
});
