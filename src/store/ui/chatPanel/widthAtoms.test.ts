// @vitest-environment jsdom
import { createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cssVar = "--orgii-chat-width";

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.stubGlobal("innerWidth", 1200);
  localStorage.clear();
  document.documentElement.style.removeProperty(cssVar);
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.documentElement.style.removeProperty(cssVar);
  localStorage.clear();
});

// innerWidth 1200 → 1116 available (minus the 64px rail and 20px gutter);
// the 2/5 default preset seeds 446 and the 3/5 ceiling clamps to 669.
const SEEDED_FROM_DEFAULT_RATIO = 446;

describe("chat width initialization", () => {
  it.each([
    [null, SEEDED_FROM_DEFAULT_RATIO],
    ["480", 480],
    ["0", 0],
    ["900", 669],
    ["100", 420],
    ["invalid-json", SEEDED_FROM_DEFAULT_RATIO],
  ])(
    "initializes persisted %s to %s before rendering",
    async (stored, expected) => {
      if (stored !== null) localStorage.setItem("globalChatWidth", stored);
      const { chatWidthAtom, initializeChatWidthStyles } =
        await import("./widthAtoms");
      const store = createStore();
      expect(store.get(chatWidthAtom)).toBe(expected);
      // Importing an unrelated state owner must not be the CSS startup mechanism.
      expect(document.documentElement.style.getPropertyValue(cssVar)).toBe("");
      initializeChatWidthStyles(store);
      expect(document.documentElement.style.getPropertyValue(cssVar)).toBe(
        `${expected}px`
      );
    }
  );

  it("uses the current store value on repeated initialization", async () => {
    const { chatWidthAtom, initializeChatWidthStyles } =
      await import("./widthAtoms");
    const store = createStore();
    initializeChatWidthStyles(store);
    store.set(chatWidthAtom, 450);
    initializeChatWidthStyles(store);
    expect(store.get(chatWidthAtom)).toBe(450);
    expect(document.documentElement.style.getPropertyValue(cssVar)).toBe(
      "450px"
    );
    expect(localStorage.getItem("globalChatWidth")).toBeNull();
    vi.advanceTimersByTime(300);
    expect(localStorage.getItem("globalChatWidth")).toBe("450");
  });

  it("preserves hidden width and restores the last visible width", async () => {
    const {
      chatWidthAtom,
      chatVisibleAtom,
      restoreChatWidthAtom,
      initializeChatWidthStyles,
    } = await import("./widthAtoms");
    const store = createStore();
    store.set(chatWidthAtom, 480);
    vi.advanceTimersByTime(300);
    store.set(chatWidthAtom, 0);
    initializeChatWidthStyles(store);
    expect(store.get(chatVisibleAtom)).toBe(false);
    expect(document.documentElement.style.getPropertyValue(cssVar)).toBe("0px");
    expect(localStorage.getItem("globalChatWidth")).toBe("480");
    store.set(restoreChatWidthAtom);
    expect(store.get(chatWidthAtom)).toBe(480);
    expect(document.documentElement.style.getPropertyValue(cssVar)).toBe(
      "480px"
    );
  });

  it("re-applies a picked preset over the persisted width", async () => {
    localStorage.setItem("globalChatWidth", "480");
    const { chatWidthAtom, adoptDefaultChatWidthAtom } =
      await import("./widthAtoms");
    const { getChatWidthForRatio } =
      await import("@src/engines/ChatPanel/config");
    const store = createStore();
    store.set(adoptDefaultChatWidthAtom, getChatWidthForRatio("three-fifths"));
    expect(store.get(chatWidthAtom)).toBe(669);
    vi.advanceTimersByTime(300);
    expect(localStorage.getItem("globalChatWidth")).toBe("669");
  });

  it("stores a preset picked while the pane is hidden as the restore width", async () => {
    const { chatWidthAtom, adoptDefaultChatWidthAtom, restoreChatWidthAtom } =
      await import("./widthAtoms");
    const { getChatWidthForRatio } =
      await import("@src/engines/ChatPanel/config");
    const store = createStore();
    store.set(chatWidthAtom, 0);
    store.set(adoptDefaultChatWidthAtom, getChatWidthForRatio("half"));
    // The pane stays collapsed — the preset only changes what it reopens at.
    expect(store.get(chatWidthAtom)).toBe(0);
    store.set(restoreChatWidthAtom);
    expect(store.get(chatWidthAtom)).toBe(558);
  });

  it("coalesces repeated resize persistence without adding startup timers", async () => {
    const { chatWidthAtom, initializeChatWidthStyles } =
      await import("./widthAtoms");
    const store = createStore();
    initializeChatWidthStyles(store);
    expect(vi.getTimerCount()).toBe(0);
    store.set(chatWidthAtom, 430);
    store.set(chatWidthAtom, 490);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(300);
    expect(localStorage.getItem("globalChatWidth")).toBe("490");
    // jsdom queues a zero-delay storage event for the completed write.
    vi.advanceTimersByTime(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
