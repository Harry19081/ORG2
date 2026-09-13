import { describe, expect, it } from "vitest";

import {
  type ChatPanelTabType,
  isChatPanelTabStationAvailable,
  isStandaloneChatPanelToolTab,
  resolveChatPanelMaximizedForLayout,
} from "@src/store/chatPanel/chatPanelTabsModel";

describe("Chat Panel tab Station access", () => {
  it.each<ChatPanelTabType>([
    "session",
    "terminal",
    "start-page",
    "channel",
    "run-group",
  ])("keeps Station access available for %s tabs", (type) => {
    expect(isChatPanelTabStationAvailable(type)).toBe(true);
  });

  it.each<ChatPanelTabType>([
    "runtime",
    "work-management",
    "workspace",
    "organization",
    "work-item",
    "github-issue",
    "github-pr",
    "project",
    "explore",
  ])("never allows Station access for %s tabs", (type) => {
    expect(isChatPanelTabStationAvailable(type)).toBe(false);
  });

  it.each<ChatPanelTabType>(["work-management", "runtime"])(
    "treats %s as a standalone tool surface",
    (type) => {
      expect(isStandaloneChatPanelToolTab(type)).toBe(true);
    }
  );

  it.each<ChatPanelTabType>(["session", "start-page", "terminal", "work-item"])(
    "does not treat %s as a standalone tool surface",
    (type) => {
      expect(isStandaloneChatPanelToolTab(type)).toBe(false);
    }
  );

  it("forces the effective layout full-screen without changing the saved preference", () => {
    expect(resolveChatPanelMaximizedForLayout(false, "work-item")).toBe(true);
    expect(resolveChatPanelMaximizedForLayout(true, "work-item")).toBe(true);
    expect(resolveChatPanelMaximizedForLayout(false, "session")).toBe(false);
  });
});
