/**
 * Session-layer pure logic — extended tests.
 *
 * `useSessionDispatch` as named does not exist in this codebase.
 * The closest analogue is the `computeWorkspaceSyncPlan` / `nonIdeManagedPaths`
 * helpers in `sessionWorkspaceSyncPlan.ts`. The existing test file covers the
 * core `computeWorkspaceSyncPlan` cases; this file extends coverage to:
 *
 *   • `nonIdeManagedPaths` – filtering and sorting
 *   • `trimTrailingSlashes` – edge cases
 *   • `computeWorkspaceSyncPlan` – suppressedAdds, mixed trailing slashes,
 *     multiple removes, empty IDE folder list
 */
import { describe, expect, it } from "vitest";

import { DIRECTORY_SOURCE } from "@src/api/tauri/agent/sessionWorkspace";
import type { AdditionalDirectoryView } from "@src/api/tauri/agent/sessionWorkspace";

import {
  computeWorkspaceSyncPlan,
  nonIdeManagedPaths,
  trimTrailingSlashes,
} from "../sessionWorkspaceSyncPlan";

const ROOT = "/repos/main";

function dir(
  path: string,
  source: string = DIRECTORY_SOURCE.IDE_WORKSPACE
): AdditionalDirectoryView {
  return { path, source } as AdditionalDirectoryView;
}

describe("trimTrailingSlashes", () => {
  it("removes multiple trailing slashes", () => {
    expect(trimTrailingSlashes("/a/b///")).toBe("/a/b");
  });

  it("leaves paths without trailing slash unchanged", () => {
    expect(trimTrailingSlashes("/a/b")).toBe("/a/b");
  });

  it("handles root slash only", () => {
    expect(trimTrailingSlashes("/")).toBe("");
  });

  it("handles empty string", () => {
    expect(trimTrailingSlashes("")).toBe("");
  });
});

describe("nonIdeManagedPaths", () => {
  it("returns empty array when all entries are IDE-managed", () => {
    const dirs = [
      dir("/a", DIRECTORY_SOURCE.IDE_WORKSPACE),
      dir("/b", DIRECTORY_SOURCE.IDE_WORKSPACE),
    ];
    expect(nonIdeManagedPaths(dirs)).toEqual([]);
  });

  it("returns agent-granted paths with source prefix, sorted", () => {
    const dirs = [
      dir("/c", "session"),
      dir("/a", "session"),
      dir("/b", DIRECTORY_SOURCE.IDE_WORKSPACE),
    ];
    const result = nonIdeManagedPaths(dirs);
    expect(result).toEqual(["session:/a", "session:/c"]);
  });

  it("handles empty input", () => {
    expect(nonIdeManagedPaths([])).toEqual([]);
  });
});

describe("computeWorkspaceSyncPlan — extended cases", () => {
  it("marks detached when IDE folder list is empty", () => {
    const plan = computeWorkspaceSyncPlan({
      workspaceRoot: ROOT,
      additionalDirectories: [],
      ideFolderPaths: [],
    });
    expect(plan.detached).toBe(true);
  });

  it("handles trailing slashes on IDE folder paths gracefully", () => {
    const plan = computeWorkspaceSyncPlan({
      workspaceRoot: ROOT,
      additionalDirectories: [],
      ideFolderPaths: [`${ROOT}/`, "/sub-dir/"],
    });
    expect(plan.detached).toBe(false);
    expect(plan.toAdd).toContain("/sub-dir");
  });

  it("skips paths listed in suppressedAdds", () => {
    const plan = computeWorkspaceSyncPlan({
      workspaceRoot: ROOT,
      additionalDirectories: [],
      ideFolderPaths: [ROOT, "/suppressed", "/allowed"],
      suppressedAdds: new Set(["/suppressed"]),
    });
    expect(plan.toAdd).not.toContain("/suppressed");
    expect(plan.toAdd).toContain("/allowed");
  });

  it("does not remove agent-granted directories even when they are not in IDE folders", () => {
    const plan = computeWorkspaceSyncPlan({
      workspaceRoot: ROOT,
      additionalDirectories: [dir("/agent-dir", "session")],
      ideFolderPaths: [ROOT],
    });
    expect(plan.toRemove).not.toContain("/agent-dir");
  });

  it("removes IDE-managed directories no longer in the IDE folder list", () => {
    const plan = computeWorkspaceSyncPlan({
      workspaceRoot: ROOT,
      additionalDirectories: [dir("/old-dir", DIRECTORY_SOURCE.IDE_WORKSPACE)],
      ideFolderPaths: [ROOT],
    });
    expect(plan.toRemove).toContain("/old-dir");
  });

  it("does not add the workspace root itself", () => {
    const plan = computeWorkspaceSyncPlan({
      workspaceRoot: ROOT,
      additionalDirectories: [],
      ideFolderPaths: [ROOT, "/sub-dir"],
    });
    expect(plan.toAdd).not.toContain(ROOT);
    expect(plan.toAdd).toContain("/sub-dir");
  });

  it("does not add paths already present under a different source", () => {
    const plan = computeWorkspaceSyncPlan({
      workspaceRoot: ROOT,
      additionalDirectories: [dir("/sub-dir", "session")],
      ideFolderPaths: [ROOT, "/sub-dir"],
    });
    expect(plan.toAdd).not.toContain("/sub-dir");
  });
});
