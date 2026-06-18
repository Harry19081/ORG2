/**
 * Tests for the chunk-reload circuit-breaker.
 *
 * Reproduces the "infinite reload loop strands the user on the splash" bug:
 * a failed lazy chunk used to call window.location.reload() with no upper
 * bound. These tests pin the bounded behavior — at most RELOAD_CAP (2) reloads,
 * then the actionable panel — plus the first-paint reset that restores the
 * retry budget.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { reloadForChunkError, resetChunkReloadCount } from "./chunkReload";

const RELOAD_COUNT_KEY = "orgii:chunk-reload-count";

let reloadSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  sessionStorage.clear();
  reloadSpy = vi.fn();
  // node's globalThis has no `location`; inject a spyable one.
  Object.defineProperty(window, "location", {
    value: { reload: reloadSpy },
    configurable: true,
    writable: true,
  });
  delete (window as unknown as Record<string, unknown>)
    .__ORGII_SHOW_STARTUP_ERROR__;
});

afterEach(() => {
  delete (window as unknown as Record<string, unknown>)
    .__ORGII_SHOW_STARTUP_ERROR__;
  vi.restoreAllMocks();
});

describe("reloadForChunkError", () => {
  it("reloads on the first chunk failure and increments the counter", () => {
    reloadForChunkError();

    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(RELOAD_COUNT_KEY)).toBe("1");
  });

  it("reloads up to RELOAD_CAP (2) times then stops", () => {
    reloadForChunkError(); // count 0 -> reload, store 1
    reloadForChunkError(); // count 1 -> reload, store 2
    reloadForChunkError(); // count 2 -> at cap, no reload

    expect(reloadSpy).toHaveBeenCalledTimes(2);
    expect(sessionStorage.getItem(RELOAD_COUNT_KEY)).toBe("2");
  });

  it("invokes the inline startup-error panel when the budget is exhausted", () => {
    const panel = vi.fn();
    (
      window as unknown as { __ORGII_SHOW_STARTUP_ERROR__?: () => void }
    ).__ORGII_SHOW_STARTUP_ERROR__ = panel;

    reloadForChunkError();
    reloadForChunkError();
    reloadForChunkError(); // exhausted

    expect(panel).toHaveBeenCalledTimes(1);
    expect(reloadSpy).toHaveBeenCalledTimes(2);
  });

  it("falls back to onGiveUp when no inline panel is registered", () => {
    const onGiveUp = vi.fn();

    reloadForChunkError(onGiveUp);
    reloadForChunkError(onGiveUp);
    reloadForChunkError(onGiveUp); // exhausted, no inline panel

    expect(onGiveUp).toHaveBeenCalledTimes(1);
    expect(reloadSpy).toHaveBeenCalledTimes(2);
  });

  it("prefers the inline panel over onGiveUp when both exist", () => {
    const panel = vi.fn();
    const onGiveUp = vi.fn();
    (
      window as unknown as { __ORGII_SHOW_STARTUP_ERROR__?: () => void }
    ).__ORGII_SHOW_STARTUP_ERROR__ = panel;

    reloadForChunkError(onGiveUp);
    reloadForChunkError(onGiveUp);
    reloadForChunkError(onGiveUp);

    expect(panel).toHaveBeenCalledTimes(1);
    expect(onGiveUp).not.toHaveBeenCalled();
  });

  it("still attempts one reload if sessionStorage write throws", () => {
    const setItemSpy = vi
      .spyOn(sessionStorage, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });

    reloadForChunkError();

    // Write failed but we still reload once (best-effort recovery).
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    setItemSpy.mockRestore();
  });

  it("treats a corrupt counter value as zero and reloads", () => {
    sessionStorage.setItem(RELOAD_COUNT_KEY, "not-a-number");

    reloadForChunkError();

    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(RELOAD_COUNT_KEY)).toBe("1");
  });
});

describe("resetChunkReloadCount", () => {
  it("clears the counter so a later failure gets a fresh retry budget", () => {
    reloadForChunkError();
    reloadForChunkError();
    expect(sessionStorage.getItem(RELOAD_COUNT_KEY)).toBe("2");

    resetChunkReloadCount();
    expect(sessionStorage.getItem(RELOAD_COUNT_KEY)).toBeNull();

    // After reset, the full budget is available again.
    reloadForChunkError();
    reloadForChunkError();
    reloadForChunkError();
    expect(reloadSpy).toHaveBeenCalledTimes(4); // 2 before reset + 2 after
  });

  it("is a no-op when sessionStorage.removeItem throws", () => {
    const removeSpy = vi
      .spyOn(sessionStorage, "removeItem")
      .mockImplementation(() => {
        throw new Error("SecurityError");
      });

    expect(() => resetChunkReloadCount()).not.toThrow();
    removeSpy.mockRestore();
  });
});
