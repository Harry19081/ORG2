import type { ChatPanelSurfaceState } from "@src/store/ui/chatPanel/surfaceAtoms";
import { CHAT_PANEL_SURFACE_KIND } from "@src/types/ui/chatPanel";

interface ChatPanelContentStateOptions {
  active: boolean;
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
  currentSessionId,
  surface,
}: ChatPanelContentStateOptions): ChatPanelContentState {
  const sessionSurface = surface.kind === CHAT_PANEL_SURFACE_KIND.SESSION;
  const showSessionContent =
    active && sessionSurface && Boolean(currentSessionId);
  // A non-session surface keeps the panel and its header visible even while
  // the pane is otherwise inactive.
  const showPanelContent = active || !sessionSurface;

  return {
    showHeader: showPanelContent,
    showPanelContent,
    showSessionContent,
  };
}
