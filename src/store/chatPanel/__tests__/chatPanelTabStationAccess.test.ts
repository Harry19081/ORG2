import { createStore } from "jotai";
import { describe, expect, it } from "vitest";

import {
  chatPanelMaximizedAtom,
  toggleChatPanelMaximizedAtom,
} from "@src/store/ui/chatPanel/surfaceAtoms";

import { effectiveChatPanelMaximizedAtom } from "../chatPanelLayoutAtoms";
import {
  CHAT_PANEL_TAB_TYPE_POLICY,
  type ChatPanelTabType,
  isStandaloneChatPanelToolTab,
} from "../chatPanelTabsModel";
import { chatPanelTabsAtom } from "../chatPanelTabsState";

const types = Object.keys(CHAT_PANEL_TAB_TYPE_POLICY) as ChatPanelTabType[];
describe("pane-level Station access", () => {
  it.each(types)(
    "keeps pane controls and saved layout independent of %s",
    (type) => {
      const store = createStore();
      for (const maximized of [false, true]) {
        store.set(chatPanelMaximizedAtom, maximized);
        store.set(chatPanelTabsAtom, {
          activeTabId: "selected",
          tabs: [{ id: "selected", type, title: "Selected tab" }],
        });
        expect(store.get(effectiveChatPanelMaximizedAtom)).toBe(maximized);
        store.set(toggleChatPanelMaximizedAtom);
        expect(store.get(effectiveChatPanelMaximizedAtom)).toBe(!maximized);
      }
    }
  );
  it.each<ChatPanelTabType>(["work-management", "runtime"])(
    "retains %s content's standalone-tool presentation",
    (type) => {
      expect(isStandaloneChatPanelToolTab(type)).toBe(true);
    }
  );
  it.each<ChatPanelTabType>(["session", "start-page", "terminal", "work-item"])(
    "does not treat %s as a standalone tool",
    (type) => {
      expect(isStandaloneChatPanelToolTab(type)).toBe(false);
    }
  );
});
