/**
 * Workspace Folders Atoms
 *
 * Multi-root workspace support: manages an ordered list of workspace folder roots.
 * Syncs with selectedRepoIdAtom so that the primary folder acts as the
 * selected repo where legacy single-repo flows still need one.
 *
 * Workspaces are DB-backed presets (savedWorkspacesAtom) that can be
 * activated/deactivated. The runtime folder list (workspaceFoldersAtom)
 * is loaded from the active workspace.
 */
import { type SetStateAction, atom } from "jotai";
import { atomWithStorage, createJSONStorage } from "jotai/utils";

import type { WorkspaceRecord } from "@src/api/tauri/workspace";
import { activeDevMockScenariosAtom } from "@src/store/dev/mockScenarios";
import type { WorkspaceFolder } from "@src/types/workspace";
import { getWindowId } from "@src/util/core/state/windowId";

// ============================================
// Core Atom (window-scoped session storage)
// ============================================

function getWindowScopedKey(baseKey: string): string {
  return `${baseKey}:${getWindowId()}`;
}

const NO_WORKSPACE_FOLDERS: WorkspaceFolder[] = [];

/**
 * Ordered list of workspace folder roots.
 * Persisted in sessionStorage (window-scoped) so each window has its own workspace.
 */
const workspaceFolderStorageAtom = atomWithStorage<WorkspaceFolder[]>(
  getWindowScopedKey("workspaceFolders"),
  [],
  createJSONStorage(() => sessionStorage),
  { getOnInit: true }
);
workspaceFolderStorageAtom.debugLabel = "workspaceFolderStorageAtom";

/**
 * Read view of the folder roots.
 *
 * The `noWorkingDirectories` dev mock scenario masks this to an empty list so
 * the "no folder open" empty states can be inspected without closing the real
 * workspace. Only the read is masked: the action atoms below resolve their
 * next value from `workspaceFolderStorageAtom`, so a mocked view can never
 * truncate the real list in sessionStorage.
 * See `@src/store/dev/mockScenarios`.
 */
export const workspaceFoldersAtom = atom(
  (get): WorkspaceFolder[] =>
    get(activeDevMockScenariosAtom).noWorkingDirectories
      ? NO_WORKSPACE_FOLDERS
      : get(workspaceFolderStorageAtom),
  (get, set, update: SetStateAction<WorkspaceFolder[]>) => {
    const previous = get(workspaceFolderStorageAtom);
    set(
      workspaceFolderStorageAtom,
      typeof update === "function" ? update(previous) : update
    );
  }
);
workspaceFoldersAtom.debugLabel = "workspaceFoldersAtom";

// ============================================
// DB-backed workspace state
// ============================================

/**
 * All saved workspace presets from the DB.
 * Populated on startup by RepoLoader calling listWorkspaces().
 */
export const savedWorkspacesAtom = atom<WorkspaceRecord[]>([]);
savedWorkspacesAtom.debugLabel = "savedWorkspacesAtom";

/**
 * ID of the currently active workspace (window-scoped).
 * null = no workspace active (single-repo mode).
 */
export const activeWorkspaceIdAtom = atomWithStorage<string | null>(
  getWindowScopedKey("activeWorkspaceId"),
  null,
  createJSONStorage(() => sessionStorage),
  { getOnInit: true }
);
activeWorkspaceIdAtom.debugLabel = "activeWorkspaceIdAtom";

/**
 * Whether workspace mode is currently active (derived from activeWorkspaceIdAtom).
 */
export const workspaceActiveAtom = atom<boolean>((get) => {
  return get(activeWorkspaceIdAtom) !== null;
});
workspaceActiveAtom.debugLabel = "workspaceActiveAtom";

/**
 * Whether the workspace is multi-root AND active.
 * UI surfaces use this to decide between workspace vs single-repo rendering.
 */
export const isMultiRootWorkspaceAtom = atom<boolean>((get) => {
  return (
    get(workspaceFoldersAtom).length > 1 && get(activeWorkspaceIdAtom) !== null
  );
});
isMultiRootWorkspaceAtom.debugLabel = "isMultiRootWorkspaceAtom";

/**
 * Whether any saved workspace presets exist in the DB.
 * Used by the palette to show workspace rows even when not active.
 */
export const hasWorkspaceAtom = atom<boolean>((get) => {
  return get(savedWorkspacesAtom).length > 0;
});
hasWorkspaceAtom.debugLabel = "hasWorkspaceAtom";

/**
 * Path to the .orgii-workspace config file (null if untitled/unsaved).
 */
export const workspaceConfigPathAtom = atom<string | null>(null);
workspaceConfigPathAtom.debugLabel = "workspaceConfigPathAtom";

/**
 * The display name of the currently active DB workspace preset.
 * Set when a workspace is activated from the DB (e.g. "ORGII Repos").
 * Cleared when the workspace is closed or replaced by a .orgii-workspace file.
 */
export const activeWorkspaceNameAtom = atom<string | null>(null);
activeWorkspaceNameAtom.debugLabel = "activeWorkspaceNameAtom";

/**
 * ID of the folder the user most recently interacted with.
 * Set to null to fall back to the active editor / primary folder resolution.
 * Persisted window-scoped so manual overrides survive page refresh but not
 * window close.
 */
