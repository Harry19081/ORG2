import { useAtom } from "jotai";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
  spotlightCommandPinsAtom,
  spotlightDirectoryPinsAtom,
} from "@src/store/ui/spotlightPinsAtom";

import type { SpotlightItem } from "../types";
import { buildPinnedItems, togglePinnedId } from "./pinnedItems";

const canPinCommand = (item: SpotlightItem) =>
  item.type === "action" || item.type === "page" || item.type === "command";
const canPinDirectory = (item: SpotlightItem) => item.type === "repo";

export function usePinnedSpotlightItems(
  items: SpotlightItem[],
  scope: "commands" | "directories",
  enabled = true
): SpotlightItem[] {
  const [ids, setIds] = useAtom(
    scope === "commands" ? spotlightCommandPinsAtom : spotlightDirectoryPinsAtom
  );
  const { t } = useTranslation();
  const toggle = useCallback(
    (id: string) => setIds((previous) => togglePinnedId(previous, id)),
    [setIds]
  );
  return useMemo(
    () =>
      enabled
        ? buildPinnedItems(
            items,
            ids,
            toggle,
            t("selectors.repo.sections.pinned"),
            scope === "commands" ? canPinCommand : canPinDirectory
          )
        : items,
    [items, ids, toggle, t, scope, enabled]
  );
}
