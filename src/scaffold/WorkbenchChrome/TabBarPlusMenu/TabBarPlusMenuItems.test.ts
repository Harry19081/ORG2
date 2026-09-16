import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { FolderClosedIcon } from "@src/icons";
import {
  LAUNCHPAD_ACTION_IDS,
  type WorkStationLaunchAction,
} from "@src/modules/WorkStation/AppShell/useWorkStationLaunchActions";

import { TabBarPlusMenuItems } from "./TabBarPlusMenuItems";

const labelsById: Record<WorkStationLaunchAction["id"], string> = {
  explorer: "Files",
  sourceControl: "Review",
  terminal: "Terminal",
  newBrowserTab: "Browser",
  newPrivateBrowserTab: "Private browser",
  searchFile: "Search file",
  searchSessions: "Kanban",
  workItems: "Work items",
  projects: "Projects",
};

const secondaryActionIds = new Set<WorkStationLaunchAction["id"]>([
  "searchFile",
  "searchSessions",
  "workItems",
  "projects",
]);

function createAction(
  id: WorkStationLaunchAction["id"]
): WorkStationLaunchAction {
  return {
    id,
    sectionId: secondaryActionIds.has(id) ? "secondary" : "primary",
    icon: FolderClosedIcon,
    label: labelsById[id],
    onClick: vi.fn(),
  };
}

describe("TabBarPlusMenuItems", () => {
  it("groups the core workstation actions before the remaining launch actions", () => {
    expect(LAUNCHPAD_ACTION_IDS).toEqual([
      "explorer",
      "sourceControl",
      "terminal",
      "newBrowserTab",
      "searchFile",
      "searchSessions",
      "workItems",
      "projects",
    ]);

    const markup = renderToStaticMarkup(
      createElement(TabBarPlusMenuItems, {
        actions: LAUNCHPAD_ACTION_IDS.map(createAction),
        additions: 0,
        deletions: 0,
        onActionComplete: vi.fn(),
      })
    );
    const separatorIndex = markup.indexOf('role="separator"');

    expect(separatorIndex).toBeGreaterThan(markup.indexOf("Browser"));
    expect(separatorIndex).toBeLessThan(markup.indexOf("Search file"));
    expect(markup.match(/role="separator"/g)).toHaveLength(1);
  });

  it("does not render an edge separator when only secondary actions are visible", () => {
    const markup = renderToStaticMarkup(
      createElement(TabBarPlusMenuItems, {
        actions: [createAction("searchFile"), createAction("projects")],
        additions: 0,
        deletions: 0,
        onActionComplete: vi.fn(),
      })
    );

    expect(markup).not.toContain('role="separator"');
  });
});
