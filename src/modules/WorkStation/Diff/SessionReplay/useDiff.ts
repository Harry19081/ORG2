/**
 * useDiff
 *
 * Adapts `useSimulatorAppState` for the Diff app: pulls derived entries,
 * excludes events that do not produce a real diff section, computes the
 * deduplicated file count, and resolves the entry shown in the detail pane.
 */
import { useCallback, useMemo } from "react";

import { simulatorEventsAtom } from "@src/engines/SessionCore/derived/simulatorEvents";
import type { SimulatorAppConfig } from "@src/engines/Simulator/apps/core/types";
import { useSimulatorAppState } from "@src/engines/Simulator/apps/core/useSimulatorAppState";
import {
  buildConsolidatedSessionReplayDiffSectionItems,
  buildSessionReplayDiffSectionItems,
} from "@src/modules/WorkStation/shared";

import { DIFF_APP_CONFIG } from "./config";
import type { DiffEntry, SimulatorDiffState } from "./types";

export interface DiffCounts {
  files: number;
}

export interface UseDiffReturn {
  /** Diff entries that produce at least one renderable file section. */
  entries: DiffEntry[];
  /** Deduplicated file count for the top-level Diff tab. */
  counts: DiffCounts;
  /** Entry rendered in the right detail pane. */
  displayEntry: DiffEntry | null;
  /** Sidebar-selected entry id, or null when the cursor is in charge. */
  selectedEntryId: string | null;
  /** Select an entry inside the Diff app without moving the replay cursor. */
  selectEntry: (entryId: string) => void;
}

function hasRenderableDiffSection(entry: DiffEntry): boolean {
  return buildSessionReplayDiffSectionItems(entry).length > 0;
}

export function useDiff(): UseDiffReturn {
  const { state, selectedItemId, setSelectedItemId } =
    useSimulatorAppState<SimulatorDiffState>({
      config:
        DIFF_APP_CONFIG as unknown as SimulatorAppConfig<SimulatorDiffState>,
      eventsAtomOverride: simulatorEventsAtom,
    });

  const entries = useMemo(
    () => (state.entries ?? []).filter(hasRenderableDiffSection),
    [state.entries]
  );

  const counts = useMemo<DiffCounts>(() => {
    return {
      files: buildConsolidatedSessionReplayDiffSectionItems(entries).length,
    };
  }, [entries]);

  const displayEntry = useMemo<DiffEntry | null>(() => {
    if (selectedItemId) {
      const match = entries.find((entry) => entry.entryId === selectedItemId);
      if (match) return match;
    }
    if (
      state.selectedEntry &&
      entries.some((entry) => entry.entryId === state.selectedEntry?.entryId)
    ) {
      return state.selectedEntry;
    }
    return entries[entries.length - 1] ?? null;
  }, [entries, selectedItemId, state.selectedEntry]);

  const selectEntry = useCallback(
    (entryId: string) => {
      setSelectedItemId(entryId);
    },
    [setSelectedItemId]
  );

  return {
    entries,
    counts,
    displayEntry,
    selectedEntryId: selectedItemId,
    selectEntry,
  };
}
