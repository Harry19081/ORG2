/**
 * Docked trail terminal state for the focused-chat workstation rail: the
 * mini-terminal atoms, the host-mounted claim, and the open/hide handlers the
 * header control and the native right-click menu share.
 */
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect } from "react";

import {
  closeMiniTerminalAtom,
  miniTerminalClaimedIdsAtom,
  miniTerminalCollapsedAtom,
  miniTerminalHostMountedAtom,
  miniTerminalVisibleAtom,
  openMiniTerminalAtom,
} from "@src/store/ui/miniTerminalAtom";

import { useWorkstationTrailMenu } from "./useWorkstationTrailMenu";

export function useWorkstationRailTrailTerminal({
  collapsed,
}: {
  collapsed: boolean;
}) {
  const miniTerminalVisible = useAtomValue(miniTerminalVisibleAtom);
  const miniTerminalClaimedIds = useAtomValue(miniTerminalClaimedIdsAtom);
  const miniTerminalCollapsed = useAtomValue(miniTerminalCollapsedAtom);
  const openMiniTerminal = useSetAtom(openMiniTerminalAtom);
  const closeMiniTerminal = useSetAtom(closeMiniTerminalAtom);
  const setMiniTerminalHostMounted = useSetAtom(miniTerminalHostMountedAtom);

  // Claimed sessions are only suppressed in the Workstation pane while this
  // trail — the panel's only host — is actually mounted.
  useEffect(() => {
    setMiniTerminalHostMounted(true);
    return () => setMiniTerminalHostMounted(false);
  }, [setMiniTerminalHostMounted]);

  /**
   * Show the docked terminal. The terminal carries its own width, so the
   * trail above it keeps its fixed width — only the column
   * grows, and only when the terminal is the wider of the two.
   */
  const showMiniTerminal = useCallback(
    (sessionId: string | null) => {
      openMiniTerminal(sessionId);
    },
    [openMiniTerminal]
  );

  const toggleMiniTerminal = useCallback(() => {
    if (miniTerminalVisible) {
      closeMiniTerminal();
      return;
    }
    showMiniTerminal(null);
  }, [closeMiniTerminal, miniTerminalVisible, showMiniTerminal]);

  // The collapsed 44px track has no room for the terminal panel.
  const showTrailTerminal = miniTerminalVisible && !collapsed;

  const handleTrailContextMenu = useWorkstationTrailMenu({
    miniTerminalVisible,
    onOpenMiniTerminal: () => showMiniTerminal(null),
    onHideMiniTerminal: closeMiniTerminal,
  });

  return {
    handleTrailContextMenu,
    miniTerminalClaimedIds,
    miniTerminalCollapsed,
    miniTerminalVisible,
    showMiniTerminal,
    showTrailTerminal,
    toggleMiniTerminal,
  };
}
