// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

import SearchInput from ".";

it("keeps all eight search actions named, compact and independently wired", async () => {
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const callbacks = Array.from({ length: 8 }, () => vi.fn());
  try {
    await act(async () =>
      root.render(
        React.createElement(SearchInput, {
          value: "query",
          onChange: vi.fn(),
          showClearButton: true,
          onClear: callbacks[0],
          onCaseSensitiveToggle: callbacks[1],
          onWholeWordToggle: callbacks[2],
          onRegexToggle: callbacks[3],
          onOnlyOpenFilesToggle: callbacks[4],
          onPrevious: callbacks[5],
          onNext: callbacks[6],
          onClose: callbacks[7],
          caseSensitive: true,
          wholeWord: false,
          useRegex: true,
          onlyOpenFiles: false,
          multiline: true,
        })
      )
    );
    const buttons = Array.from(host.querySelectorAll("button"));
    expect(buttons).toHaveLength(8);
    for (const [index, button] of buttons.entries()) {
      expect(button.getAttribute("aria-label")).toBeTruthy();
      expect(button.style.height).toBe("20px");
      expect(button.style.width).toBe("20px");
      expect(button.type).toBe("button");
      expect(button.querySelector("svg")).not.toBeNull();
      await act(async () => button.click());
      expect(callbacks[index]).toHaveBeenCalledTimes(1);
    }
    expect(
      buttons.slice(1, 5).map((button) => button.getAttribute("aria-pressed"))
    ).toEqual(["true", "false", "true", "false"]);
    expect(buttons[1].className).toContain("text-primary-6");
    expect(buttons[2].className).toContain("text-text-2");
    expect(buttons[1].className).toContain("self-start");
    expect(parseFloat(buttons[1].style.marginTop)).toBeGreaterThan(0);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  }
});
