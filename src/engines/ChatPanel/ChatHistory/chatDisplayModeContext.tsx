import { createContext, useContext } from "react";

import type { ChatHistoryDisplayMode } from "@src/store/ui/chatPanelAtom";

const ChatHistoryDisplayModeContext =
  createContext<ChatHistoryDisplayMode>("full");

export function useChatHistoryDisplayMode(): ChatHistoryDisplayMode {
  return useContext(ChatHistoryDisplayModeContext);
}

export const ChatHistoryDisplayModeProvider =
  ChatHistoryDisplayModeContext.Provider;
