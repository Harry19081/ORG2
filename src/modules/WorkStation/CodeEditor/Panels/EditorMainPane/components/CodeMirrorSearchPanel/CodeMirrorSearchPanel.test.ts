// @vitest-environment jsdom
import {
  closeSearchPanel,
  getSearchQuery,
  openSearchPanel,
} from "@codemirror/search";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { act, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { registerFindTarget } from "@src/components/FindCard/findCoordinator";
import { CURRENT_SHORTCUT_PLATFORM } from "@src/config/keyboard/shortcutBindings";

import { findReplaceExtension } from ".";

const mocks = vi.hoisted(() => ({ card: vi.fn(), replace: vi.fn() }));
vi.mock("@src/components/FindCard", () => ({
  default: (props: { children?: React.ReactNode }) => {
    mocks.card(props);
    return props.children ?? null;
  },
}));
vi.mock("../../../shared", () => ({
  ReplaceInput: (props: unknown) => {
    mocks.replace(props);
    return createElement("input");
  },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
const environment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
let view: EditorView;
let host: HTMLDivElement;
let previous: boolean | undefined;
let unregisterPeer: (() => void) | undefined;
beforeEach(() => {
  previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  vi.clearAllMocks();
  host = document.createElement("div");
  host.dataset.chatPanel = "";
  document.body.append(host);
  view = new EditorView({
    parent: host,
    state: EditorState.create({
      doc: "alpha beta alpha",
      extensions: [findReplaceExtension()],
    }),
  });
});
afterEach(async () => {
  unregisterPeer?.();
  unregisterPeer = undefined;
  await act(async () => {
    view.destroy();
    await Promise.resolve();
  });
  host.remove();
  vi.useRealTimers();
  environment.IS_REACT_ACT_ENVIRONMENT = previous;
});
function card() {
  return mocks.card.mock.calls.at(-1)![0];
}
async function open() {
  await act(async () => {
    openSearchPanel(view);
  });
}
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("CodeMirror consolidated Find", () => {
  it("floats outside the editor panel and debounces query application", async () => {
    await open();
    expect(
      host.querySelector(".cm-search-panel-wrapper")?.getAttribute("style")
    ).toContain("display: none");
    expect(host.querySelector(":scope > .pointer-events-none")).not.toBeNull();
    act(() => card().search.setQuery("alpha"));
    await advance(499);
    expect(getSearchQuery(view.state).search).toBe("");
    await advance(1);
    expect(getSearchQuery(view.state).search).toBe("alpha");
    expect(card().search.resultCount).toBe(2);
  });
  it("flushes the latest query before navigation and replacement", async () => {
    await open();
    act(() => card().search.setQuery("beta"));
    act(() => card().search.nextResult());
    expect(
      view.state.sliceDoc(
        view.state.selection.main.from,
        view.state.selection.main.to
      )
    ).toBe("beta");
    act(() => card().extraControls.props.onClick());
    act(() => mocks.replace.mock.calls.at(-1)![0].onChange("gamma"));
    act(() => mocks.replace.mock.calls.at(-1)![0].onReplaceAll());
    expect(view.state.doc.toString()).toBe("alpha gamma alpha");
  });
  it("removes floating chrome and cancels pending search when closed", async () => {
    await open();
    act(() => card().search.setQuery("alpha"));
    await act(async () => {
      closeSearchPanel(view);
      await Promise.resolve();
    });
    await advance(1000);
    expect(host.querySelector(":scope > .pointer-events-none")).toBeNull();
    expect(getSearchQuery(view.state).search).toBe("");
  });
  it("cycles from the actual editor to Session and then closes", async () => {
    view.dom.getClientRects = () => [{}] as unknown as DOMRectList;
    const session = document.createElement("input");
    session.getClientRects = () => [{}] as unknown as DOMRectList;
    host.append(session);
    const openSession = vi.fn(),
      closeSession = vi.fn();
    unregisterPeer = registerFindTarget({
      scope: "session",
      element: () => session,
      open: openSession,
      close: closeSession,
    });
    view.contentDOM.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    const press = () =>
      view.contentDOM.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "f",
          code: "KeyF",
          bubbles: true,
          cancelable: true,
          metaKey: CURRENT_SHORTCUT_PLATFORM === "mac",
          ctrlKey: CURRENT_SHORTCUT_PLATFORM !== "mac",
        })
      );
    await act(async () => {
      press();
    });
    expect(host.querySelector(".cm-search-panel-wrapper")).not.toBeNull();
    await act(async () => {
      press();
    });
    expect(host.querySelector(".cm-search-panel-wrapper")).toBeNull();
    expect(openSession).toHaveBeenCalledOnce();
    await act(async () => {
      press();
    });
    expect(closeSession).toHaveBeenCalledOnce();
  });
  it("does not expose replacement for read-only editors", async () => {
    view.destroy();
    view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: "alpha",
        extensions: [findReplaceExtension(), EditorState.readOnly.of(true)],
      }),
    });
    await open();
    expect(card().extraControls).toBe(false);
  });
});
