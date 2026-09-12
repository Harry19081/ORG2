import {
  CHAT_PANEL_CONTENT_MODE,
  type ChatPanelContentMode,
} from "@src/store/ui/chatPanel/selectionAtoms";
import type { ChatPanelSurfaceState } from "@src/store/ui/chatPanel/surfaceAtoms";
import { CHAT_PANEL_SURFACE_KIND } from "@src/types/ui/chatPanel";

interface ChatPanelContentStateOptions {
  active: boolean;
  contentMode: ChatPanelContentMode;
  currentSessionId: string | null;
  surface: ChatPanelSurfaceState;
}

export interface ChatPanelContentState {
  showHeader: boolean;
  showPanelContent: boolean;
  showSessionContent: boolean;
}

export function resolveChatPanelContentState({
  active,
  contentMode,
  currentSessionId,
  surface,
}: ChatPanelContentStateOptions): ChatPanelContentState {
  const sessionSurface = surface.kind === CHAT_PANEL_SURFACE_KIND.SESSION;
  const showSessionContent =
    active &&
    sessionSurface &&
    contentMode === CHAT_PANEL_CONTENT_MODE.SESSION &&
    Boolean(currentSessionId);
  // A non-session surface, or an explicit non-session content mode, keeps the
  // panel and its header visible even while the pane is otherwise inactive.
  const showNonSessionContent =
    !sessionSurface || contentMode === CHAT_PANEL_CONTENT_MODE.NON_SESSION;
  const showPanelContent = active || showNonSessionContent;

  return {
    showHeader: showPanelContent,
    showPanelContent,
    showSessionContent,
  };
}
