import React, { memo } from "react";

import {
  CHAT_PANEL_HEADER_DRAG_STYLE,
  ChatPanelHeaderDragSpacer,
  ChatPanelHeaderNoDragRegion,
} from "./ChatPanelHeaderPrimitives";
import type { ChatPanelHeaderSlots } from "./chatPanelHeaderSlots";

interface ChatPanelHeaderSlotsViewProps {
  slots: ChatPanelHeaderSlots | null;
}

export const ChatPanelHeaderSlotsView: React.FC<ChatPanelHeaderSlotsViewProps> =
  memo(({ slots }) => {
    return (
      <div
        className="flex min-w-0 flex-1 items-center"
        data-tauri-drag-region
        style={CHAT_PANEL_HEADER_DRAG_STYLE}
      >
        {slots?.leading && (
          <ChatPanelHeaderNoDragRegion className="flex shrink-0 items-center">
            {slots.leading}
          </ChatPanelHeaderNoDragRegion>
        )}
        <ChatPanelHeaderNoDragRegion className="flex min-w-0 shrink items-center">
          {slots?.content}
        </ChatPanelHeaderNoDragRegion>
        <ChatPanelHeaderDragSpacer />
        {slots?.trailing && (
          <ChatPanelHeaderNoDragRegion className="flex shrink-0 items-center gap-px">
            {slots.trailing}
          </ChatPanelHeaderNoDragRegion>
        )}
      </div>
    );
  });

ChatPanelHeaderSlotsView.displayName = "ChatPanelHeaderSlotsView";
