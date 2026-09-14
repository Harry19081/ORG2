import type { TFunction } from "i18next";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { SourceControlFilterMode } from "@src/modules/WorkStation/shared/SidebarModules";
import type {
  SourceControlHistorySelection,
  WorkStationTab,
} from "@src/store/workstation/tabs";

import { SourceControlHeaderContent } from "./SourceControlHeaderContent";

vi.mock("@src/components/Button", () => ({
  default: ({
    title,
    disabled,
    "aria-label": label,
  }: {
    title?: string;
    disabled?: boolean;
    "aria-label"?: string;
  }) =>
    createElement("button", {
      "data-title": title,
      "aria-label": label,
      disabled,
    }),
}));

vi.mock("@src/components/TabPill", () => ({
  default: ({
    activeTab,
    tabs,
  }: {
    activeTab: string;
    tabs: Array<{ key: string }>;
  }) =>
    createElement("div", {
      "data-active-tab": activeTab,
      "data-tabs": tabs.map((tab) => tab.key).join(","),
    }),
}));

const t = ((key: string) => key) as TFunction;

function sourceControlTab(mode: "focus" | "all-changes"): WorkStationTab {
  return {
    id: "source-control:changes",
    type: "source-control",
    title: "Review",
    data: {
      mode,
      staged: false,
      fileCount: 1,
      focusPath: null,
      historySelection: null,
    },
  } as WorkStationTab;
}

vi.mock("./SourceControlDiffSettingsMenu", () => ({
  SourceControlDiffSettingsMenu: () =>
    createElement("button", { "data-menu": "diff-settings" }),
}));

function renderHeader(
  mode: "focus" | "all-changes",
  focusPath: string | null = null,
  navigationTotal = focusPath ? 1 : 0,
  historySelection: SourceControlHistorySelection | null = null,
  showSourceControlModePill = true,
  sourceControlFilterMode: SourceControlFilterMode = "uncommitted"
): string {
  const tab = sourceControlTab(mode);
  tab.data.focusPath = focusPath;
  tab.data.historySelection = historySelection;
  return renderToStaticMarkup(
    createElement(SourceControlHeaderContent, {
      activeTab: tab,
      sourceControlFilterMode,
      showSourceControlModePill,
      gitReviewNavigationTotal: navigationTotal,
      selectedIssue: null,
      sourceControlRefreshSpinClass: undefined,
      diffViewMode: "split",
      t,
      onDiffViewModeChange: vi.fn(),
      onModeChange: vi.fn(),
      onReviewPrevFile: vi.fn(),
      onReviewNextFile: vi.fn(),
      onCollapseAll: vi.fn(),
      onRefresh: vi.fn(),
    })
  );
}

describe("SourceControlHeaderContent diff view controls", () => {
  it.each(["stashed", "history", "pr", "issues"] as const)(
    "keeps Split, More, and Refresh in order in %s mode before selection",
    (filter) => {
      const markup = renderHeader("focus", null, 0, null, false, filter);
      const split = markup.indexOf(
        'aria-label="workstation.switchToUnifiedDiff"'
      );
      const menu = markup.indexOf('data-menu="diff-settings"');
      const refresh = markup.indexOf('aria-label="common:actions.refresh"');
      expect(split).toBeGreaterThan(-1);
      expect(menu).toBeGreaterThan(split);
      expect(refresh).toBeGreaterThan(menu);
      expect(markup.match(/data-menu="diff-settings"/g)).toHaveLength(1);
    }
  );
  it("shows the split toggle even without mode tabs or a selection", () => {
    const markup = renderHeader("focus", null, 0, null, false);
    expect(markup).toContain('aria-label="workstation.switchToUnifiedDiff"');
    expect(markup).not.toContain('data-tabs="focus,all-changes"');
  });
  it.each(["commit", "stash"] as const)(
    "shows history diff controls for %s without file review navigation",
    (type) => {
      const selection = {
        type,
        commitSha: "abc1234",
        shortSha: "abc1234",
        commitMessage: "Saved changes",
        ...(type === "stash"
          ? {
              stashIndex: 0,
              stashRef: "stash@{0}",
              stashIdentity: "abc1234",
              stashCommitSha: "abc1234",
            }
          : {}),
      } as SourceControlHistorySelection;
      const markup = renderHeader("all-changes", null, 0, selection);
      expect(markup).toContain('aria-label="workstation.switchToUnifiedDiff"');
      expect(markup).not.toContain('data-tabs="focus,all-changes"');
      expect(markup).not.toContain("common:actions.reviewNextFile");
      expect(markup).not.toContain('data-menu="diff-settings"');
    }
  );
  it("shows the shared unified/split control in All Changes", () => {
    const markup = renderHeader("all-changes");

    expect(markup).toContain('aria-label="workstation.switchToUnifiedDiff"');
    expect(markup).not.toContain('data-tabs="unified,split"');
  });

  it("places focused diff controls after navigation and its separator", () => {
    const markup = renderHeader("focus", "src/index.ts");
    const next = markup.indexOf('aria-label="common:actions.reviewNextFile"');
    const separator = markup.indexOf('role="separator"', next);
    const split = markup.indexOf(
      'aria-label="workstation.switchToUnifiedDiff"'
    );
    expect(markup).not.toContain("disabled");
    expect(next).toBeGreaterThan(-1);
    expect(separator).toBeGreaterThan(next);
    expect(split).toBeGreaterThan(separator);
    expect(markup.slice(split)).not.toContain('role="separator"');
  });

  it("keeps aggregate split and menu adjacent after collapse controls", () => {
    const markup = renderHeader("all-changes");
    const collapse = markup.indexOf('data-title="actions.collapseAll"');
    const separator = markup.indexOf('role="separator"', collapse);
    const split = markup.indexOf(
      'aria-label="workstation.switchToUnifiedDiff"'
    );
    const menu = markup.indexOf('data-menu="diff-settings"');
    expect(separator).toBeGreaterThan(collapse);
    expect(split).toBeGreaterThan(separator);
    expect(menu).toBeGreaterThan(split);
    expect(markup.slice(split, menu)).not.toContain('role="separator"');
  });

  it.each([0, 3])(
    "keeps empty Focus arrows disabled and its menu visible with %i review files",
    (total) => {
      const markup = renderHeader("focus", null, total);
      for (const action of ["reviewPreviousFile", "reviewNextFile"]) {
        expect(markup).toContain(
          `aria-label="common:actions.${action}" disabled=""`
        );
      }
      expect(markup).toContain('data-menu="diff-settings"');
      expect(markup.indexOf('role="separator"')).toBeLessThan(
        markup.indexOf('data-menu="diff-settings"')
      );
    }
  );

  it("disables navigation when a selected file has no review sequence", () => {
    const markup = renderHeader("focus", "src/index.ts", 0);
    expect(markup).toContain(
      'aria-label="common:actions.reviewNextFile" disabled=""'
    );
    expect(markup).not.toContain('data-menu="diff-settings"');
  });

  it("keeps the full toolbar visible before a file is selected", () => {
    const markup = renderHeader("focus");

    expect(markup).toContain("workstation.switchToUnifiedDiff");
    expect(markup).toContain("common:actions.reviewPreviousFile");
    expect(markup).toContain("common:actions.reviewNextFile");
    expect(markup).toContain('data-menu="diff-settings"');
    expect(markup).toContain("common:actions.refresh");
    expect(markup).toContain('data-tabs="focus,all-changes"');
  });
});
