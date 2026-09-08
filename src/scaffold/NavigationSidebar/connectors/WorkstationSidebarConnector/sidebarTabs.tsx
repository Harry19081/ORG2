import React from "react";

import { KeyboardShortcutTooltipContent } from "@src/components/KeyboardShortcut";

export function SidebarSearchShortcutTooltip({
  searchLabel,
}: {
  searchLabel: string;
}): React.ReactElement {
  return (
    <KeyboardShortcutTooltipContent
      rows={[
        { label: "Spotlight", shortcutId: "spotlight_open" },
        {
          label: `${searchLabel} session`,
          shortcutId: "agent_session_search",
        },
      ]}
    />
  );
}
