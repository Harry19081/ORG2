import { describe, expect, it } from "vitest";

import type { GitFile } from "@src/types/git/types";

import {
  type SourceControlMainTabData,
  deriveSourceControlMainProps,
  getGitFileForPath,
} from "../sourceControlMainProps";

function createGitFile(overrides: Partial<GitFile> = {}): GitFile {
  return {
    path: "src/a.ts",
    status: "modified",
    staged: false,
    ...overrides,
  } as GitFile;
}

function createInput(
  overrides: Partial<Parameters<typeof deriveSourceControlMainProps>[0]> = {}
): Parameters<typeof deriveSourceControlMainProps>[0] {
  return {
    tabData: {},
    gitFilesByPath: new Map(),
    sourceControlAttributedFiles: [],
    sourceControlFilterMode: "uncommitted",
    sourceControlSessionFilter: "all",
    repoPath: "/repo",
    ...overrides,
  };
}

describe("getGitFileForPath", () => {
  it("returns an exact relative-path match", () => {
    const file = createGitFile({ path: "src/a.ts" });
    const map = new Map([["src/a.ts", file]]);
    expect(getGitFileForPath("src/a.ts", "/repo", map)).toBe(file);
  });

  it("resolves a host-absolute path against the relative key", () => {
    const file = createGitFile({ path: "src/a.ts" });
    const map = new Map([["src/a.ts", file]]);
    expect(getGitFileForPath("/repo/src/a.ts", "/repo", map)).toBe(file);
  });

  it("resolves a worktree path via the file's repoRoot prefix", () => {
    const file = createGitFile({ path: "src/a.ts", repoRoot: "/wt" });
    const map = new Map([["src/a.ts", file]]);
    expect(getGitFileForPath("/wt/src/a.ts", "/repo", map)).toBe(file);
  });

  it("returns undefined when nothing matches", () => {
    const map = new Map([["src/a.ts", createGitFile()]]);
    expect(getGitFileForPath("src/missing.ts", "/repo", map)).toBeUndefined();
  });
});

describe("deriveSourceControlMainProps", () => {
  it("defaults mode to focus and reports no focus when focusPath is empty", () => {
    const result = deriveSourceControlMainProps(createInput());
    expect(result.mode).toBe("focus");
    expect(result.hasFocus).toBe(false);
    expect(result.focusGitFile).toBeNull();
  });

  it("honours all-changes mode and staged flag from tab data", () => {
    const tabData: SourceControlMainTabData = {
      mode: "all-changes",
      staged: true,
    };
    const result = deriveSourceControlMainProps(createInput({ tabData }));
    expect(result.mode).toBe("all-changes");
    expect(result.staged).toBe(true);
  });

  it("prefers attributed files over the raw git status map", () => {
    const attributed = createGitFile({ path: "attributed.ts" });
    const status = createGitFile({ path: "status.ts" });
    const result = deriveSourceControlMainProps(
      createInput({
        sourceControlAttributedFiles: [attributed],
        gitFilesByPath: new Map([["status.ts", status]]),
      })
    );
    expect(result.allFiles).toEqual([attributed]);
  });

  it("falls back to embedded tab files when no status/attribution exists", () => {
    const embedded = createGitFile({ path: "embedded.ts" });
    const result = deriveSourceControlMainProps(
      createInput({ tabData: { files: [embedded] } })
    );
    expect(result.allFiles).toEqual([embedded]);
  });

  it("filters to staged files when filter mode is staged", () => {
    const staged = createGitFile({ path: "staged.ts", staged: true });
    const unstaged = createGitFile({ path: "unstaged.ts", staged: false });
    const result = deriveSourceControlMainProps(
      createInput({
        sourceControlAttributedFiles: [staged, unstaged],
        sourceControlFilterMode: "staged",
      })
    );
    expect(result.allFiles).toEqual([staged]);
  });

  it("filters to unstaged files when filter mode is unstaged", () => {
    const staged = createGitFile({ path: "staged.ts", staged: true });
    const unstaged = createGitFile({ path: "unstaged.ts", staged: false });
    const result = deriveSourceControlMainProps(
      createInput({
        sourceControlAttributedFiles: [staged, unstaged],
        sourceControlFilterMode: "unstaged",
      })
    );
    expect(result.allFiles).toEqual([unstaged]);
  });

  it("keeps only files without a session for the 'other' session filter", () => {
    const owned = createGitFile({ path: "owned.ts", sourceSessionId: "s1" });
    const other = createGitFile({ path: "other.ts" });
    const result = deriveSourceControlMainProps(
      createInput({
        sourceControlAttributedFiles: [owned, other],
        sourceControlFilterMode: "uncommitted",
        sourceControlSessionFilter: "other",
      })
    );
    expect(result.allFiles).toEqual([other]);
  });

  it("keeps only files matching a specific session id filter", () => {
    const s1 = createGitFile({ path: "s1.ts", sourceSessionId: "s1" });
    const s2 = createGitFile({ path: "s2.ts", sourceSessionId: "s2" });
    const result = deriveSourceControlMainProps(
      createInput({
        sourceControlAttributedFiles: [s1, s2],
        sourceControlFilterMode: "uncommitted",
        sourceControlSessionFilter: "s2",
      })
    );
    expect(result.allFiles).toEqual([s2]);
  });

  it("resolves the focus git file for the focus path", () => {
    const file = createGitFile({ path: "src/a.ts" });
    const result = deriveSourceControlMainProps(
      createInput({
        tabData: { focusPath: "/repo/src/a.ts" },
        gitFilesByPath: new Map([["src/a.ts", file]]),
      })
    );
    expect(result.hasFocus).toBe(true);
    expect(result.focusGitFile).toBe(file);
  });
});
