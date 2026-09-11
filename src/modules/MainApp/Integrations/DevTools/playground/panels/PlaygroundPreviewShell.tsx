import React from "react";

import "@src/engines/ChatPanel/blocks/primitives/config";
import "@src/modules/shared/layouts/blocks";

export function PlaygroundPreviewShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="tool-event-preview-shell tool-event-preview-shell--chat">
      <div className="tool-event-preview-shell__content tool-event-preview-shell__content--chat">
        {children}
      </div>
    </div>
  );
}
