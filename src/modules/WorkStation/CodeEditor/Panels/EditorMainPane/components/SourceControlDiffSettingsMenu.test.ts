import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { FileHeaderMoreMenuProps } from "@src/features/FileHeader/FileHeaderMoreMenu";

import { SourceControlDiffSettingsMenu } from "./SourceControlDiffSettingsMenu";

const capture = vi.hoisted(() => ({
  props: null as FileHeaderMoreMenuProps | null,
}));

vi.mock("@src/features/FileHeader/FileHeaderMoreMenu", () => ({
  FileHeaderMoreMenu: (props: FileHeaderMoreMenuProps) => {
    capture.props = props;
    return null;
  },
}));

describe("SourceControlDiffSettingsMenu", () => {
  it("includes the shared sidebar settings submenu", () => {
    renderToStaticMarkup(createElement(SourceControlDiffSettingsMenu));

    expect(capture.props?.showSidebarSettings).toBe(true);
  });
});
