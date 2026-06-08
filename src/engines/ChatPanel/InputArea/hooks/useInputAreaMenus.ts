import { useCallback, useState } from "react";

const TERMINAL_SNAPSHOT_REQUEST_EVENT = "terminal-snapshot-request";

interface UseInputAreaMenusOptions {
  prefetchSlashItems: (query: string) => void;
  setShowContextMenu: (show: boolean) => void;
  setAtSearchQuery: (query: string) => void;
  handleAtMention: (query: string, position: { x: number; y: number }) => void;
}

export function useInputAreaMenus({
  prefetchSlashItems,
  setShowContextMenu,
  setAtSearchQuery,
  handleAtMention,
}: UseInputAreaMenusOptions) {
  const [showPlusSlashMenu, setShowPlusSlashMenu] = useState(false);
  const [plusSlashQuery, setPlusSlashQuery] = useState("");
  const [contextMenuKeyboardOpened, setContextMenuKeyboardOpened] =
    useState(false);

  const handleOpenSkillsTools = useCallback(() => {
    setPlusSlashQuery("");
    setShowPlusSlashMenu(true);
    prefetchSlashItems("");
  }, [prefetchSlashItems]);

  const handleOpenContextMenu = useCallback(() => {
    window.dispatchEvent(new Event(TERMINAL_SNAPSHOT_REQUEST_EVENT));
    setContextMenuKeyboardOpened(false);
    setShowContextMenu(true);
  }, [setShowContextMenu]);

  const handlePlusSlashClose = useCallback(() => {
    setShowPlusSlashMenu(false);
    setPlusSlashQuery("");
  }, []);

  const handlePlusSlashQueryChange = useCallback(
    (query: string) => {
      setPlusSlashQuery(query);
      prefetchSlashItems(query);
    },
    [prefetchSlashItems]
  );

  const handleContextMenuClose = useCallback(() => {
    setContextMenuKeyboardOpened(false);
    setShowContextMenu(false);
    setAtSearchQuery("");
  }, [setShowContextMenu, setAtSearchQuery]);

  const handleKeyboardAtMention = useCallback(
    (query: string, position: { x: number; y: number }) => {
      window.dispatchEvent(new Event(TERMINAL_SNAPSHOT_REQUEST_EVENT));
      setContextMenuKeyboardOpened(true);
      handleAtMention(query, position);
    },
    [handleAtMention]
  );

  return {
    showPlusSlashMenu,
    plusSlashQuery,
    contextMenuKeyboardOpened,
    handleOpenSkillsTools,
    handleOpenContextMenu,
    handlePlusSlashClose,
    handlePlusSlashQueryChange,
    handleContextMenuClose,
    handleKeyboardAtMention,
  };
}
