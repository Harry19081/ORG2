import { describe, expect, it } from "vitest";

import { CUSTOM_ROLE_ICONS, CUSTOM_ROLE_ICON_IDS } from "./customRoleIcons";

/**
 * Icon ids are persisted in `localStorage` under `orgii:userCustomRoles`, so
 * the palette is a compatibility surface: an id may be added, but one that
 * ships can never be dropped or renamed without stranding saved statuses.
 */
const SHIPPED_BEFORE_EXPANSION = [
  "user",
  "briefcase",
  "code",
  "rocket",
  "coffee",
  "headphones",
  "book",
  "compass",
  "feather",
  "flame",
  "shield",
  "sparkles",
] as const;

describe("custom status icon palette", () => {
  it("keeps every id that has already been persisted", () => {
    for (const id of SHIPPED_BEFORE_EXPANSION) {
      expect(CUSTOM_ROLE_ICON_IDS, id).toContain(id);
    }
  });

  it("lists each id once", () => {
    expect(new Set(CUSTOM_ROLE_ICON_IDS).size).toBe(
      CUSTOM_ROLE_ICON_IDS.length
    );
  });

  it("maps every listed id to a distinct glyph", () => {
    const glyphs = new Set<unknown>();
    for (const id of CUSTOM_ROLE_ICON_IDS) {
      const glyph = CUSTOM_ROLE_ICONS[id];
      expect(glyph, id).toBeDefined();
      expect(glyphs.has(glyph), `${id} duplicates another entry's glyph`).toBe(
        false
      );
      glyphs.add(glyph);
    }
  });

  it("exposes every mapped glyph in the ordered list", () => {
    expect([...CUSTOM_ROLE_ICON_IDS].sort()).toEqual(
      Object.keys(CUSTOM_ROLE_ICONS).sort()
    );
  });

  it("uses ids that read as search terms", () => {
    for (const id of CUSTOM_ROLE_ICON_IDS) {
      expect(id, id).toMatch(/^[a-z][a-z-]*$/);
    }
  });
});
