// @vitest-environment jsdom
import { createElement } from "react";
import { expect, it, vi } from "vitest";

import { createSmokeRoot, dispatch } from "@src/test/reactSmokeHarness";

import { DirectoryPathField } from "./DirectoryPathField";

it("associates label/preview and applies a chosen path once, including canceled picks", async () => {
  const choose = vi
      .fn()
      .mockResolvedValueOnce("/new")
      .mockResolvedValueOnce(null),
    change = vi.fn();
  const root = createSmokeRoot();
  const render = (disabled = false) =>
    root.render(
      createElement(DirectoryPathField, {
        label: "Destination",
        value: "/old",
        onChange: change,
        onChoosePath: choose,
        chooseLabel: "Choose folder",
        preview: "Preview",
        disabled,
      })
    );
  try {
    await render();
    const input = root.container.querySelector("input")!;
    expect(root.container.querySelector("label")!.control).toBe(input);
    expect(
      document.getElementById(input.getAttribute("aria-describedby")!)
        ?.textContent
    ).toBe("Preview");
    await dispatch(() => root.container.querySelector("button")!.click());
    expect(change).toHaveBeenCalledExactlyOnceWith("/new");
    await dispatch(() => root.container.querySelector("button")!.click());
    expect(change).toHaveBeenCalledOnce();
    await render(true);
    await dispatch(() => root.container.querySelector("button")!.click());
    expect(choose).toHaveBeenCalledTimes(2);
    expect(root.container.querySelector("input")!.disabled).toBe(true);
  } finally {
    await root.unmount();
  }
});
