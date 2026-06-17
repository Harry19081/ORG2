/**
 * Supplemental unit tests for `runGuardedCheckout` recovery fallback branches.
 *
 * The primary `guardedCheckout.test.ts` covers every outcome with explicit
 * error fields. This file targets the remaining uncovered branches in the
 * recovery helpers: the `errorType ?? "other"` / default-message fallbacks
 * (when the failed checkout omits `errorType` / `error`) and the `catch`
 * path of `forceCheckout` (when the forced checkout itself throws).
 *
 * `gitApi` is mocked so no real git/HTTP calls happen.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { runGuardedCheckout } from "../guardedCheckout";

const gitCheckout = vi.fn();
const gitStashPush = vi.fn();

vi.mock("@src/api/http/git", () => ({
  gitApi: {
    gitCheckout: (...args: unknown[]) => gitCheckout(...args),
    gitStashPush: (...args: unknown[]) => gitStashPush(...args),
  },
}));

function conflict(choice: "stash" | "force" | "cancel") {
  return vi.fn().mockResolvedValue(choice);
}

const BASE = {
  repoId: "repo-1",
  repoPath: "/tmp/repo",
  ref: "feature",
} as const;

/** First checkout always reports the dirty-tree conflict that triggers recovery. */
function mockDirtyTree() {
  gitCheckout.mockResolvedValueOnce({
    success: false,
    errorType: "uncommitted_changes",
  });
}

beforeEach(() => {
  gitCheckout.mockReset();
  gitStashPush.mockReset();
});

describe("runGuardedCheckout — stash recovery fallbacks", () => {
  it("falls back to errorType 'other' and a default message when the post-stash checkout fails bare", async () => {
    mockDirtyTree();
    gitStashPush.mockResolvedValueOnce({ success: true });
    // Post-stash checkout fails with neither errorType nor error supplied.
    gitCheckout.mockResolvedValueOnce({ success: false });

    const result = await runGuardedCheckout({
      ...BASE,
      onConflict: conflict("stash"),
    });

    expect(result).toEqual({
      success: false,
      outcome: "error",
      errorType: "other",
      message: "Failed to checkout after stash",
    });
  });
});

describe("runGuardedCheckout — force recovery fallbacks", () => {
  it("falls back to errorType 'other' and a default message when the force checkout fails bare", async () => {
    mockDirtyTree();
    // Forced checkout fails with neither errorType nor error supplied.
    gitCheckout.mockResolvedValueOnce({ success: false });

    const result = await runGuardedCheckout({
      ...BASE,
      onConflict: conflict("force"),
    });

    expect(result).toEqual({
      success: false,
      outcome: "error",
      errorType: "other",
      message: "Failed to force checkout",
    });
    expect(gitStashPush).not.toHaveBeenCalled();
  });

  it("returns a normalized error (never throws) when the force checkout itself rejects", async () => {
    mockDirtyTree();
    gitCheckout.mockRejectedValueOnce(new Error("disk exploded"));

    const result = await runGuardedCheckout({
      ...BASE,
      onConflict: conflict("force"),
    });

    expect(result).toEqual({
      success: false,
      outcome: "error",
      errorType: "other",
      message: "Failed to force checkout",
    });
  });
});
