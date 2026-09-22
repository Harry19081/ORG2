import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { SETTINGS_REGISTRY } from "@src/config/settingsSchema/registry";

import {
  PRESENCE_SETTING_KEYS,
  buildPresenceSettingDefaults,
} from "./myRolesConstants";

const localesRoot = resolve(process.cwd(), "src/i18n/locales");
const localeFiles = readdirSync(localesRoot).map((locale) =>
  resolve(localesRoot, locale, "settings.json")
);

const statusTabSource = readFileSync(
  resolve(
    process.cwd(),
    "src/modules/MainApp/Integrations/KeyVault/MyRoles/components/MyRolesStatusTab.tsx"
  ),
  "utf8"
);

const newKeys = [
  "custom.title",
  "custom.description",
  "custom.add",
  "custom.defaultLabel",
  "custom.nameLabel",
  "custom.namePlaceholder",
  "custom.iconLabel",
  "custom.iconSearchPlaceholder",
  "custom.guidancePlaceholder",
  "custom.stanceLabel",
  "custom.stanceDesc",
  "custom.stanceInteractive",
  "custom.stanceDeferAndBatch",
  "custom.stanceAutonomous",
  "custom.deleteTitle",
  "custom.deleteMessage",
  "custom.deleteConfirm",
  "custom.deleteCancel",
  "reset.label",
  "reset.description",
  "reset.button",
  "reset.confirmTitle",
  "reset.confirmMessage",
  "reset.confirmCancel",
  "reset.done",
] as const;

function readKey(messages: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (node, segment) =>
        (node as Record<string, unknown> | undefined)?.[segment],
      (messages as Record<string, unknown>).myRoles
    );
}

describe("My Roles status reset", () => {
  it("restores every presence setting to its registry default", () => {
    const defaults = buildPresenceSettingDefaults();

    expect(Object.keys(defaults).sort()).toEqual(
      [...PRESENCE_SETTING_KEYS].sort()
    );
    for (const key of PRESENCE_SETTING_KEYS) {
      expect(defaults[key], key).toEqual(SETTINGS_REGISTRY[key].default);
    }
  });

  it("covers exactly the settings the Status tab edits", () => {
    // A control added to the tab without joining PRESENCE_SETTING_KEYS would
    // survive a reset, leaving the section half-restored. Guidance keys reach
    // `updateSetting` through a variable, so match every schema key the file
    // names rather than only the literal `key:` arguments.
    const referenced = [...statusTabSource.matchAll(/"([\w.]+)"/g)]
      .map((match) => match[1])
      .filter((candidate) => candidate in SETTINGS_REGISTRY);

    expect([...new Set(referenced)].sort()).toEqual(
      [...PRESENCE_SETTING_KEYS].sort()
    );
  });

  it("localizes the custom-status and reset copy in every locale", () => {
    for (const file of localeFiles) {
      const messages: unknown = JSON.parse(readFileSync(file, "utf8"));

      for (const key of newKeys) {
        const value = readKey(messages, key);
        expect(value, `${file}: ${key}`).toBeTypeOf("string");
        expect((value as string).trim(), `${file}: ${key}`).not.toBe("");
        expect(value, `${file}: ${key}`).not.toBe(`myRoles.${key}`);
      }
    }
  });
});