export const activeFolderIdAtom = atomWithStorage<string | null>(
  getWindowScopedKey("activeFolderId"),
  null,
  createJSONStorage(() => sessionStorage),
  { getOnInit: true }
);
activeFolderIdAtom.debugLabel = "activeFolderIdAtom";

/**
 * Whether the workspace has been modified since last save.
 * Set to true whenever folders change; cleared by saveWorkspaceAs / loadWorkspace.
 */
export const workspaceIsDirtyAtom = atom<boolean>(false);
workspaceIsDirtyAtom.debugLabel = "workspaceIsDirtyAtom";

// ============================================
// Derived Atoms
// ============================================

// ============================================
// Write Atoms (actions)
// ============================================

/**
 * Add a folder to the workspace. Deduplicates by path.
 * First folder added becomes primary.
 */
export const addWorkspaceFolderAtom = atom(
  null,
  (get, set, payload: { path: string; name?: string }) => {
    const folders = get(workspaceFolderStorageAtom);
    const stripped = payload.path.startsWith("file://")
      ? payload.path.replace("file://", "")
      : payload.path;
    const normalizedPath = stripped.replace(/\/+$/, "");

    const alreadyExists = folders.some(
      (folder) => folder.path.replace(/\/+$/, "") === normalizedPath
    );
    if (alreadyExists) return;

    const folderName =
      payload.name ?? normalizedPath.split("/").pop() ?? normalizedPath;

    const newFolder: WorkspaceFolder = {
      id: crypto.randomUUID(),
      name: folderName,
      path: normalizedPath,
      uri: `file://${normalizedPath}`,
      isPrimary: folders.length === 0,
    };

    const updated = [...folders, newFolder];
    set(workspaceFolderStorageAtom, updated);
  }
);
addWorkspaceFolderAtom.debugLabel = "addWorkspaceFolderAtom";

/**
 * Remove a folder from the workspace by id.
 * If the primary folder is removed, the next folder becomes primary.
 */
export const removeWorkspaceFolderAtom = atom(
  null,
  (get, set, folderId: string) => {
    const folders = get(workspaceFolderStorageAtom);
    const removedFolder = folders.find((folder) => folder.id === folderId);
    if (!removedFolder) return;

    let remaining = folders.filter((folder) => folder.id !== folderId);

    if (removedFolder.isPrimary && remaining.length > 0) {
      remaining = remaining.map((folder, index) =>
        index === 0 ? { ...folder, isPrimary: true } : folder
      );
    }

    set(workspaceFolderStorageAtom, remaining);
  }
);
removeWorkspaceFolderAtom.debugLabel = "removeWorkspaceFolderAtom";

/**
 * Replace all workspace folders and optionally set the active workspace ID.
 * Used when activating a workspace from DB or resetting to single-root.
 */
export const setWorkspaceFoldersAtom = atom(
  null,
  (_get, set, folders: WorkspaceFolder[], workspaceId?: string | null) => {
    set(workspaceFolderStorageAtom, folders);
    if (workspaceId !== undefined) {
      set(activeWorkspaceIdAtom, workspaceId);
    }
  }
);
setWorkspaceFoldersAtom.debugLabel = "setWorkspaceFoldersAtom";

/**
 * Mark a folder as primary (used as default workspace_path for agents/LSP/search).
 * The previous primary loses its flag. Order is not changed — use
 * reorderFoldersAtom to move the primary to the top.
 */
export const setPrimaryFolderAtom = atom(null, (get, set, folderId: string) => {
  const folders = get(workspaceFolderStorageAtom);
  if (!folders.some((folder) => folder.id === folderId)) return;
  const updated = folders.map((folder) => ({
    ...folder,
    isPrimary: folder.id === folderId,
  }));
  set(workspaceFolderStorageAtom, updated);
  set(workspaceIsDirtyAtom, true);
});
setPrimaryFolderAtom.debugLabel = "setPrimaryFolderAtom";

/**
 * Reorder workspace folders. Accepts the new ordered array of folder IDs.
 * Missing IDs are appended in their original order; unknown IDs are ignored.
 */
export const reorderFoldersAtom = atom(
  null,
  (get, set, orderedIds: string[]) => {
    const folders = get(workspaceFolderStorageAtom);
    const byId = new Map(folders.map((folder) => [folder.id, folder]));
    const reordered: WorkspaceFolder[] = [];
    for (const id of orderedIds) {
      const folder = byId.get(id);
      if (folder) {
        reordered.push(folder);
        byId.delete(id);
      }
    }
    for (const folder of byId.values()) {
      reordered.push(folder);
    }
    set(workspaceFolderStorageAtom, reordered);
    set(workspaceIsDirtyAtom, true);
  }
);
reorderFoldersAtom.debugLabel = "reorderFoldersAtom";

/**
 * Rename a workspace folder (display name only — path is unchanged).
 */
export const renameFolderAtom = atom(
  null,
  (get, set, payload: { folderId: string; name: string }) => {
    const folders = get(workspaceFolderStorageAtom);
    if (!folders.some((folder) => folder.id === payload.folderId)) return;
    const updated = folders.map((folder) =>
      folder.id === payload.folderId
        ? { ...folder, name: payload.name }
        : folder
    );
    set(workspaceFolderStorageAtom, updated);
    set(workspaceIsDirtyAtom, true);
  }
);
renameFolderAtom.debugLabel = "renameFolderAtom";
