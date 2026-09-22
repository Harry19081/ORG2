// @vitest-environment jsdom
import { act, createElement } from "react";
import { type Root, createRoot } from "react-dom/client";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import IconPicker, { type IconPickerOption } from "./index";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// HugeIcons glyphs are plain data arrays; a one-path stub is enough to render.
const GLYPH = [["path", { d: "M0 0h1v1H0z", key: "s" }]] as never;

const OPTIONS: IconPickerOption[] = [
  { id: "rocket", icon: GLYPH },
  { id: "coffee", icon: GLYPH },
  { id: "compass", icon: GLYPH, keywords: "navigate" },
];

describe("IconPicker", () => {
  let container: HTMLDivElement;
  let root: Root;
  const actEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  };

  beforeAll(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  afterAll(() => {
    Reflect.deleteProperty(actEnvironment, "IS_REACT_ACT_ENVIRONMENT");
  });

  const render = (onChange = vi.fn()) => {
    act(() =>
      root.render(
        createElement(IconPicker, {
          value: "coffee",
          options: OPTIONS,
          onChange,
          ariaLabel: "Icon",
        })
      )
    );
    return onChange;
  };

  const openPanel = () => {
    const trigger = container.querySelector("button");
    act(() => {
      trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    act(() => vi.advanceTimersByTime(20));
  };

  const cells = () => [
    ...document.querySelectorAll<HTMLElement>('[role="option"]'),
  ];

  it("shows every option and marks the current one selected", () => {
    render();
    openPanel();

    expect(cells().map((cell) => cell.getAttribute("aria-label"))).toEqual([
      "rocket",
      "coffee",
      "compass",
    ]);
    expect(
      cells().filter((cell) => cell.getAttribute("aria-selected") === "true")
    ).toHaveLength(1);
    expect(
      cells()
        .find((cell) => cell.getAttribute("aria-selected") === "true")
        ?.getAttribute("aria-label")
    ).toBe("coffee");
  });

  it("filters on id and on keywords the label does not contain", () => {
    render();
    openPanel();

    const input = document.querySelector("input");
    // React tracks the input's value internally; assigning `.value` directly
    // makes it skip the change as a no-op, so go through the native setter.
    const setNativeValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )?.set;
    const setQuery = (value: string) => {
      act(() => {
        if (!input) return;
        setNativeValue?.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    };

    setQuery("rock");
    expect(cells().map((cell) => cell.getAttribute("aria-label"))).toEqual([
      "rocket",
    ]);

    // "navigate" is only in `keywords`, never rendered as text.
    setQuery("navigate");
    expect(cells().map((cell) => cell.getAttribute("aria-label"))).toEqual([
      "compass",
    ]);

    setQuery("nothing-matches-this");
    expect(cells()).toHaveLength(0);
  });

  it("commits the clicked id and closes the panel", () => {
    const onChange = render();
    openPanel();

    const rocket = cells().find(
      (cell) => cell.getAttribute("aria-label") === "rocket"
    );
    act(() => {
      rocket?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledWith("rocket");
    expect(cells()).toHaveLength(0);
  });
});
