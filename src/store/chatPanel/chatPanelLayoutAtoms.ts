import { atom } from "jotai";

import { chatPanelMaximizedAtom } from "@src/store/ui/chatPanel/surfaceAtoms";

/** Pane layout follows the saved preference, independently of the active tab. */
export const effectiveChatPanelMaximizedAtom = atom((get) =>
  get(chatPanelMaximizedAtom)
);
effectiveChatPanelMaximizedAtom.debugLabel = "effectiveChatPanelMaximized";
