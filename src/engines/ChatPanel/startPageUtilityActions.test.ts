import type { TFunction } from "i18next";
import { describe, expect, it, vi } from "vitest";

import { buildStartPageUtilityActions } from "./startPageUtilityActions";

const t = ((key: string) => key) as TFunction<
  ["sessions", "common", "projects", "navigation"]
>;

function build(available: boolean | null) {
  const options = {
    availableUpdate: available === null ? null : { available },
    onAddApiKey: vi.fn(),
    onInstallLatestUpdate: vi.fn(),
    setIsImportSessionDialogOpen: vi.fn(),
    setIsQuotaModalOpen: vi.fn(),
    t,
  };
  return { actions: buildStartPageUtilityActions(options), options };
}

describe("buildStartPageUtilityActions", () => {
  it.each([null, false])(
    "lists import, API key and quota when the update is %s",
    (available) => {
      const { actions } = build(available);

      expect(actions.map((action) => [action.id, action.tone])).toEqual([
        ["import-session", "neutral"],
        ["add-api-key", "neutral"],
        ["show-quota", "neutral"],
      ]);
    }
  );

  it("puts the install action first when an update is available", () => {
    const { actions, options } = build(true);

    expect(
      actions.map((action) => [action.id, action.tone, action.title])
    ).toEqual([
      [
        "install-latest-update",
        "warning",
        "chat.startPage.installLatestUpdate.title",
      ],
      ["import-session", "neutral", "navigation:cloud.share.importEntry"],
      ["add-api-key", "neutral", "chat.startPage.addApiKey.title"],
      ["show-quota", "neutral", "chat.startPage.showQuota.title"],
    ]);
    expect(actions[0].onClick).toBe(options.onInstallLatestUpdate);
  });

  it("wires each action to its handler", () => {
    const { actions, options } = build(false);
    const byId = new Map(actions.map((action) => [action.id, action]));

    byId.get("import-session")?.onClick();
    byId.get("show-quota")?.onClick();

    expect(options.setIsImportSessionDialogOpen).toHaveBeenCalledWith(true);
    expect(options.setIsQuotaModalOpen).toHaveBeenCalledWith(true);
    expect(byId.get("add-api-key")?.onClick).toBe(options.onAddApiKey);
    expect(options.onInstallLatestUpdate).not.toHaveBeenCalled();
  });
});
