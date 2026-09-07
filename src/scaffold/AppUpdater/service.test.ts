import type { Update } from "@tauri-apps/plugin-updater";
import { createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as actions from "./actions";
import {
  checkForUpdatesManually,
  resetAppUpdaterForTests,
  startAutomaticAppUpdates,
} from "./service";
import { availableAppUpdateAtom } from "./state";

const mocks = vi.hoisted(() => ({
  check: vi.fn(),
  provenance: vi.fn(),
  store: null as ReturnType<typeof createStore> | null,
}));
vi.mock("@tauri-apps/api/app", () => ({ getVersion: async () => "1.0.0" }));
vi.mock("./channelCheck", () => ({ checkAppUpdateOnChannel: mocks.check }));
vi.mock("./buildProvenance", () => ({
  getAppBuildProvenance: mocks.provenance,
  resetAppBuildProvenanceForTests: vi.fn(),
}));
vi.mock("@src/util/core/state/instrumentedStore", () => ({
  getInstrumentedStore: () => mocks.store,
}));
vi.mock("@src/components/Message", () => ({
  default: { info: vi.fn(), success: vi.fn(), error: vi.fn(), remove: vi.fn() },
}));
vi.mock("./DownloadProgress", () => ({
  AppUpdateDownloadNoticeContent: () => null,
  getDownloadProgressTitle: () => "Downloading",
}));
vi.mock("@src/hooks/logger", () => ({
  createLogger: () => ({ warn: vi.fn(), error: vi.fn() }),
}));

const provenance = { kind: "release", installStrategy: "inPlace" };

describe("AppUpdater service boundary", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.store = createStore();
    vi.clearAllMocks();
    mocks.provenance.mockResolvedValue(provenance);
    mocks.check.mockResolvedValue(null);
    vi.stubGlobal(
      "window",
      Object.assign(new EventTarget(), {
        setTimeout: globalThis.setTimeout,
        clearTimeout: globalThis.clearTimeout,
        localStorage: { getItem: () => null },
      })
    );
    vi.stubGlobal(
      "document",
      Object.assign(new EventTarget(), { visibilityState: "visible" })
    );
    vi.stubGlobal("navigator", { onLine: true });
    resetAppUpdaterForTests();
  });

  afterEach(() => {
    resetAppUpdaterForTests();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shares one in-flight coordinator and state between lazy actions and the mounted service", async () => {
    let resolveCheck!: (update: Update) => void;
    mocks.check.mockImplementation(
      () =>
        new Promise<Update>((resolve) => {
          resolveCheck = resolve;
        })
    );
    const lazy = actions.checkForUpdatesManually();
    const update = {
      version: "1.0.1",
      available: true,
      close: vi.fn().mockResolvedValue(undefined),
    } as unknown as Update;
    await vi.waitFor(() => expect(mocks.check).toHaveBeenCalledTimes(1));
    const direct = checkForUpdatesManually();
    resolveCheck(update);
    await expect(direct).resolves.toBe(update);
    await expect(lazy).resolves.toBe(update);
    expect(mocks.check).toHaveBeenCalledTimes(1);
    expect(mocks.store!.get(availableAppUpdateAtom)).toBe(update);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not start background work when imported or used for a manual action", async () => {
    await vi.advanceTimersByTimeAsync(20_000);
    expect(mocks.check).not.toHaveBeenCalled();
    await actions.checkForUpdatesManually();
    expect(mocks.check).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels setup if unmounted before provenance resolves", async () => {
    let resolveProvenance!: (value: typeof provenance) => void;
    mocks.provenance.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveProvenance = resolve;
        })
    );
    const stop = startAutomaticAppUpdates();
    stop();
    resolveProvenance(provenance);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(mocks.check).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("preserves startup timing and clears all scheduler work across repeated mounts", async () => {
    for (let cycle = 0; cycle < 2; cycle += 1) {
      const stop = startAutomaticAppUpdates();
      await vi.advanceTimersByTimeAsync(9_999);
      expect(mocks.check).toHaveBeenCalledTimes(cycle);
      await vi.advanceTimersByTimeAsync(1);
      expect(mocks.check).toHaveBeenCalledTimes(cycle + 1);
      stop();
      expect(vi.getTimerCount()).toBe(0);
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("online"));
      await vi.advanceTimersByTimeAsync(2 * 60 * 60_000);
      expect(mocks.check).toHaveBeenCalledTimes(cycle + 1);
    }
  });
});
