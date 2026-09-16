// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ROUTES } from "@src/config/routes";
import { settingsReturnPathAtom } from "@src/store/ui/settingsNavigationAtom";
import {
  createInstrumentedStore,
  getInstrumentedStore,
  resetInstrumentedStore,
} from "@src/util/core/state/instrumentedStore";

import { AppViewService } from "./AppViewService";

describe("AppViewService.closeSettings", () => {
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

  it("restores the WorkStation URL the user entered Settings from", () => {
    const returnPath = `${ROUTES.workStation.code.path}?file=README.md`;
    getInstrumentedStore().set(settingsReturnPathAtom, returnPath);

    expect(
      AppViewService.closeSettings(`${ROUTES.app.settings.path}/appearance`)
    ).toBe(true);
    expect(navigationEvents).toEqual([{ path: returnPath }]);
  });

  it("falls back to the WorkStation root when nothing was remembered", () => {
    expect(AppViewService.closeSettings(ROUTES.app.settings.path)).toBe(true);
    expect(navigationEvents).toEqual([{ path: ROUTES.workStation.base.path }]);
  });

  it("does nothing off the Settings surface", () => {
    expect(AppViewService.closeSettings(ROUTES.workStation.base.path)).toBe(
      false
    );
    expect(navigationEvents).toEqual([]);
  });
});
