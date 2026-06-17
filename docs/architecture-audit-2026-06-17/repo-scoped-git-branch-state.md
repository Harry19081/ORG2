# Architecture Plan: Repo-scoped git/branch state for active workspace surfaces

> Read-only plan. No code changed. Branch `ORGII-dev`.

## 0. One important correction to the brief

`activeWorkspaceRootAtom` **does not exist** in the codebase (grep returns nothing). The "scoped repo migration" was implemented by upgrading **`currentRepoAtom`** itself to be active-workspace-aware: in multi-root it follows `activeFolderAtom`, otherwise it falls back to `selectedRepoIdAtom`.

```46:98:src/store/repo/derived.ts
export const currentRepoAtom = atom<Repo | undefined>((get) => {
  const repoMap = get(repoMapAtom);
  const folders = get(workspaceFoldersAtom);
  if (folders.length > 1) {
    const active = get(activeFolderAtom);
    ...
  }
  const selectedId = get(selectedRepoIdAtom);
  ...
});
```

So the real axis of the mismatch is:

- **Active-workspace surface** = `currentRepoAtom` → `activeFolderAtom` (`src/store/workspace/derived.ts:72`).
- **Selected-repo singleton** = `selectedRepoIdAtom` (`src/store/repo/atoms.ts:75`) → drives `currentBranchAtom`, `branchesAtom`, `branchLoadingAtom`.

The mismatch is therefore **only observable in a multi-root workspace** (`folders.length > 1`) when the active folder ≠ the selected repo — plus the unconditional ADE path described in §2. Everything in this plan is written against that real shape.

---

## 1. Atom inventory (current state, with file:line)

| Atom / state                                      | Definition                          | Scope today                          | Notes                                                                                                            |
| ------------------------------------------------- | ----------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `currentBranchAtom: string`                       | `src/store/repo/atoms.ts:146`       | **selected-repo singleton**          | Live branch. Written by `useBranchLoader` (keyed off `selectedRepoIdAtom`) + git-status sync                     |
| `branchesAtom: Branch[]`                          | `src/store/repo/atoms.ts:150`       | **selected-repo singleton**          | Branch dropdown list for the selected repo                                                                       |
| `branchLoadingAtom: boolean`                      | `src/store/repo/atoms.ts:170`       | global singleton                     | Loading flag; note `useBranchLoader` actually uses local `useState`, this atom is mostly vestigial               |
| `branchCacheAtom: Map<repoId, BranchCacheEntry>`  | `src/store/repo/atoms.ts:154`       | **already repo-keyed**               | Used by Branch Palette / `useBranches` with explicit `repoId`                                                    |
| `branchLoadingRepoIdsAtom: Set<repoId>`           | `src/store/repo/atoms.ts:158`       | repo-keyed                           | Dedup set for cache fetches                                                                                      |
| `selectedRepoIdAtom: string`                      | `src/store/repo/atoms.ts:75`        | window-scoped (sessionStorage)       | The "selected repo"                                                                                              |
| `selectedBranchAtom: string`                      | `src/store/repo/atoms.ts:116`       | window-scoped (sessionStorage)       | Session-creator branch selection                                                                                 |
| `gitStatusAtom`                                   | `src/store/git/gitStatusAtom.ts:33` | global, unscoped                     | Raw last-written status                                                                                          |
| `scopedGitStatusAtom: {repoId, repoPath, status}` | `src/store/git/gitStatusAtom.ts:42` | tagged                               | Set by `GitStatusProvider`                                                                                       |
| `currentGitStatusAtom`                            | `src/store/git/gitStatusAtom.ts:45` | **selected-repo + currentRepo.path** | Returns status only if `scopedStatus.repoId === selectedRepoId` AND `scopedStatus.repoPath === currentRepo.path` |
| `currentRepoAtom`                                 | `src/store/repo/derived.ts:46`      | active-workspace-aware               | Path source for all editor surfaces                                                                              |
| `activeFolderAtom`                                | `src/store/workspace/derived.ts:72` | active-workspace                     | The folder the user is focused on                                                                                |

### Consumers — which scope they actually read

