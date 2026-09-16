import { useCallback } from "react";

import type { SessionFilterButtonProps } from "./sessionFilterTypes";
import type { SessionGroupVisibleCount } from "./types";

interface UseSessionFilterActionsOptions extends Pick<
  SessionFilterButtonProps,
  | "onSelect"
  | "onSelectGroupVisibleCount"
  | "onConfigureExternalSources"
  | "onCollapseAll"
  | "onMarkAllRead"
  | "onRefreshSessions"
  | "onExportSessionJson"
  | "onImportSessionJson"
> {
  close: () => void;
  closeSubmenu: () => void;
}

/** Group-by and Show selections plus the action rows: each runs its callback, then closes the menu. */
export function useSessionFilterActions({
  onSelect,
  onSelectGroupVisibleCount,
  onConfigureExternalSources,
  onCollapseAll,
  onMarkAllRead,
  onRefreshSessions,
  onExportSessionJson,
  onImportSessionJson,
  close,
  closeSubmenu,
}: UseSessionFilterActionsOptions) {
  const handleSelect = useCallback(
    (mode: string) => {
      onSelect(mode);
      closeSubmenu();
      close();
    },
    [onSelect, closeSubmenu, close]
  );

  const handleGroupVisibleCountSelect = useCallback(
    (count: SessionGroupVisibleCount) => {
      onSelectGroupVisibleCount(count);
      closeSubmenu();
      close();
    },
    [close, closeSubmenu, onSelectGroupVisibleCount]
  );

  const handleConfigureExternalSources = useCallback(() => {
    onConfigureExternalSources?.();
    close();
  }, [onConfigureExternalSources, close]);

  const handleCollapseAll = useCallback(() => {
    onCollapseAll?.();
    close();
  }, [onCollapseAll, close]);

  const handleMarkAllRead = useCallback(() => {
    onMarkAllRead?.();
    close();
  }, [onMarkAllRead, close]);

  const handleRefreshSessions = useCallback(() => {
    onRefreshSessions?.();
    close();
  }, [onRefreshSessions, close]);

  const handleExportSessionJson = useCallback(() => {
    onExportSessionJson?.();
    close();
  }, [onExportSessionJson, close]);

  const handleImportSessionJson = useCallback(() => {
    onImportSessionJson?.();
    close();
  }, [onImportSessionJson, close]);

  return {
    handleSelect,
    handleGroupVisibleCountSelect,
    handleConfigureExternalSources,
    handleCollapseAll,
    handleMarkAllRead,
    handleRefreshSessions,
    handleExportSessionJson,
    handleImportSessionJson,
  };
}
