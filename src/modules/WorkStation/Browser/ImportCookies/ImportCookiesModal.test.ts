// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

import type { CookieImportSource } from "@src/api/tauri/browserCookies";

import ImportCookiesModal from "./ImportCookiesModal";
import type {
  ImportCookiesController,
  ImportStage,
} from "./useImportCookiesController";

const state = vi.hoisted(() => ({
  importing: true,
  stage: "preview" as ImportStage,
  sources: [] as CookieImportSource[],
  selectSource: vi.fn(),
  refreshSources: vi.fn(),
  openFullDiskAccessSettings: vi.fn(),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("./useImportCookiesController", () => ({
  useImportCookiesController: () =>
    ({
      stage: state.stage,
      sourcesLoading: false,
      sources: state.sources,
      activeSource: null,
      previewLoading: false,
      preview: null,
      selectedDomains: new Set<string>(),
      importing: state.importing,
      result: null,
      selectSource: state.selectSource,
      refreshSources: state.refreshSources,
      openFullDiskAccessSettings: state.openFullDiskAccessSettings,
      toggleDomain: vi.fn(),
      setAllDomains: vi.fn(),
      runImport: vi.fn(),
      backToSources: vi.fn(),
    }) satisfies ImportCookiesController,
}));
afterEach(() => vi.unstubAllGlobals());
it("prevents dismissal during import and restores closure after the request settles", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const onClose = vi.fn();
  const render = () =>
    act(() => root.render(createElement(ImportCookiesModal, { onClose })));
  try {
    render();
    expect(document.querySelector('button[title="Close"]')).toBeNull();
    const cancel = [
      ...document.querySelectorAll<HTMLButtonElement>("button"),
    ].find((b) => b.textContent === "actions.cancel")!;
    expect(cancel.disabled).toBe(true);
    act(() => {
      cancel.click();
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
      document.querySelector<HTMLElement>(".liquid-modal-mask")!.click();
    });
    expect(onClose).not.toHaveBeenCalled();
    state.importing = false;
    render();
    act(() =>
      document
        .querySelector<HTMLButtonElement>('button[title="Close"]')!
        .click()
    );
    expect(onClose).toHaveBeenCalledOnce();
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});

it("puts a blocked source's way out in its own row", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.importing = false;
  state.stage = "sources";
  state.sources = [
    {
      id: "safari",
      kind: "safari",
      browserId: "safari",
      browserLabel: "Safari",
      profileLabel: null,
      unavailableReason: "needs_full_disk_access",
    },
    {
      id: "chrome:Default",
      kind: "chromium",
      browserId: "chrome",
      browserLabel: "Chrome",
      profileLabel: "Default",
      unavailableReason: null,
    },
  ];
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    act(() =>
      root.render(createElement(ImportCookiesModal, { onClose: vi.fn() }))
    );

    const blockedRow = document.querySelector<HTMLElement>(
      '[data-testid="cookie-source-blocked"]'
    )!;
    expect(blockedRow.textContent).toContain("Safari");
    expect(blockedRow.textContent).toContain(
      "browserCookieImport.safari.needsFullDiskAccess"
    );
    // The row is not itself a button: there is no store to open yet.
    expect(blockedRow.tagName).toBe("DIV");

    const rowButton = (label: string) =>
      [...blockedRow.querySelectorAll<HTMLButtonElement>("button")].find(
        (button) => button.textContent === label
      )!;
    act(() => rowButton("browserCookieImport.safari.openSettings").click());
    expect(state.openFullDiskAccessSettings).toHaveBeenCalledOnce();
    // Re-scan is an icon-only button, so its name lives in the label.
    const checkAgain = blockedRow.querySelector<HTMLButtonElement>(
      'button[aria-label="browserCookieImport.safari.checkAgain"]'
    )!;
    expect(checkAgain.textContent).toBe("");
    act(() => checkAgain.click());
    expect(state.refreshSources).toHaveBeenCalledOnce();
    expect(state.selectSource).not.toHaveBeenCalled();

    // The explanation no longer takes a block of its own below the list.
    expect(document.body.textContent).not.toContain(
      "browserCookieImport.safari.explain"
    );

    // A readable source is still one click to its preview.
    const chromeRow = [
      ...document.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) => button.textContent?.includes("Chrome"))!;
    act(() => chromeRow.click());
    expect(state.selectSource).toHaveBeenCalledWith("chrome:Default");
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});
