import { createStore } from "jotai";
import { describe, expect, it } from "vitest";

import { resolveChatPanelContentState } from "@src/engines/ChatPanel/hooks/chatPanelContentState";
import { CHAT_PANEL_SURFACE_KIND as KIND } from "@src/types/ui/chatPanel";

import {
  CHAT_PANEL_CONTENT_MODE,
  CHAT_PANEL_CREATE_TARGET,
  type ChatPanelSelectedProject,
  type ChatPanelSelectedWorkItem,
  chatPanelContentModeAtom,
  chatPanelCreateProjectContextAtom,
  chatPanelCreateTargetAtom,
  chatPanelSelectedCloudOrgAtom,
  chatPanelSelectedProjectAtom,
  chatPanelSelectedProjectOrgAtom,
  chatPanelSelectedWorkItemAtom,
  chatPanelWorkspaceOverviewTabAtom,
} from "./selectionAtoms";
import {
  type ChatPanelNavigateCommand,
  activeChatPanelSurfaceAtom,
  chatPanelNavigateAtom,
} from "./surfaceAtoms";

const project = {
  project: { id: "p", name: "Project" },
  projectSlug: "project",
  orgId: "org",
} as ChatPanelSelectedProject;
const workItem = {
  workItem: { session_id: "w", name: "Work" },
  shortId: "W-1",
  projectId: "p",
  projectName: "Project",
  projectSlug: "project",
  orgId: "org",
} as ChatPanelSelectedWorkItem;

const commands: ChatPanelNavigateCommand[] = [
  { kind: KIND.SESSION },
  { kind: KIND.NEW_PROJECT, createProjectContext: { orgId: "org" } },
  { kind: KIND.NEW_WORK_ITEM },
  { kind: KIND.PROJECT, project },
  {
    kind: KIND.PROJECT_ORG,
    projectOrg: { orgId: "org", orgName: "Org", orgScope: "project_org" },
  },
  { kind: KIND.WORK_ITEM, workItem },
  { kind: KIND.WORKSPACE_EXPLORE },
  {
    kind: KIND.WORKSPACE_OVERVIEW,
    workspace: { kind: "repo", id: "repo", name: "Repo" },
  },
  { kind: KIND.CLOUD_ORG, cloudOrg: { orgId: "cloud" } },
];

describe("canonical chat-panel surface", () => {
  it.each(commands)(
    "navigates from every prior surface to $kind without stale selections",
    (destination) => {
      const store = createStore();
      for (const source of commands) {
        store.set(chatPanelNavigateAtom, source);
        store.set(chatPanelNavigateAtom, destination);
        const surface = store.get(activeChatPanelSurfaceAtom);
        expect(surface.kind).toBe(destination.kind);
        const selections = [
          store.get(chatPanelSelectedProjectAtom),
          store.get(chatPanelSelectedProjectOrgAtom),
          store.get(chatPanelSelectedWorkItemAtom),
          surface.kind === KIND.WORKSPACE_OVERVIEW ? surface.workspace : null,
          store.get(chatPanelSelectedCloudOrgAtom),
          surface.kind === KIND.WORKSPACE_EXPLORE,
        ].filter(Boolean);
        expect(selections.length).toBe(
          [KIND.SESSION, KIND.NEW_PROJECT, KIND.NEW_WORK_ITEM].some(
            (kind) => kind === destination.kind
          )
            ? 0
            : 1
        );
        const view = resolveChatPanelContentState({
          active: true,
          currentSessionId: "still-loaded-session",
          contentMode: store.get(chatPanelContentModeAtom),
          surface,
        });
        expect(view.showSessionContent).toBe(destination.kind === KIND.SESSION);
        expect(view.showPanelContent).toBe(true);
        expect(view.showHeader).toBe(true);
        // Inactive pane: only a non-session destination keeps the panel and
        // its header showing.
        const inactive = resolveChatPanelContentState({
          active: false,
          currentSessionId: "still-loaded-session",
          contentMode: store.get(chatPanelContentModeAtom),
          surface,
        });
        expect(inactive.showSessionContent).toBe(false);
        expect(inactive.showPanelContent).toBe(
          destination.kind !== KIND.SESSION
        );
        expect(inactive.showHeader).toBe(destination.kind !== KIND.SESSION);
      }
    }
  );

  it("direct selection writes replace siblings and unrelated clears do not erase the surface", () => {
    const store = createStore();
    store.set(chatPanelSelectedProjectOrgAtom, {
      orgId: "org",
      orgName: "Org",
      orgScope: "project_org",
    });
    store.set(chatPanelSelectedCloudOrgAtom, { orgId: "cloud" });
    store.set(chatPanelSelectedProjectAtom, null);
    expect(store.get(chatPanelSelectedProjectOrgAtom)).toBeNull();
    expect(store.get(activeChatPanelSurfaceAtom)).toEqual({
      kind: KIND.CLOUD_ORG,
      cloudOrg: { orgId: "cloud" },
    });
    store.set(chatPanelContentModeAtom, CHAT_PANEL_CONTENT_MODE.SESSION);
    expect(store.get(chatPanelSelectedCloudOrgAtom)).toBeNull();
    expect(store.get(activeChatPanelSurfaceAtom).kind).toBe(KIND.SESSION);
    expect(createStore().get(chatPanelContentModeAtom)).toBe(
      CHAT_PANEL_CONTENT_MODE.SESSION
    );
  });

  it("preserves workspace subnavigation and independent Launchpad creator controls", () => {
    const store = createStore();
    store.set(chatPanelWorkspaceOverviewTabAtom, "details");
    store.set(chatPanelNavigateAtom, commands[7]);
    expect(store.get(chatPanelWorkspaceOverviewTabAtom)).toBe("details");
    store.set(chatPanelNavigateAtom, {
      ...commands[7],
      kind: KIND.WORKSPACE_OVERVIEW,
      workspace: { kind: "repo", id: "r2", name: "Repo 2" },
      tab: "overview",
    });
    expect(store.get(chatPanelWorkspaceOverviewTabAtom)).toBe("overview");
    store.set(chatPanelNavigateAtom, { kind: KIND.SESSION });
    store.set(chatPanelCreateTargetAtom, CHAT_PANEL_CREATE_TARGET.PARALLEL_RUN);
    expect(store.get(activeChatPanelSurfaceAtom).kind).toBe(KIND.SESSION);
    store.set(chatPanelNavigateAtom, commands[1]);
    expect(store.get(chatPanelCreateProjectContextAtom)).toEqual({
      orgId: "org",
    });
    store.set(chatPanelNavigateAtom, commands[4]);
    expect(store.get(chatPanelCreateProjectContextAtom)).toBeNull();
  });
});
