import { beforeEach, expect, it, vi } from "vitest";

import { branchSwitchApi } from "./branchSwitch";

const fetchRustApi = vi.hoisted(() => vi.fn());
vi.mock("./client", () => ({
  fetchRustApi,
  gitRepoUrl: (repo: string) => `/repo/${encodeURIComponent(repo)}`,
}));
beforeEach(() => vi.resetAllMocks());
it("shares equivalent pending reads, evicts on completion, and isolates worktrees", async () => {
  let finish!: (v: unknown) => void;
  fetchRustApi
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    )
    .mockResolvedValue({ data: false });
  const a = branchSwitchApi.available(
    { repoId: "repo", repoPath: "/one" },
    "main"
  );
  const b = branchSwitchApi.available(
    { repoId: "repo", repoPath: "/one" },
    "main"
  );
  await branchSwitchApi.available({ repoId: "repo", repoPath: "/two" }, "main");
  expect(fetchRustApi).toHaveBeenCalledTimes(2);
  finish({ data: true });
  expect(await a).toBe(true);
  expect(await b).toBe(true);
  await branchSwitchApi.available({ repoId: "repo", repoPath: "/one" }, "main");
  expect(fetchRustApi).toHaveBeenCalledTimes(3);
});
it("evicts failed reads without retaining a rejected promise", async () => {
  fetchRustApi
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue({ data: false });
  await expect(
    branchSwitchApi.available({ repoId: "repo" }, "main")
  ).rejects.toThrow("offline");
  expect(await branchSwitchApi.available({ repoId: "repo" }, "main")).toBe(
    false
  );
});
it("serializes creation, base, fingerprint and strategy in one mutation", async () => {
  fetchRustApi.mockResolvedValue({ data: { outcome: "switched" } });
  await branchSwitchApi.execute(
    { repoId: "repo", repoPath: "/tree" },
    { branch: "feature", create: true, start_point: "main" },
    "fingerprint",
    "bring"
  );
  expect(fetchRustApi).toHaveBeenCalledWith(
    "/repo/repo/branch-switch/execute?path=%2Ftree",
    {
      method: "POST",
      body: JSON.stringify({
        target: { branch: "feature", create: true, start_point: "main" },
        fingerprint: "fingerprint",
        strategy: "bring",
      }),
    }
  );
});
