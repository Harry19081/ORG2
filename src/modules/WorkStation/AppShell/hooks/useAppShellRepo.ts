import { exists } from "@tauri-apps/plugin-fs";
import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";

import { useRouteAppMode } from "@src/config/routeViewModeConfig";
import { activeWorkspaceRootAtom } from "@src/store/workspace";

const getFolderName = (path: string): string => {
  if (!path) return "";
  const cleanPath = path.replace(/\/+$/, "");
  const segments = cleanPath.split("/").filter(Boolean);
  return segments[segments.length - 1] || "";
};

const normalizePath = (path: string): string => {
  if (!path) return "";
  return path.startsWith("file://") ? path.replace("file://", "") : path;
};

export interface AppShellRepoState {
  repoPath: string;
  repoName: string;
  /** null = not yet checked / not in code mode; false = path missing; true = path ok */
  pathExists: boolean | null;
  lastSeenPath: string;
}

export function useAppShellRepo(): AppShellRepoState {
  const activeWorkspaceRoot = useAtomValue(activeWorkspaceRootAtom);
  const repoPath = activeWorkspaceRoot?.path ?? "";
  const repoName = activeWorkspaceRoot?.name ?? getFolderName(repoPath);

  const appMode = useRouteAppMode();

  const [pathExists, setPathExists] = useState<boolean | null>(null);
  const [lastSeenPath, setLastSeenPath] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    const checkPathExists = async () => {
      if (appMode !== "code") {
        setPathExists(null);
        return;
      }

      if (!repoPath) {
        setPathExists(null);
        return;
      }

      const normalizedPath = normalizePath(repoPath);
      if (!normalizedPath) {
        setPathExists(null);
        return;
      }

      try {
        const pathExistsResult = await exists(normalizedPath);
        if (cancelled) return;
        setPathExists(pathExistsResult);
        if (pathExistsResult) {
          setLastSeenPath("");
        } else {
          setLastSeenPath(normalizedPath);
        }
      } catch (_pathCheckError) {
        if (cancelled) return;
        setPathExists(false);
        setLastSeenPath(normalizedPath);
      }
    };

    checkPathExists();
    return () => {
      cancelled = true;
    };
  }, [repoPath, appMode]);

  return { repoPath, repoName, pathExists, lastSeenPath };
}
