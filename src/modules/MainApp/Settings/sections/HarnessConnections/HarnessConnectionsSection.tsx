import { useSetAtom } from "jotai";
import { useEffect, useState } from "react";

import type { ConnectionHarness } from "@src/api/tauri/rpc/schemas/agentOrgs";
import { settingsSectionTabLockAtom } from "@src/modules/MainApp/Settings/settingsSectionTabLockAtom";

import AppConnectionPage from "./AppConnectionPage";

/** Section tab segment → the harness the body configures. */
const TARGET_BY_TAB: Record<string, ConnectionHarness> = {
  "claude-code": "claude_code",
  "claude-desktop": "claude_desktop",
  codex: "codex",
};

export default function HarnessConnectionsSection({
  activeTab,
}: {
  activeTab?: string;
}) {
  const target = TARGET_BY_TAB[activeTab ?? ""] ?? "claude_code";
  const [profileDirty, setProfileDirty] = useState(false);
  // The app tabs live in the section shell, so the unsaved-changes guard has
  // to reach them from here.
  const lockTabs = useSetAtom(settingsSectionTabLockAtom);
  useEffect(() => {
    lockTabs(profileDirty);
    return () => lockTabs(false);
  }, [lockTabs, profileDirty]);
  return (
    <div
      className="flex flex-col gap-4"
      data-testid="harness-connections-settings"
    >
      {/* Every provider — the app's own setup, ORG2 Market and each saved
          connection — is one list inside the page's own card. */}
      <AppConnectionPage
        key={target}
        target={target}
        onDirtyChange={setProfileDirty}
      />
    </div>
  );
}
