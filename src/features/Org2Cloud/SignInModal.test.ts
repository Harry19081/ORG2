// @vitest-environment jsdom
import { Provider, createStore } from "jotai";
import React, { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SignInModal } from "./SignInModal";
import { org2CloudAuthAtom } from "./org2CloudAuthAtom";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("SignInModal", () => {
  let container: HTMLDivElement;
  let root: Root;
  let store: ReturnType<typeof createStore>;
  const environment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  };

  beforeEach(() => {
    environment.IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    localStorage.clear();
    store = createStore();
    store.set(org2CloudAuthAtom, null);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
    Reflect.deleteProperty(environment, "IS_REACT_ACT_ENVIRONMENT");
  });

  it("stays open while browser sign-in is pending, then confirms success before closing", async () => {
    const onClose = vi.fn();
    const onSignIn = vi.fn();

    await act(async () => {
      root.render(
        React.createElement(
          Provider,
          { store },
          React.createElement(SignInModal, { onClose, onSignIn })
        )
      );
    });

    const dialog = () => document.querySelector('[role="dialog"]');
    const originalDialog = dialog();
    const originalPanel = dialog()?.querySelector(".liquid-modal-content");
    const login = Array.from(dialog()!.querySelectorAll("button")).find(
      (button) => button.textContent === "cloud.signIn"
    )!;
    await act(async () => login.click());

    expect(onSignIn).toHaveBeenCalledOnce();
    expect(dialog()).toBe(originalDialog);
    expect(dialog()?.querySelector(".liquid-modal-content")).toBe(
      originalPanel
    );
    expect(dialog()?.textContent).toContain("auth:loading.waiting");
    expect(
      dialog()?.querySelector("img.visible")?.getAttribute("src")
    ).toContain("login-waiting");
    expect(onClose).not.toHaveBeenCalled();

    const visibility = vi
      .spyOn(document, "visibilityState", "get")
      .mockReturnValue("hidden");
    await act(async () => {
      store.set(org2CloudAuthAtom, {
        kind: "org2_cloud",
        supabaseUrl: "https://cloud.example.test",
        supabaseAnonKey: "test-anon-key",
        userId: "user-1",
        accessToken: "test-access-token",
        refreshToken: "test-refresh-token",
        expiresAt: 2_000_000_000,
      });
    });

    expect(dialog()?.textContent).toContain("auth:loading.success");
    expect(dialog()).toBe(originalDialog);
    expect(dialog()?.querySelector(".liquid-modal-content")).toBe(
      originalPanel
    );
    expect(
      dialog()?.querySelector("img.visible")?.getAttribute("src")
    ).toContain("login-success");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(onClose).not.toHaveBeenCalled();
    act(() => {
      visibility.mockReturnValue("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1999);
    });
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps the same dialog for browser-launch failure and retry", async () => {
    const onClose = vi.fn();
    const onSignIn = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    await act(async () =>
      root.render(
        React.createElement(
          Provider,
          { store },
          React.createElement(SignInModal, { onClose, onSignIn })
        )
      )
    );
    const dialog = document.querySelector('[role="dialog"]')!;
    const clickLogin = () =>
      Array.from(dialog.querySelectorAll("button"))
        .find((button) => button.textContent === "cloud.signIn")!
        .click();
    await act(async () => clickLogin());
    expect(document.querySelector('[role="dialog"]')).toBe(dialog);
    expect(dialog.textContent).toContain("auth:loading.failed");
    expect(dialog.querySelector("img.visible")?.getAttribute("src")).toContain(
      "login-failure"
    );
    await act(async () => clickLogin());
    expect(dialog.textContent).toContain("auth:loading.waiting");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("cancels the success close timer when the modal unmounts", async () => {
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        React.createElement(
          Provider,
          { store },
          React.createElement(SignInModal, { onClose, onSignIn: vi.fn() })
        )
      );
    });
    const dialog = () => document.querySelector('[role="dialog"]');
    const login = Array.from(dialog()!.querySelectorAll("button")).find(
      (button) => button.textContent === "cloud.signIn"
    )!;
    await act(async () => {
      login.click();
      store.set(org2CloudAuthAtom, {
        kind: "org2_cloud",
        supabaseUrl: "https://cloud.example.test",
        supabaseAnonKey: "test-anon-key",
        userId: "user-1",
        accessToken: "test-access-token",
        refreshToken: "test-refresh-token",
        expiresAt: 2_000_000_000,
      });
    });

    act(() => root.render(null));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(onClose).not.toHaveBeenCalled();
  });
});
