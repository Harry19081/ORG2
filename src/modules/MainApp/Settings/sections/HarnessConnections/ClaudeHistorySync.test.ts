// @vitest-environment jsdom
import { Provider } from "jotai";
import { act, createElement } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import {
  USER_A,
  signedInStore,
} from "@src/features/MarketConnect/identity.test-utils";
import { org2CloudAuthAtom } from "@src/features/Org2Cloud/org2CloudAuthAtom";
import { getInstrumentedStore } from "@src/util/core/state/instrumentedStore";

import ClaudeHistorySync from "./ClaudeHistorySync";

const inspect = vi.fn();
vi.mock("@src/features/MarketConnect/claudeHistory", () => ({
  inspectClaudeHistory: (...args: unknown[]) => inspect(...args),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@src/components/Select", () => ({
  default: ({
    options,
    onChange,
    value,
    disabled,
  }: {
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
    value: string;
    disabled: boolean;
  }) =>
    createElement(
      "select",
      {
        value: value ?? "",
        disabled,
        onChange: (event: { target: { value: string } }) =>
          onChange(event.target.value),
      },
      createElement("option", { value: "" }, "Choose"),
      ...options.map((item) =>
        createElement(
          "option",
          { key: item.value, value: item.value },
          item.label
        )
      )
    ),
}));

const sessionId = "11111111-1111-4111-8111-111111111111";
const preview = {
  status: "clean",
  items: [{ sessionId, title: "Existing conversation", status: "ready" }],
};
let container: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  signedInStore();
  inspect.mockReset().mockResolvedValue(preview);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      createElement(
        Provider,
        { store: getInstrumentedStore() },
        createElement(ClaudeHistorySync, {
          identityUserId: USER_A,
          disabled: false,
        })
      )
    )
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
const button = (key: string) =>
  [...container.querySelectorAll("button")].find(
    (item) => item.textContent === `harnessConnections.claudeHistory.${key}`
  )!;

it("does no work on mount and requires preview then explicit UUID selection", async () => {
  expect(inspect).not.toHaveBeenCalled();
  await act(async () => button("preview").click());
  expect(inspect).toHaveBeenLastCalledWith(null, "list");
  expect(button("sync").disabled).toBe(true);
  await act(async () => {
    const select = container.querySelector("select")!;
    select.value = sessionId;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(async () => button("sync").click());
  expect(inspect).toHaveBeenLastCalledWith(sessionId, "sync");
  expect(inspect).toHaveBeenCalledTimes(2);
});

it("does not expose a late preview after logout", async () => {
  let finish!: (value: typeof preview) => void;
  inspect.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  await act(async () => button("preview").click());
  await act(async () => {
    getInstrumentedStore().set(org2CloudAuthAtom, null);
    finish(preview);
  });
  expect(container.textContent).not.toContain("Existing conversation");
  expect(container.querySelector("select")).toBeNull();
});

it("shows safe failure copy without native paths or error payloads", async () => {
  inspect.mockRejectedValueOnce(new Error("secret /private/path"));
  await act(async () => button("preview").click());
  expect(container.textContent).toContain(
    "harnessConnections.claudeHistory.status.failed"
  );
  expect(container.textContent).not.toContain("secret");
});

it("clears a completed preview when the identity prop changes", async () => {
  await act(async () => button("preview").click());
  expect(container.querySelector("select")).not.toBeNull();
  await act(async () =>
    root.render(
      createElement(
        Provider,
        { store: getInstrumentedStore() },
        createElement(ClaudeHistorySync, {
          identityUserId: "22222222-2222-4222-8222-222222222222",
          disabled: false,
        })
      )
    )
  );
  expect(container.querySelector("select")).toBeNull();
  await act(async () => button("preview").click());
  expect(button("preview").disabled).toBe(true);
  expect(inspect).toHaveBeenCalledOnce();
});

it("cannot sync an unsupported history even after selecting its UUID", async () => {
  inspect.mockResolvedValueOnce({
    status: "unsupported",
    items: [{ ...preview.items[0], status: "unsupported" }],
  });
  await act(async () => button("preview").click());
  await act(async () => {
    const select = container.querySelector("select")!;
    select.value = sessionId;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(button("sync").disabled).toBe(true);
  expect(container.textContent).toContain(
    "harnessConnections.claudeHistory.status.unsupported"
  );
  expect(inspect).toHaveBeenCalledOnce();
});

it("explicitly resumes a recoverable journal without preview doing the work", async () => {
  inspect.mockResolvedValueOnce({
    status: "recovery_ready",
    items: [{ ...preview.items[0], status: "recovery_ready" }],
  });
  await act(async () => button("preview").click());
  await act(async () => {
    const select = container.querySelector("select")!;
    select.value = sessionId;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(button("sync").disabled).toBe(false);
  await act(async () => button("sync").click());
  expect(inspect).toHaveBeenCalledTimes(2);
  expect(inspect).toHaveBeenLastCalledWith(sessionId, "sync");
});

it("clears an already completed preview on logout", async () => {
  await act(async () => button("preview").click());
  expect(container.querySelector("select")).not.toBeNull();
  await act(async () => getInstrumentedStore().set(org2CloudAuthAtom, null));
  expect(container.querySelector("select")).toBeNull();
  expect(button("preview").disabled).toBe(true);
});

it("lists unchecked rows and inspects only the selected conversation before syncing", async () => {
  inspect.mockResolvedValueOnce({
    status: "unchecked",
    items: [{ ...preview.items[0], status: "unchecked" }],
  });
  await act(async () => button("preview").click());
  await act(async () => {
    const select = container.querySelector("select")!;
    select.value = sessionId;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(button("sync").disabled).toBe(true);
  await act(async () => button("inspect").click());
  expect(inspect).toHaveBeenLastCalledWith(sessionId, "inspect");
  expect(button("sync").disabled).toBe(false);
  await act(async () => button("sync").click());
  expect(inspect).toHaveBeenLastCalledWith(sessionId, "sync");
});
