// @vitest-environment jsdom
import { Provider, createStore, useAtomValue } from "jotai";
import { act, createElement } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useChatCollapseState } from "@src/engines/ChatPanel/ChatCollapseScope";
import { makeSessionEvent } from "@src/engines/SessionCore/rendering/props/__tests__/fixtures";
import { sessionRuntimeStatusAtom } from "@src/store/session/cliSessionStatusAtom";

import { useTailTurnPhase } from "../hooks/useTailTurnCollapse";
import { projectChatHistory } from "../projection/core";
import { GroupHeaderRenderer } from "./GroupHeaderRenderer";

describe("GroupHeaderRenderer streaming completion", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      }
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it.each([false, true])(
    "shows and collapses a streaming turn on idle (with tools=%s)",
    (withTools) => {
      const store = createStore();
      store.set(sessionRuntimeStatusAtom, "running");
      const chatHistory = [
        makeSessionEvent({
          id: "user-turn",
          source: "user",
          actionType: "raw",
          functionName: "user_message",
          displayText: "Run a command",
          displayVariant: "message",
        }),
        ...(withTools
          ? [
              makeSessionEvent({
                id: "tool",
                source: "assistant",
                actionType: "tool_call",
                functionName: "run_shell",
                uiCanonical: "run_shell",
                displayVariant: "tool_call",
                displayText: "command activity",
                displayStatus: "completed",
                args: { command: "pwd" },
              }),
            ]
          : []),
        makeSessionEvent({
          id: "reply",
          source: "assistant",
          actionType: "assistant_message",
          functionName: "agent_message",
          uiCanonical: "agent_message",
          displayVariant: "message",
          displayText: "final reply",
          displayStatus: "completed",
        }),
      ];
      function StreamingTurn() {
        const tailTurnPhase = useTailTurnPhase({
          activeId: "sdeagent-streaming",
          chatHistory,
          disableTailCollapse: false,
          groupChat: null,
          sessionStatus: "running",
        });
        const { turnCollapseOverrideAtom } = useChatCollapseState();
        const collapseOverrides = useAtomValue(turnCollapseOverrideAtom);
        const groups = projectChatHistory(chatHistory, {
          groups: { tailTurnPhase, collapseOverrides },
        }).groups!;
        return createElement(
          "div",
          null,
          createElement(GroupHeaderRenderer, {
            groupIndex: 0,
            groupCount: 1,
            groupHeaders: groups.groupHeaders,
            groupMeta: groups.groupMeta,
            tailTurnPhase,
          }),
          createElement(
            "output",
            null,
            groups.flatItems
              .flatMap(
                (item) =>
                  item.activityStackGroup?.events.map((event) => event.id) ?? [
                    item.event?.id,
                  ]
              )
              .join(",")
          )
        );
      }
      act(() =>
        root.render(
          createElement(Provider, { store }, createElement(StreamingTurn))
        )
      );
      expect(
        container.querySelector('[data-testid="turn-collapse-toggle"]')
      ).toBeNull();
      act(() => store.set(sessionRuntimeStatusAtom, "idle"));
      const toggle = container.querySelector<HTMLButtonElement>(
        '[data-testid="turn-collapse-toggle"]'
      )!;
      expect(toggle).not.toBeNull();
      expect(toggle.textContent).toMatch(/Agent worked for|agentWorkedFor/);
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      expect(container.querySelector("output")?.textContent).toBe("reply");
      act(() => toggle.click());
      expect(toggle.getAttribute("aria-expanded")).toBe("true");
      if (withTools)
        expect(container.querySelector("output")?.textContent).toContain(
          "tool"
        );
    }
  );
});
