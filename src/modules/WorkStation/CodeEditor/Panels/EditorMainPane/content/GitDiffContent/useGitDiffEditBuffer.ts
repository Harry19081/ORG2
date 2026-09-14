/**
 * Local edit buffer of `GitDiffContent`: the edited working-tree content,
 * its unsaved flag, the per-path draft mirror that survives tab switches,
 * and the save / discard / conflict handlers that act on it.
 */
import { writeTextFile } from "@tauri-apps/plugin-fs";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { matchesShortcut } from "@src/config/keyboard/shortcutBindings";
import { useGitStatus } from "@src/contexts/git/GitStatusContext/useGitStatus";
import type { ConflictResolutionChoice } from "@src/features/CodeMirror";
import { createLogger } from "@src/hooks/logger";
import {
  deleteGitDiffEditDraft,
  restoreGitDiffEditDraft,
  setGitDiffEditDraft,
} from "@src/store/workstation/codeEditor/gitDiffEditDrafts";
import type { GitFile } from "@src/types/git/types";

import type { CallbackRefs, GitDiffContentProps } from "./types";

const log = createLogger("GitDiffContent");

export function useGitDiffEditBuffer({
  callbackRefs,
  effectiveGitFile,
  gitFile,
  onUnsavedChange,
}: {
  callbackRefs: React.RefObject<CallbackRefs>;
  effectiveGitFile: GitFile | null;
  gitFile: GitFile | null;
  onUnsavedChange: GitDiffContentProps["onUnsavedChange"];
}) {
  // Local state for edited content. The buffer is mirrored into
  // `gitDiffEditDrafts` (keyed by file path) because this component is
  // unmounted on every tab switch; the draft is restored below once the
  // working-tree content it was written against is known again.
  const [editedContent, setEditedContent] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset edited content when the git file changes (not on mount — mount
  // goes straight to the draft restore), and queue a draft restore for the
  // new path.
  const lastGitFilePathRef = useRef(gitFile?.path);
  const pendingDraftRestorePathRef = useRef<string | null>(
    gitFile?.path ?? null
  );
  useEffect(() => {
    if (lastGitFilePathRef.current === gitFile?.path) return;
    lastGitFilePathRef.current = gitFile?.path;
    pendingDraftRestorePathRef.current = gitFile?.path ?? null;
    setEditedContent(null);
    setHasUnsavedChanges(false);
  }, [gitFile?.path]);

  const onUnsavedChangeRef = useRef(onUnsavedChange);
  useEffect(() => {
    onUnsavedChangeRef.current = onUnsavedChange;
  });

  useEffect(() => {
    onUnsavedChangeRef.current?.(hasUnsavedChanges);
  }, [hasUnsavedChanges]);

  // Pick up a draft saved by a previous mount once the working-tree content
  // for the pending path is known. `restoreGitDiffEditDraft` discards a
  // draft whose base no longer matches, so newer on-disk content wins and
  // the restored (or cleared) unsaved flag is published to the tab bar by
  // the `onUnsavedChange` effect above.
  const effectiveGitFilePath = effectiveGitFile?.path;
  const effectiveNewContent = effectiveGitFile?.newContent;
  useEffect(() => {
    const pendingPath = pendingDraftRestorePathRef.current;
    if (!pendingPath) return;
    if (effectiveGitFilePath !== pendingPath) return;
    if (effectiveNewContent === undefined) return;
    pendingDraftRestorePathRef.current = null;
    const draft = restoreGitDiffEditDraft(pendingPath, effectiveNewContent);
    if (draft === null) return;
    setEditedContent(draft);
    setHasUnsavedChanges(true);
  }, [effectiveGitFilePath, effectiveNewContent]);

  // Store gitFile in ref for stable callback access
  const gitFileRef = useRef(effectiveGitFile);
  useEffect(() => {
    gitFileRef.current = effectiveGitFile;
  });

  // Handle content changes in the diff editor - uses refs
  const handleContentChange = useCallback(
    (newContent: string) => {
      const currentGitFile = gitFileRef.current;
      setEditedContent(newContent);
      setHasUnsavedChanges(newContent !== currentGitFile?.newContent);
      if (currentGitFile?.path) {
        setGitDiffEditDraft(
          currentGitFile.path,
          currentGitFile.newContent ?? "",
          newContent
        );
      }
      // Notify parent of content change (for conflict resolution)
      if (currentGitFile?.path) {
        callbackRefs.current.onContentChange?.(currentGitFile.path, newContent);
      }
    },
    [callbackRefs]
  );

  // Handle conflict resolution - uses refs
  const handleResolveConflict = useCallback(
    (conflictId: string, choice: ConflictResolutionChoice) => {
      const currentGitFile = gitFileRef.current;
      if (currentGitFile?.path) {
        callbackRefs.current.onResolveConflict?.(
          currentGitFile.path,
          conflictId,
          choice
        );
      }
    },
    [callbackRefs]
  );

  const handleDiscard = useCallback(() => {
    const currentPath = gitFileRef.current?.path;
    if (currentPath) deleteGitDiffEditDraft(currentPath);
    setEditedContent(null);
    setHasUnsavedChanges(false);
  }, []);

  // Git status context for refreshing after save
  const { forceRefresh } = useGitStatus();

  // Handle save
  const handleSave = useCallback(async () => {
    if (!gitFile || !editedContent || !hasUnsavedChanges) return;

    setSaving(true);
    try {
      // Write file using Tauri fs
      await writeTextFile(gitFile.path, editedContent);
      deleteGitDiffEditDraft(gitFile.path);
      setHasUnsavedChanges(false);
      // Refresh git status so source control panel updates immediately
      forceRefresh().catch((error: unknown) => {
        log.warn("[GitDiffContent] Refresh after save failed:", error);
      });
    } catch (error) {
      log.error("[GitDiffContent] Save error:", error);
    } finally {
      setSaving(false);
    }
  }, [gitFile, editedContent, hasUnsavedChanges, forceRefresh]);

  // Keyboard shortcut for save (Cmd/Ctrl+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (matchesShortcut(e, "save_file")) {
        e.preventDefault();
        handleSave().catch((error: unknown) => {
          log.error("[GitDiffContent] Save shortcut failed:", error);
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave]);

  return {
    editedContent,
    handleContentChange,
    handleDiscard,
    handleResolveConflict,
    handleSave,
    hasUnsavedChanges,
    saving,
  };
}
