// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

import DocumentOpenMenu from "./index";

vi.mock("./documentApplications", () => ({
  loadDocumentApplications: vi.fn().mockResolvedValue([]),
  openDocument: vi.fn(),
}));
vi.mock("@src/util/platform/tauri", () => ({
  isMacOS: () => false,
  isTauriDesktop: () => true,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@src/components/Message", () => ({ default: { error: vi.fn() } }));
vi.mock("@src/components/Button", () => ({
  default: ({
    size: _size,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { size?: string }) =>
    React.createElement("button", props),
}));

it("opens real dropdown options inside a themed opaque menu surface", async () => {
  const environment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        React.createElement(DocumentOpenMenu, {
          filePath: "/example.csv",
          hasUnsavedChanges: false,
        })
      )
    );
    await act(async () => container.querySelector("button")!.click());
    const list = container.querySelector('[role="listbox"]');
    expect(list).not.toBeNull();
    const surface = list!.closest(".bg-bg-2");
    expect(surface).not.toBeNull();
    for (const token of [
      "border",
      "border-border-2",
      "rounded-lg",
      "shadow-dropdown",
      "w-max",
    ]) {
      expect(surface!.classList.contains(token)).toBe(true);
    }
    expect(list!.textContent).toContain("documentOpen.defaultApp");
  } finally {
    await act(async () => root.unmount());
    container.remove();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});
