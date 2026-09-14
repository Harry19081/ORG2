// @vitest-environment jsdom
import { act, createElement } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  makeChatItem,
  makeSessionEvent,
} from "@src/engines/SessionCore/rendering/props/__tests__/fixtures";

import { CHAT_FOOTER_SPACER } from "../config/chatFooterSpacer";
import type { ChatGroupMeta } from "../hooks/useChatGroups";
import {
  GroupHeaderRenderer,
  type GroupHeaderRendererProps,
} from "./GroupHeaderRenderer";

const compare = (
  GroupHeaderRenderer as unknown as {
    compare: (
      left: GroupHeaderRendererProps,
      right: GroupHeaderRendererProps
    ) => boolean;
  }
).compare;

const headers = [
  "update the PR",
  "[Request interrupted by user]",
  "fix the conflict",
].map((text, index) =>
  makeChatItem(
    makeSessionEvent({
      id: `user-${index}`,
      source: "user",
      actionType: "raw",
      functionName: "user_message",
      displayText: text,
      displayVariant: "message",
    })
  )
);

function meta(index: number, hasBody: boolean): ChatGroupMeta {
  return {
    turnId: `user-${index}`,
    durationMs: 0,
    itemCount: 0,
    bodyEventCount: 0,
    hasBody,
    previewText: "",
    startMs: null,
    endMs: null,
    unloadedTurn: null,
  };
}

function props(
  groupIndex: number,
  hasBody: boolean[]
): GroupHeaderRendererProps {
  return {
    groupIndex,
    groupHeaders: headers,
    groupMeta: hasBody.map((value, index) => meta(index, value)),
    groupCount: headers.length,
  };
}

describe("GroupHeaderRenderer after a round the agent never worked in", () => {
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

  function marginTopOf(groupIndex: number, hasBody: boolean[]): string {
    act(() =>
      root.render(
        createElement(GroupHeaderRenderer, props(groupIndex, hasBody))
      )
    );
    const header = container.firstElementChild as HTMLElement | null;
    expect(header?.textContent).toContain(
      headers[groupIndex].event?.displayText
    );
    return header?.style.marginTop ?? "";
  }

  it("stacks the next user message without a round gap", () => {
    const hasBody = [false, false, true];

    expect(marginTopOf(1, hasBody)).toBe("");
    expect(marginTopOf(2, hasBody)).toBe("");
  });

  it("keeps the round gap after a round with a body", () => {
    expect(marginTopOf(1, [true, false, true])).toBe(
      `${CHAT_FOOTER_SPACER.ROUND_GAP_PX}px`
    );
  });

  it("re-renders when the preceding round's body changes", () => {
    const bodyless = props(1, [false, false, true]);

    expect(compare(bodyless, { ...bodyless })).toBe(true);
    expect(compare(bodyless, props(1, [true, false, true]))).toBe(false);
  });
});