| Surface                                  | Reads                                                                                                                                                   | Via                | Scope it gets                                          | Should be                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------ | ---------------------------------------------------- |
| **ADE / IDE context collector**          | `currentBranchAtom` (`IdeContextCollector.ts:222`, `:354`), `currentGitStatusAtom` (`:233`), `currentRepoAtom` for `repoPath` (`:305`) + guard (`:152`) | direct store reads | path = active-workspace, branch/status = selected-repo | **active-workspace (or session-scoped)**             |
| **CodeEditor**                           | `repoPath` prop = `currentRepoAtom` (`useAppShellRepo.ts:31-32`); `currentBranch`,`selectedRepoId` = `useRepoSelection` (`CodeEditor/index.tsx:74`)     | mixed              | path active, branch/id selected                        | active-workspace                                     |
| **SourceControl state**                  | `useRepoSelection().currentBranch`,`selectedRepoId` (`useSourceControlState/index.ts:65`); flows into pull/merge/sync/PR                                | `useRepoSelection` | selected-repo                                          | active-workspace                                     |
| **`useSourceControlSetup`**              | `currentBranch` param from CodeEditor (`useSourceControlSetup.ts:65,96`)                                                                                | prop               | selected-repo                                          | active-workspace                                     |
| **Editor status bar / local state**      | `currentBranch` prop (`useCodeEditorLocalState.ts:57,266`)                                                                                              | prop               | selected-repo                                          | active-workspace                                     |
| **`useRepoState` (read-only consumers)** | `currentBranchAtom`,`branchesAtom`,`branchLoadingAtom` (`useRepoState.ts:101-106`)                                                                      | direct             | selected-repo                                          | depends on caller                                    |
| **Inbox git sync**                       | `currentGitStatusAtom` (`useInboxGitSync.ts:31`)                                                                                                        | direct             | selected-repo+path                                     | selected-repo (likely fine)                          |
| **ChatPanel git diff actions**           | `currentGitStatusAtom` (`useGitDiffActions.ts:63`)                                                                                                      | direct             | selected-repo+path                                     | active-workspace (chat acts on workstation) — review |
| **SessionHoverCard**                     | `currentGitStatusAtom` (`SessionHoverCardContent.tsx:101`)                                                                                              | direct             | selected-repo+path                                     | selected-repo (fine)                                 |
| **Branch Palette**                       | `branchCacheAtom` + explicit `repoId` (`useBranchFetch.ts:39`, `useBranches.ts:51`)                                                                     | repo-keyed         | per-passed-repo                                        | **stays selected-repo (intentional)**                |
| **Session Creator**                      | `selectedBranchAtom` / its own repo+branch picker (`useSessionCreator.ts`, `useSessionLaunch/types.ts`)                                                 | own flow           | selected-repo                                          | **stays selected-repo (intentional)**                |

### Writers of the live branch singleton

- `useBranchLoader.loadCurrentBranchFast` / `loadBranchesImmediate` — keyed on `selectedRepoIdAtom` (`useBranchLoader.ts:53-84`, `:90-136`).
- `useRepoSelection` repo-change effect calls `loadCurrentBranchFast()` on `selectedRepoId` change (`useRepoSelection.ts:218-222`).
- `useRepoSelection` sync-from-status effect: `setCurrentBranch(currentGitStatus.current_branch)` (`useRepoSelection.ts:226-235`).
- `useBranchCheckout` (`useBranchCheckout.ts:31`), `resetRepoStore` (`storage.ts:141-142`).

---

## 2. The mismatch — confirmed, including the ADE branch bug

**Confirmed.** The ADE collector mixes scopes:

```220:233:src/services/context/collectors/IdeContextCollector.ts
  // Git branch
  try {
    const branch = store.get(currentBranchAtom); // ← selected-repo singleton
    ...
  // Git status summary + changed file paths
  try {
    const status = store.get(currentGitStatusAtom); // ← selected-repo + currentRepo.path
```

```304:312:src/services/context/collectors/IdeContextCollector.ts
    const toolbarRepo = store.get(currentRepoAtom); // ← active-workspace path
    const repoPath = normalizeRepoPath(toolbarRepo?.path ?? toolbarRepo?.fs_uri);
    if (repoPath) { payload.repoPath = repoPath; ... }
```

The affinity guard compares the **active-workspace** repo (`currentRepoAtom`) to the session's `expectedRepoPath`:

