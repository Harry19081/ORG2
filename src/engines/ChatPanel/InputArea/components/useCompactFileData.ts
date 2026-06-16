import { useEffect, useMemo, useState } from "react";

import { getOrgtrackSessionFinalDiffs } from "@src/api/tauri/lineage";
import { createLogger } from "@src/hooks/logger";

import type {
  FileChangeInfo,
  FileChangesResult,
} from "./compactFileChangesHelpers";
import { mapFinalDiffToFileChangeInfo } from "./compactFileChangesHelpers";

const logger = createLogger("CompactFileChanges");

export interface UseCompactFileDataOptions {
  sessionId: string | null;
  initialData?: FileChangesResult;
  /**
   * Idle-reload signal. The orgtrack final diffs are cached per session in
   * Rust, so without this the pill only refetches on session switch/remount
   * and the count goes stale as the agent edits more files across rounds.
   * Bumping this string (session changed / new round / agent idle) forces a
   * fresh read without hammering the backend on every streamed tick.
   */
  reloadKey?: string;
}

export interface UseCompactFileDataReturn {
  allFiles: FileChangeInfo[];
}

export function useCompactFileData({
  sessionId,
  initialData,
  reloadKey,
}: UseCompactFileDataOptions): UseCompactFileDataReturn {
  const [orgtrackFiles, setOrgtrackFiles] = useState<FileChangeInfo[]>([]);

  useEffect(() => {
    if (initialData || !sessionId) {
      return;
    }

    let cancelled = false;
    void getOrgtrackSessionFinalDiffs({ sessionId })
      .then((finalDiffs) => {
        if (cancelled) return;
        setOrgtrackFiles(finalDiffs.map(mapFinalDiffToFileChangeInfo));
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          logger.warn("failed to load orgtrack final diffs", {
            err,
            sessionId,
          });
        }
      });

    return () => {
      cancelled = true;
    };
    // reloadKey already encodes sessionId; listed explicitly for clarity.
  }, [initialData, sessionId, reloadKey]);

  const allFiles = useMemo(
    () => initialData?.files ?? (sessionId ? orgtrackFiles : []),
    [initialData?.files, orgtrackFiles, sessionId]
  );

  return { allFiles };
}
