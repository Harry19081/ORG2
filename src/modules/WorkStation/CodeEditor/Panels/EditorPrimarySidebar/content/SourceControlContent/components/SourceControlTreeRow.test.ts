// @vitest-environment jsdom
import { Provider, createStore } from "jotai";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { settingsAtom } from "@src/store/settings/settingsAtom";
import { gitSourceControlColorFileNamesAtom } from "@src/store/ui/editorSettingsAtom";

import SourceControlTreeRow from "./SourceControlTreeRow";

vi.mock("@src/scaffold/ActionSystem", () => ({
  useActionSystemOptional: () => null,
}));
vi.mock("@src/hooks/files/useNativeDrag", () => ({
  useNativeDrag: () => ({ handleMouseDown: vi.fn() }),
}));

vi.mock("./SourceControlContextMenu", () => ({ default: () => null }));

describe("SourceControlTreeRow section actions", () => {
  it("reveals all unstaged actions together without mixing opacity fades and display changes", () => {
    const root = document.createElement("div");
    root.innerHTML = renderToStaticMarkup(
      createElement(SourceControlTreeRow, {
        node: {
          path: "unstaged",
          name: "Changes",
          isFolder: true,
          expanded: true,
          nodeType: "section-header",
          section: "unstaged",
          count: 112,
        },
        depth: 0,
        onStashPush: vi.fn(),
        hasChangesToStash: true,
      })
    );
    expect(root.querySelector("button[aria-expanded]")).not.toBeNull();
    const actions = root.querySelectorAll<HTMLButtonElement>(
      "button:not([aria-expanded])"
    );
    expect(actions).toHaveLength(3);
    const group = actions[0].parentElement!;
    expect(group.classList.contains("gap-px")).toBe(true);
    expect(group.classList.contains("hidden")).toBe(true);
    expect(group.classList.contains("group-hover/header:flex")).toBe(true);
    expect(group.classList.contains("group-focus-within/header:flex")).toBe(
      true
    );
    for (const action of actions) {
      expect(action.parentElement).toBe(group);
      expect(action.style.width).toBe("20px");
      expect(action.classList.contains("shrink-0")).toBe(true);
      expect(action.className).not.toContain("opacity-0");
    }
  });
  it("groups file actions at 1px without grouping the status badge", () => {
    const root = document.createElement("div");
    root.innerHTML = renderToStaticMarkup(
      createElement(SourceControlTreeRow, {
        node: {
          path: "file.ts",
          name: "file.ts",
          isFolder: false,
          expanded: false,
          nodeType: "file",
          section: "unstaged",
          file: {
            id: "file.ts",
            path: "file.ts",
            status: "modified",
            staged: false,
            additions: 1,
            deletions: 0,
          },
        },
        depth: 0,
        onDiscard: vi.fn(),
        onStageToggle: vi.fn(),
      })
    );
    const actions = root.querySelectorAll("button");
    expect(actions).toHaveLength(2);
    const group = actions[0].parentElement!;
    expect(actions[1].parentElement).toBe(group);
    expect(group.classList.contains("gap-px")).toBe(true);
    expect(group.classList.contains("group-hover/item:flex")).toBe(true);
    expect(group.children).toHaveLength(2);
    expect(group.nextElementSibling).not.toBeNull();
  });

  it("colors file names by diff status only when the default-off setting is enabled", () => {
    const store = createStore();
    const fileNode = {
      path: "file.ts",
      name: "file.ts",
      isFolder: false,
      expanded: false,
      nodeType: "file" as const,
      section: "unstaged" as const,
      file: {
        id: "file.ts",
        path: "file.ts",
        status: "modified" as const,
        staged: false,
        additions: 1,
        deletions: 0,
      },
    };
    const renderRow = () => {
      const root = document.createElement("div");
      root.innerHTML = renderToStaticMarkup(
        createElement(
          Provider,
          { store },
          createElement(SourceControlTreeRow, {
            node: fileNode,
            depth: 0,
          })
        )
      );
      return root.querySelector<HTMLElement>('span[title="file.ts"]')!;
    };

    expect(store.get(gitSourceControlColorFileNamesAtom)).toBe(false);
    expect(renderRow().classList.contains("text-warning-6")).toBe(false);

    store.set(settingsAtom, (settings) => ({
      ...settings,
      "git.sourceControl.colorFileNames": true,
    }));
    expect(renderRow().classList.contains("text-warning-6")).toBe(true);
  });
});