```150:171:src/services/context/collectors/IdeContextCollector.ts
    const expected = normalizeRepoPath(options.expectedRepoPath);
    if (expected) {
      const toolbarRepo = store.get(currentRepoAtom);
      const toolbarPath = normalizeRepoPath(toolbarRepo?.path ?? toolbarRepo?.fs_uri);
      if (toolbarPath && toolbarPath !== expected) {
        ... return userScopedPayload; // bails to user-scoped only
      }
    }
```

**Two concrete bug paths:**

1. **Multi-root, guard passes but branch is wrong.** When the session repo == the _active folder_ path, the guard at `:156` passes (it checks `currentRepoAtom`, which follows `activeFolderAtom`). But `currentBranchAtom` (`:222`) is keyed to `selectedRepoIdAtom`, which in multi-root can be a _different_ folder. → `payload.repoPath` = folder A, `payload.gitBranch` = repo B's branch. **Wrong branch shipped to the agent.**

2. **`expectedRepoPath: null` callers — no guard at all.** `AgentControlPalette` (`useAgentControlPalette.ts:174`) calls `collectIdeContext({ expectedRepoPath: null })`, so the affinity check is skipped entirely and `currentBranchAtom` is read unconditionally. If the active workspace ≠ selected repo, branch and status are silently cross-repo.

**`currentGitStatusAtom` shares the disease and feeds branch.** It is validated against `selectedRepoId` AND `currentRepo.path`:

```45:60:src/store/git/gitStatusAtom.ts
export const currentGitStatusAtom = atom<GitRepositoryStatus | null>((get) => {
  const scopedStatus = get(scopedGitStatusAtom);
  const selectedRepoId = get(selectedRepoIdAtom);
  const currentRepo = get(currentRepoAtom);
  const currentRepoPath = currentRepo?.path || currentRepo?.fs_uri || null;
  if (!scopedStatus || scopedStatus.repoId !== selectedRepoId ||
      scopedStatus.repoPath !== currentRepoPath) { return null; }
  return scopedStatus.status;
});
```

…and `GitStatusProvider` fetches with `selectedRepoId` + `currentRepo.path` (a **mixed-scope** fetch: id from selected, path from active) (`GitStatusProvider.tsx:134-136, 153-172, 240, 313-344`). Worse, the branch singleton is then _overwritten from status_:

```226:235:src/hooks/git/useRepoSelection/useRepoSelection.ts
  useEffect(() => {
    if (isCheckingOut) return;
    const gitBranch = currentGitStatus?.current_branch;
    if (!gitBranch) return;
    if (gitBranch !== currentBranch) setCurrentBranch(gitBranch);
  }, [currentGitStatus?.current_branch, currentBranch, setCurrentBranch]);
```

So `currentBranchAtom` races between "selected repo's fast-loaded branch" and "whatever status the mixed-scope fetch returned." **This is why branch and status must be migrated together** — fixing branch alone leaves the status-sync writer re-poisoning it.

---

## 3. Proposed atom design

### 3.1 New repo-keyed live state

Introduce a single source of truth keyed by **repoId** (chosen as the key — see Risk R2), reconciled with the existing `branchCacheAtom`:

```ts
// src/store/repo/branchStateByRepo.ts (new)
interface RepoBranchState {
  currentBranch: string;
  branches: Branch[];
  loading: boolean;
}
export const branchStateByRepoAtom = atom<Map<string, RepoBranchState>>(
  new Map()
);
```

