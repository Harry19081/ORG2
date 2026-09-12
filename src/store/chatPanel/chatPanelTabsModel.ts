import type { CloudChannelVisibility } from "@src/features/Org2Cloud/channels/types";
import type {
  ChatPanelSelectedOrganization,
  ChatPanelSelectedProject,
  ChatPanelSelectedWorkItem,
  ChatPanelSelectedWorkspace,
} from "@src/store/ui/chatPanel/selectionTypes";
import {
  WORK_MANAGEMENT_SECTION,
  type WorkManagementSection,
} from "@src/store/workstation/workstationTabBarAtoms";
import type {
  GitHubIssueDetailTabData,
  GitHubPrDetailTabData,
} from "@src/types/githubDetail";

export type ChatPanelTabType =
  | "session"
  | "terminal"
  | "start-page"
  | "runtime"
  | "work-management"
  | "workspace"
  | "organization"
  | "work-item"
  | "github-issue"
  | "github-pr"
  | "project"
  | "explore"
  | "channel"
  | "run-group";

/**
 * Payload for a "channel" tab, discriminated by scope. Local channels live in
 * `localChannelsAtom` (this machine, single user); cloud channels are org
 * rows from the `0014_org_channels.sql` control plane. Unlike the other tab
 * payloads this type lives here rather than in `selectionTypes.ts` — a channel
 * tab has no selection projection, so it never joins the surface state.
 */
export type ChatPanelSelectedChannel =
  | { scope: "local"; channelId: string; name: string }
  | {
      scope: "cloud";
      orgId: string;
      channelId: string;
      name: string;
      visibility: CloudChannelVisibility;
    };

export interface ChatPanelTab {
  id: string;
  type: ChatPanelTabType;
  /** Display label */
  title: string;
  /** Sidebar section owned by this Work Management tab. */
  managementSection?: WorkManagementSection;
  createdAt?: string;
  updatedAt?: string;
  /**
   * For "session" tabs: the linked ORGII session ID.
   * Legacy persisted empty tabs may still hydrate with null before migration.
   */
  sessionId?: string | null;
  /**
   * For "terminal" tabs: the terminal session ID in the shared terminal
   * atom store. Always prefixed "chatpanel-<uuid>" to isolate from
   * Workstation terminals.
   */
  terminalSessionId?: string;
  /**
   * For "terminal" tabs opened via the CLI launch bar: the bare binary command
   * to write to the PTY once the shell prompt is ready (e.g. "claude\n").
   * Written once after the PTY reports initialized; cleared afterwards.
   */
  cliCommand?: string;
  /**
   * For "workspace" tabs: the workspace whose overview / detail page this pill
   * owns. The overview surface renders straight from this payload.
   */
  workspace?: ChatPanelSelectedWorkspace;
  /**
   * For "organization" tabs: the cloud or local organization restored when
   * this shared management tab is activated.
   */
  organization?: ChatPanelSelectedOrganization;
  /**
   * For "work-item" tabs: the linked work item plus its project/org context.
   * Writable in place — the work-item panel edits/refreshes this payload.
   */
  workItem?: ChatPanelSelectedWorkItem;
  /** For GitHub issue tabs opened from a chat-pane Work Management parent. */
  githubIssue?: GitHubIssueDetailTabData;
  /** For GitHub PR tabs opened from a chat-pane Work Management parent. */
  githubPr?: GitHubPrDetailTabData;
  /**
   * For "project" tabs: the linked project plus its slug/org context. The
   * panel self-fetches the project's work items from `project.projectSlug`.
   */
  project?: ChatPanelSelectedProject;
  /**
   * For "channel" tabs: the local or cloud channel whose message surface this
   * pill owns. The surface renders straight from this payload.
   */
  channel?: ChatPanelSelectedChannel;
  /**
   * For "run-group" tabs: the multi-runner fan-out this pill owns. Only the id
   * is stored — the group itself lives in `runGroupsAtom`, and each run's live
   * state is read from the session store, so the tab payload cannot go stale.
   */
  runGroupId?: string;
}

export interface ChatPanelTabsState {
  tabs: ChatPanelTab[];
  activeTabId: string;
}

/** Fixed id of the shared cloud/local organization management tab. */
export const ORGANIZATION_TAB_ID = "chat-organization-management";

type ChatPanelTabStationAccess = "always" | "never";

/**
 * When a Chat Panel tab can share the workbench with a Station surface.
 *
 * This record is intentionally exhaustive: a new tab type must make an
 * explicit layout decision instead of silently inheriting an unsafe default.
 * Conversation-oriented tabs can always remain docked beside the Station;
 * standalone management and detail surfaces always own the full workbench.
 */
const CHAT_PANEL_TAB_STATION_ACCESS: Record<
  ChatPanelTabType,
  ChatPanelTabStationAccess
> = {
  session: "always",
  terminal: "always",
  "start-page": "always",
  channel: "always",
  "run-group": "always",
  runtime: "never",
  "work-management": "never",
  workspace: "never",
  organization: "never",
  "work-item": "never",
  "github-issue": "never",
  "github-pr": "never",
  project: "never",
  explore: "never",
};

export function isChatPanelTabStationAvailable(
  tabOrType: ChatPanelTab | ChatPanelTabType | null | undefined
): boolean {
  const type =
    typeof tabOrType === "string" ? tabOrType : (tabOrType?.type ?? null);
  if (type === null) return true;
  return CHAT_PANEL_TAB_STATION_ACCESS[type] === "always";
}

/** Resolve the layout without mutating the user's persisted maximize choice. */
export function resolveChatPanelMaximizedForLayout(
  userMaximized: boolean,
  tabOrType: ChatPanelTab | ChatPanelTabType | null | undefined
): boolean {
  return userMaximized || !isChatPanelTabStationAvailable(tabOrType);
}

export function getWorkManagementFallbackTitle(
  section: WorkManagementSection
): string {
  switch (section) {
    case WORK_MANAGEMENT_SECTION.PROJECTS:
      return "Projects";
    case WORK_MANAGEMENT_SECTION.INBOX:
      return "Inbox";
    case WORK_MANAGEMENT_SECTION.GITHUB_ISSUES:
      return "GitHub Issues";
    case WORK_MANAGEMENT_SECTION.GITHUB_PRS:
      return "GitHub PRs";
    case WORK_MANAGEMENT_SECTION.RUNS:
      return "Runs";
    case WORK_MANAGEMENT_SECTION.KANBAN:
      return "Kanban";
  }
}

export function isWorkManagementListSection(
  section: WorkManagementSection
): boolean {
  return section !== WORK_MANAGEMENT_SECTION.KANBAN;
}
