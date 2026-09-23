// @vitest-environment jsdom
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

import type { PrFile } from "@src/api/tauri/github";
import { testTranslate, useTestTranslation } from "@src/test/i18nTestTranslate";

import { PrFlowHeader } from "./PrFlowHeader";

const clipboard = vi.hoisted(() => ({
  copyText: vi.fn().mockResolvedValue(undefined),
}));
const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));
const branchApi = vi.hoisted(() => ({
  list: vi.fn().mockResolvedValue(["develop", "release"]),
}));

vi.mock("@src/api/tauri/github", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@src/api/tauri/github")>()),
  listPRBaseBranchesLocal: branchApi.list,
}));

vi.mock("react-i18next", () => ({
  useTranslation: (...args: Parameters<typeof useTestTranslation>) =>
    useTestTranslation(...args),
}));

vi.mock("@src/util/data/clipboard", () => ({
  copyText: clipboard.copyText,
}));

vi.mock("@src/components/Message", () => ({
  default: toast,
}));

describe("PrFlowHeader", () => {
  let container: HTMLDivElement;
  let root: Root;
  const actEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  };

  beforeAll(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    clipboard.copyText.mockClear();
    toast.success.mockClear();
    toast.error.mockClear();
    branchApi.list.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  afterAll(() => {
    Reflect.deleteProperty(actEnvironment, "IS_REACT_ACT_ENVIRONMENT");
  });

  const openIdentity = {
    number: 7,
    title: "Refine the flow header",
    url: "https://github.com/org/repo/pull/7",
    status: "open",
    headBranch: "feature/flow-header",
    baseBranch: "develop",
  };

  it("renders the GitHub-flow sentence for an open PR with singular commits", () => {
    act(() => {
      root.render(
        createElement(PrFlowHeader, {
          identity: openIdentity,
          detail: {
            commits: 1,
            additions: 12,
            deletions: 3,
            user: { login: "author", avatar_url: "https://a.example/a.png" },
          },
          baseBranch: "develop",
          commitCount: 0,
          files: [],
        })
      );
    });

    const title = container.querySelector("[data-testid='pr-flow-title']");
    expect(title?.textContent).toContain("Refine the flow header");
    expect(title?.textContent).toContain("#7");
    const status = container.querySelector("[data-testid='pr-flow-status']");
    expect(status?.textContent).toContain(
      testTranslate("common:git.pr.status.open")
    );
    expect(status?.firstElementChild?.className).toContain("bg-success-1");
    const subline = container.querySelector("[data-testid='pr-flow-subline']");
    expect(subline?.textContent).toContain("author");
    expect(subline?.textContent).toContain("wants to merge 1 commit into");
    expect(subline?.textContent).not.toContain("commits into");
    expect(subline?.textContent).toContain("develop");
    expect(subline?.textContent).toContain("from");
    expect(subline?.textContent).toContain("feature/flow-header");
    expect(subline?.textContent).toContain("+12");
    expect(subline?.textContent).toContain("-3");
  });

  it("credits the merger on merged PRs and falls back to file diff stats", () => {
    act(() => {
      root.render(
        createElement(PrFlowHeader, {
          identity: { ...openIdentity, status: "merged" },
          detail: {
            user: { login: "author", avatar_url: "" },
            merged_by: { login: "merger", avatar_url: "" },
          },
          baseBranch: "develop",
          commitCount: 4,
          files: [
            { filename: "a.ts", additions: 5, deletions: 2 },
            { filename: "b.ts", additions: 1, deletions: 0 },
          ] as unknown as PrFile[],
        })
      );
    });

    const subline = container.querySelector("[data-testid='pr-flow-subline']");
    expect(subline?.textContent).toContain("merger");
    expect(subline?.textContent).toContain("merged 4 commits into");
    expect(subline?.textContent).not.toContain("wants to merge");
    expect(subline?.textContent).toContain("+6");
    expect(subline?.textContent).toContain("-2");
  });

  it("copies the head branch name from the flow subline", async () => {
    act(() => {
      root.render(
        createElement(PrFlowHeader, {
          identity: openIdentity,
          detail: null,
          baseBranch: "develop",
          commitCount: 2,
          files: [],
        })
      );
    });

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>("[data-testid='pr-flow-copy-branch']")
        ?.click();
      await Promise.resolve();
    });

    expect(clipboard.copyText).toHaveBeenCalledWith("feature/flow-header");
    expect(toast.success).toHaveBeenCalledWith("Branch name copied");
  });

  it("saves a changed title and description", async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    act(() =>
      root.render(
        createElement(PrFlowHeader, {
          identity: openIdentity,
          detail: { title: "Original", body: "Old description" },
          baseBranch: "develop",
          commitCount: 1,
          files: [],
          repoFullName: "org/repo",
          onUpdate,
        })
      )
    );
    act(() =>
      container
        .querySelector<HTMLButtonElement>("[data-testid='pr-flow-edit']")
        ?.click()
    );
    const title = container.querySelector<HTMLInputElement>("#pr-edit-title");
    const body = container.querySelector<HTMLTextAreaElement>("#pr-edit-body");
    expect(title?.value).toBe("Original");
    expect(body?.value).toBe("Old description");
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set;
      setter?.call(title, "Revised title");
      title?.dispatchEvent(new Event("input", { bubbles: true }));
      const bodySetter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value"
      )?.set;
      bodySetter?.call(body, "Revised description");
      body?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>("[data-testid='pr-flow-save']")
        ?.click();
      await Promise.resolve();
    });
    expect(onUpdate).toHaveBeenCalledWith({
      title: "Revised title",
      body: "Revised description",
    });
  });

  it("loads target branches only when opened and submits the selected base", async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    act(() =>
      root.render(
        createElement(PrFlowHeader, {
          identity: openIdentity,
          detail: null,
          baseBranch: "develop",
          commitCount: 1,
          files: [],
          repoFullName: "org/repo",
          onUpdate,
        })
      )
    );
    expect(branchApi.list).not.toHaveBeenCalled();
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>("[data-testid='pr-flow-base-branch']")
        ?.click();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(branchApi.list).toHaveBeenCalledWith("org/repo");
    await act(async () => {
      [...document.querySelectorAll<HTMLElement>("[role='option']")]
        .find((option) => option.textContent?.includes("release"))
        ?.click();
      await Promise.resolve();
    });
    expect(onUpdate).toHaveBeenCalledWith({ base: "release" });
  });

  it("lets the user enter an exact branch beyond the bounded branch list", async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    act(() =>
      root.render(
        createElement(PrFlowHeader, {
          identity: openIdentity,
          detail: null,
          baseBranch: "develop",
          commitCount: 1,
          files: [],
          repoFullName: "org/repo",
          onUpdate,
        })
      )
    );
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>("[data-testid='pr-flow-base-branch']")
        ?.click();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    const search = document.querySelector<HTMLInputElement>(
      "input[placeholder='Find a branch…']"
    );
    expect(search).not.toBeNull();
    expect(document.querySelectorAll("[role='option']").length).toBeGreaterThan(
      0
    );
    act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set?.call(search, "release/next");
      search?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(search?.value).toBe("release/next");
    expect(
      [...document.querySelectorAll<HTMLElement>("[role='option']")].map(
        (option) => option.textContent
      )
    ).toContain("Use release/next");
    await act(async () => {
      [...document.querySelectorAll<HTMLElement>("[role='option']")]
        .find((option) => option.textContent?.includes("release/next"))
        ?.click();
      await Promise.resolve();
    });
    expect(onUpdate).toHaveBeenCalledWith({ base: "release/next" });
  });
});