Prefer a plain `Map` atom over `atomFamily` (see Risk R1 — atomFamily leaks). `branchCacheAtom` stays the on-disk-ish list cache; `branchStateByRepoAtom` holds _live_ `currentBranch`/`loading`. A write helper keeps both consistent (the cache's `currentBranch` and the live `currentBranch` update in one setter).

### 3.2 Derived, use-case-split atoms

```ts
// selected-repo (Branch Palette, Session Creator, status-bar "selected" pill)
export const selectedRepoBranchAtom = atom(
  (get) =>
    get(branchStateByRepoAtom).get(get(selectedRepoIdAtom))?.currentBranch ?? ""
);

// active-workspace (CodeEditor, SourceControl, editor status, ADE)
export const activeWorkspaceRepoIdAtom = atom(
  (get) => get(currentRepoAtom)?.id ?? ""
);
export const activeWorkspaceBranchAtom = atom(
  (get) =>
    get(branchStateByRepoAtom).get(get(activeWorkspaceRepoIdAtom))
      ?.currentBranch ?? ""
);

// session-scoped (ADE when a session repo is known): resolve session.repoPath -> repoId
export const sessionBranchAtom = atomFamily((repoKey: string) =>
  atom((get) => get(branchStateByRepoAtom).get(repoKey)?.currentBranch ?? "")
); // or a param-selector
```

Mirror the same split for status:

```ts
// scopedGitStatusByRepoAtom: Map<repoId, ScopedGitStatusState> (new; GitStatusProvider writes here)
export const activeWorkspaceGitStatusAtom = atom(
  (get) =>
    get(scopedGitStatusByRepoAtom).get(get(activeWorkspaceRepoIdAtom))
      ?.status ?? null
);
export const selectedRepoGitStatusAtom = atom(
  (get) =>
    get(scopedGitStatusByRepoAtom).get(get(selectedRepoIdAtom))?.status ?? null
);
```

`currentGitStatusAtom` becomes a thin alias of `selectedRepoGitStatusAtom` during migration (back-compat), then is retired.

### 3.3 Backend fetch keying

`useBranchLoader` and `GitStatusProvider` fetch per **repoId+path** and write into the per-repo maps instead of the singletons. The branch fast-load should fetch for the _active-workspace_ repoId when an active-workspace consumer needs it, while still keeping the selected-repo entry warm (both are just map entries — no contention).

---

## 4. Consumer migration: switch vs stay

**Switch to active-workspace (`activeWorkspaceBranchAtom` / `activeWorkspaceGitStatusAtom`):**

- `IdeContextCollector` branch (`:222`,`:354`) and status (`:233`) — or session-scoped when `expectedRepoPath`/sessionRow.repoPath is known (preferred; resolve to repoId and read `sessionBranchAtom`).
- `CodeEditor/index.tsx:74` — derive branch from active workspace; pass `currentRepoAtom.id` downstream instead of `selectedRepoId` (or at least keep them consistent).
- `useSourceControlState/index.ts:65` and everything it feeds (`useSyncOperations`, `useMergeRebaseState`, PR content, `useSourceControlSetup`).
- `useCodeEditorLocalState` editor status branch.
- Review `useGitDiffActions.ts:63` (ChatPanel) — chat operates on the workstation, so likely active-workspace.

**Stay selected-repo (intentional):**

- Branch Palette (`useBranchFetch.ts`, `useBranches.ts`) — already repo-keyed via explicit `repoId`; no change.
- Session Creator repo/branch (`selectedBranchAtom`, `useSessionCreator`, `useSessionLaunch`).
- `SessionHoverCard` status, `useInboxGitSync` status — selected-repo is fine.
- `useRepoState` / `useRepoSelection` keep exposing a selected-repo `currentBranch` for legacy callers (back-compat), now sourced from `selectedRepoBranchAtom`.

**Branch sync-from-status (`useRepoSelection.ts:226-235`):** make per-repo — write the status's `current_branch` into `branchStateByRepoAtom` keyed by the status's own repoId, not into the global singleton. This removes the cross-repo race.

---

## 5. Ordered migration steps (one reviewable slice, branch + status together)

1. **Add the per-repo stores** (`branchStateByRepoAtom`, `scopedGitStatusByRepoAtom`) + write helpers that keep `branchCacheAtom` consistent. No consumer changes yet.
2. **Make providers write per-repo.** `useBranchLoader` writes branch/loading into `branchStateByRepoAtom[repoId]`; `GitStatusProvider` writes into `scopedGitStatusByRepoAtom[repoId]`. Keep writing the old singletons in parallel (dual-write) so nothing breaks mid-slice.
3. **Add derived atoms** (`selectedRepoBranchAtom`, `activeWorkspaceBranchAtom`, `activeWorkspaceGitStatusAtom`, `selectedRepoGitStatusAtom`, `sessionBranchAtom`). Re-point `currentBranchAtom`/`currentGitStatusAtom` to read from the maps (alias) so existing consumers transparently get correct selected-repo values.
4. **Migrate active-workspace consumers** (§4) to the active-workspace/session derived atoms: ADE collector first (highest-risk bug), then CodeEditor + SourceControl chain.
5. **Move branch-status sync per-repo** (`useRepoSelection.ts:226-235`).
6. **Remove dual-write + retire singletons.** Delete `currentBranchAtom`/`branchesAtom`/`branchLoadingAtom` singletons (or keep `currentBranchAtom` as a pure alias of `selectedRepoBranchAtom` for one release), drop `currentGitStatusAtom` in favor of the split atoms. Update `resetRepoStore` (`storage.ts:136-150`) to clear the maps.

Steps 1–3 are non-behavioral (safe to land alone if you want an even thinner slice); 4–6 are the behavioral switch. The whole thing is independent of the just-committed repo migration because it only adds new atoms and re-points reads — it does not touch `currentRepoAtom`/`activeFolderAtom` themselves.

---

## 6. Risks

- **R1 — atomFamily lifecycle/leaks.** `atomFamily` entries are never GC'd unless you call `.remove()`. Prefer a plain `Map` atom for the primary store; if you use `atomFamily` for `sessionBranchAtom`, prune on session/repo close.
- **R2 — repoKey choice (repoId vs path).** Use **repoId** as the canonical key (matches existing `branchCacheAtom`, `scopedGitStatusAtom.repoId`, `selectedRepoIdAtom`). But `currentRepoAtom` can synthesize a minimal repo whose `id` is a folder id/path for non-imported folders (`derived.ts:67-73`), and agent repos may not be in `repoMap` yet. Normalize: when no stable repoId, fall back to normalized path as the key (and document it). `currentGitStatusAtom` already keys on _both_ id and path — keep a path tiebreaker.
- **R3 — double fetching.** Two surfaces (selected + active) may both request the same repo. Reuse `branchLoadingRepoIdsAtom` dedup (`atoms.ts:158`) and the cache-freshness checks (`isBranchCacheFresh`) for the live path too.
- **R4 — `branchCacheAtom` consistency.** Live `currentBranch` and the cached list's `currentBranch` must not drift. Single write helper updates both; checkout (`useBranchCheckout`) must update the keyed entry, not a singleton.
- **R5 — session persistence.** Session-scoped branch should resolve from the session's persisted `repoPath` (`SessionService.ts:147`, `:305`), not the live selection, to keep replayed/resumed sessions correct.
- **R6 — GitStatusProvider mixed-scope fetch.** Today it fetches `selectedRepoId` + `currentRepo.path`. When splitting, decide explicitly whether the provider fetches for the active-workspace repo, selected repo, or both; otherwise the active surface may still get the selected repo's data.
- **R7 — single-root no-op.** In single-root, active == selected, so behavior must be byte-identical; guard against extra fetches/renders.

---

## 7. Verification strategy

**Unit (Vitest, per `.cursor/rules/ui-feature-workflow.mdc`):** extract pure resolvers and test:

- `branchStateByRepoAtom` read/write helper: set repo A & B, assert isolation; cache+live stay consistent.
- `activeWorkspaceBranchAtom` vs `selectedRepoBranchAtom` divergence when activeFolder ≠ selected.
- session repoPath→repoId resolution incl. path-fallback key (R2).
- per-repo status→branch sync writes only the matching repo's entry.

**Manual scenarios proving the fix:**

1. Multi-root workspace, folders A & B on different branches. Select repo A, focus a file in folder B. Assert: CodeEditor header, SourceControl, editor status bar all show **B's** branch and status (not A's).
2. ADE: with the above state, dispatch an agent turn whose session repo == B. Inspect the IDE-context payload (`repoPath`, `gitBranch`, `gitStatus`) → must be **B**, consistently. Repeat with `AgentControlPalette` (`expectedRepoPath: null`) and confirm no cross-repo branch.
3. Switch active folder A↔B repeatedly; assert no flicker/race in branch (R6/sync), and only one fetch per repo (R3).
4. Branch Palette + Session Creator unchanged: still operate on the **selected** repo regardless of active folder.
5. Single-root regression: behavior identical to today.

**Acceptance criteria:** active-workspace surfaces never show the selected repo's branch/status when they differ; ADE ships branch matching `payload.repoPath` in every path (incl. null-guard callers); `pnpm test` + `pnpm typecheck` clean; no new double-fetches in logs.
