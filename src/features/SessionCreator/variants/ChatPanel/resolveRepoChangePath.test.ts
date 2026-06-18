import { describe, expect, it } from "vitest";

import { resolveRepoChangePath } from "./resolveRepoChangePath";

describe("resolveRepoChangePath", () => {
  it("uses the matched repo's path when available", () => {
    expect(
      resolveRepoChangePath({
        repoId: "/Users/me/Projects/app",
        matchedRepo: { path: "/Users/me/Projects/app" },
      })
    ).toBe("/Users/me/Projects/app");
  });

  it("falls back to fs_uri when path is absent", () => {
    expect(
      resolveRepoChangePath({
        repoId: "/Users/me/Projects/app",
        matchedRepo: { fs_uri: "/Users/me/Projects/app" },
      })
    ).toBe("/Users/me/Projects/app");
  });

  it("never returns empty when reposList lags (Open Folder race) — falls back to repoId path", () => {
    // The bug: just after Open Folder, the imported repo is not yet in
    // reposList, so matchedRepo is undefined. The old code wrote
    // `repo?.path || repo?.fs_uri` = undefined, clobbering the valid path and
    // stranding the creator on "Workspace is still loading".
    expect(
      resolveRepoChangePath({
        repoId: "/Users/me/Projects/freshly-opened",
        matchedRepo: undefined,
      })
    ).toBe("/Users/me/Projects/freshly-opened");
  });

  it("uses the already-resolved source path when it belongs to this repo and no repo matched", () => {
    expect(
      resolveRepoChangePath({
        repoId: "/Users/me/Projects/app",
        matchedRepo: undefined,
        currentSourceRepoId: "/Users/me/Projects/app",
        currentSourceRepoPath: "/Users/me/Projects/app",
      })
    ).toBe("/Users/me/Projects/app");
  });

  it("ignores a stale source path that belongs to a different repo", () => {
    // currentSource points at a different repo, so it must not leak through;
    // resolution falls through to the repoId (the real path) instead.
    expect(
      resolveRepoChangePath({
        repoId: "/Users/me/Projects/target",
        matchedRepo: undefined,
        currentSourceRepoId: "/Users/me/Projects/other",
        currentSourceRepoPath: "/Users/me/Projects/other",
      })
    ).toBe("/Users/me/Projects/target");
  });

  it("prefers the matched repo path over the repoId fallback", () => {
    expect(
      resolveRepoChangePath({
        repoId: "some-non-path-id",
        matchedRepo: { path: "/Users/me/Projects/app" },
        currentSourceRepoId: "some-non-path-id",
        currentSourceRepoPath: "/Users/me/Projects/stale",
      })
    ).toBe("/Users/me/Projects/app");
  });
});
