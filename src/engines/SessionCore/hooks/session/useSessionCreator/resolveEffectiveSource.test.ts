import { describe, expect, it } from "vitest";

import type { Repo } from "@src/store/repo/types";
import type { WorkspaceFolder } from "@src/types/workspace";

import { resolveEffectiveSource } from "./resolveEffectiveSource";

function makeFolder(overrides: Partial<WorkspaceFolder> = {}): WorkspaceFolder {
  return {
    id: "folder-id",
    name: "codex-proxy",
    path: "/Users/me/Projects/codex-proxy",
    uri: "file:///Users/me/Projects/codex-proxy",
    isPrimary: true,
    kind: "git",
    ...overrides,
  };
}

function makeRepo(overrides: Partial<Repo> = {}): Repo {
  return {
    id: "/Users/me/Projects/other",
    name: "other",
    path: "/Users/me/Projects/other",
    fs_uri: "/Users/me/Projects/other",
    kind: "git",
    ...overrides,
  } as Repo;
}

describe("resolveEffectiveSource", () => {
  it("resolves the workspace root from the primary folder even when the global selection is stale (Add Folder bug)", () => {
    // The exact "Add Folder to Workspace (single folder)" state: one workspace
    // folder present, but selectedRepoIdAtom still points at a different repo.
    const result = resolveEffectiveSource({
      primaryFolder: makeFolder(),
      globalRepoId: "/Users/me/Projects/other",
      globalBranch: "",
      repos: [makeRepo()],
    });

    expect(result).toEqual({
      type: "local",
      repoId: "folder-id",
      repoName: "codex-proxy",
      repoPath: "/Users/me/Projects/codex-proxy",
      branch: undefined,
    });
  });

  it("resolves the primary folder when the global selection is empty (no stale pointer)", () => {
    const result = resolveEffectiveSource({
      primaryFolder: makeFolder(),
      globalRepoId: "",
      globalBranch: "",
      repos: [],
    });

    expect(result?.repoPath).toBe("/Users/me/Projects/codex-proxy");
  });

  it("prefers the folder's repoId back-reference when present", () => {
    const result = resolveEffectiveSource({
      primaryFolder: makeFolder({ repoId: "linked-repo-id" }),
      globalRepoId: "",
      globalBranch: "main",
      repos: [],
    });

    expect(result?.repoId).toBe("linked-repo-id");
    expect(result?.branch).toBe("main");
  });

  it("falls back to the global repo selection when there is no workspace folder (legacy single-repo path)", () => {
    const repo = makeRepo({
      id: "/Users/me/Projects/single",
      name: "single",
      path: "/Users/me/Projects/single",
      fs_uri: "/Users/me/Projects/single",
    });
    const result = resolveEffectiveSource({
      primaryFolder: null,
      globalRepoId: "/Users/me/Projects/single",
      globalBranch: "",
      repos: [repo],
    });

    expect(result).toEqual({
      type: "local",
      repoId: "/Users/me/Projects/single",
      repoName: "single",
      repoPath: "/Users/me/Projects/single",
      branch: undefined,
    });
  });

  it("uses fs_uri when the global repo has no path", () => {
    const repo = makeRepo({
      id: "repo-x",
      name: "x",
      path: undefined,
      fs_uri: "/Users/me/Projects/x",
    });
    const result = resolveEffectiveSource({
      primaryFolder: null,
      globalRepoId: "repo-x",
      globalBranch: "",
      repos: [repo],
    });

    expect(result?.repoPath).toBe("/Users/me/Projects/x");
  });

  it("returns null when there is neither a folder nor a resolvable global repo", () => {
    expect(
      resolveEffectiveSource({
        primaryFolder: null,
        globalRepoId: "",
        globalBranch: "",
        repos: [],
      })
    ).toBeNull();

    expect(
      resolveEffectiveSource({
        primaryFolder: null,
        globalRepoId: "missing-repo",
        globalBranch: "",
        repos: [makeRepo()],
      })
    ).toBeNull();
  });
});
