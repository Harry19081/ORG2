/**
 * Sticky Notes — Jotai store.
 *
 * - `stickyNotesDocumentAtom` is the in-memory source of truth for the
 *   sidebar's sticky-notes feature.
 * - Hydration is performed once (lazily) by `useHydrateStickyNotes()` via
 *   `loadStickyNotesDocument()`. We deliberately do NOT use
 *   `atomWithStorage`'s storage adapter pattern here because persistence
 *   lives behind a Tauri command, not localStorage.
 * - Writes are debounced (500ms) into `saveStickyNotesDocument()` after
 *   hydration completes.
 *
 * Helper write-only atoms expose typed mutations so components stay free
 * of structural-mutation code.
 */
import { type PrimitiveAtom, atom, useAtom } from "jotai";
import { useEffect, useRef } from "react";

import {
  loadStickyNotesDocument,
  saveStickyNotesDocument,
} from "@src/api/tauri/stickyNotes";
import { createLogger } from "@src/hooks/logger";
import {
  STICKY_NOTE_COLORS,
  type StickyNote,
  type StickyNoteColor,
  type StickyNoteSection,
  type StickyNotesDocument,
  createEmptyDocument,
} from "@src/types/stickyNotes";

const logger = createLogger("StickyNotes");

/** Debounce window between in-memory edits and persistence. */
const SAVE_DEBOUNCE_MS = 500;

// ---------------------------------------------------------------------------
// Core atoms
// ---------------------------------------------------------------------------

/** In-memory source of truth. Mirrors the on-disk JSON shape. */
export const stickyNotesDocumentAtom: PrimitiveAtom<StickyNotesDocument> =
  atom<StickyNotesDocument>(createEmptyDocument());

/** True once `loadStickyNotesDocument` has resolved (or failed). */
export const stickyNotesHydratedAtom = atom<boolean>(false);

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

function newId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  // Fallback — only reached in environments without WebCrypto (unit tests).
  return `sn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Default colour picker
// ---------------------------------------------------------------------------

function pickDefaultColor(doc: StickyNotesDocument): StickyNoteColor {
  const counts = STICKY_NOTE_COLORS.reduce<Record<StickyNoteColor, number>>(
    (acc, color) => {
      acc[color] = 0;
      return acc;
    },
    {
      yellow: 0,
      pink: 0,
      blue: 0,
      green: 0,
      purple: 0,
      gray: 0,
    }
  );
  for (const note of Object.values(doc.notes)) {
    counts[note.color] = (counts[note.color] ?? 0) + 1;
  }
  // Prefer the least-used color so cards visually distribute.
  let best: StickyNoteColor = STICKY_NOTE_COLORS[0];
  for (const color of STICKY_NOTE_COLORS) {
    if (counts[color] < counts[best]) best = color;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Write-only mutation atoms
// ---------------------------------------------------------------------------

export const addSectionAtom = atom(null, (get, set, title?: string) => {
  const doc = get(stickyNotesDocumentAtom);
  const section: StickyNoteSection = {
    id: newId(),
    title: title?.trim() ?? "",
    noteIds: [],
  };
  set(stickyNotesDocumentAtom, {
    ...doc,
    sections: [...doc.sections, section],
  });
});

export const removeSectionAtom = atom(null, (get, set, sectionId: string) => {
  const doc = get(stickyNotesDocumentAtom);
  const section = doc.sections.find((s) => s.id === sectionId);
  if (!section) return;
  const nextNotes = { ...doc.notes };
  for (const noteId of section.noteIds) {
    delete nextNotes[noteId];
  }
  set(stickyNotesDocumentAtom, {
    ...doc,
    sections: doc.sections.filter((s) => s.id !== sectionId),
    notes: nextNotes,
  });
});

export const renameSectionAtom = atom(
  null,
  (get, set, payload: { sectionId: string; title: string }) => {
    const doc = get(stickyNotesDocumentAtom);
    const sections = doc.sections.map((section) =>
      section.id === payload.sectionId
        ? { ...section, title: payload.title }
        : section
    );
    set(stickyNotesDocumentAtom, { ...doc, sections });
  }
);

export const toggleSectionCollapsedAtom = atom(
  null,
  (get, set, sectionId: string) => {
    const doc = get(stickyNotesDocumentAtom);
    const sections = doc.sections.map((section) =>
      section.id === sectionId
        ? { ...section, collapsed: !section.collapsed }
        : section
    );
    set(stickyNotesDocumentAtom, { ...doc, sections });
  }
);

export const reorderSectionsAtom = atom(
  null,
  (get, set, orderedIds: string[]) => {
    const doc = get(stickyNotesDocumentAtom);
    const byId = new Map(doc.sections.map((s) => [s.id, s]));
    const reordered: StickyNoteSection[] = [];
    for (const id of orderedIds) {
      const section = byId.get(id);
      if (section) {
        reordered.push(section);
        byId.delete(id);
      }
    }
    // Append any sections that weren't in the order list (defensive).
    for (const section of byId.values()) reordered.push(section);
    set(stickyNotesDocumentAtom, { ...doc, sections: reordered });
  }
);

export const addNoteAtom = atom(
  null,
  (get, set, payload: { sectionId: string; color?: StickyNoteColor }) => {
    const doc = get(stickyNotesDocumentAtom);
    const section = doc.sections.find((s) => s.id === payload.sectionId);
    if (!section) return;
    const now = Date.now();
    const note: StickyNote = {
      id: newId(),
      title: "",
      body: "",
      color: payload.color ?? pickDefaultColor(doc),
      createdAt: now,
      updatedAt: now,
    };
    const sections = doc.sections.map((s) =>
      s.id === payload.sectionId
        ? { ...s, noteIds: [...s.noteIds, note.id] }
        : s
    );
    set(stickyNotesDocumentAtom, {
      ...doc,
      sections,
      notes: { ...doc.notes, [note.id]: note },
    });
  }
);

export const updateNoteAtom = atom(
  null,
  (
    get,
    set,
    payload: {
      id: string;
      patch: Partial<Omit<StickyNote, "id" | "createdAt">>;
    }
  ) => {
    const doc = get(stickyNotesDocumentAtom);
    const existing = doc.notes[payload.id];
    if (!existing) return;
    const next: StickyNote = {
      ...existing,
      ...payload.patch,
      updatedAt: Date.now(),
    };
    set(stickyNotesDocumentAtom, {
      ...doc,
      notes: { ...doc.notes, [payload.id]: next },
    });
  }
);

export const removeNoteAtom = atom(null, (get, set, noteId: string) => {
  const doc = get(stickyNotesDocumentAtom);
  if (!doc.notes[noteId]) return;
  const sections = doc.sections.map((s) =>
    s.noteIds.includes(noteId)
      ? { ...s, noteIds: s.noteIds.filter((id) => id !== noteId) }
      : s
  );
  const nextNotes = { ...doc.notes };
  delete nextNotes[noteId];
  set(stickyNotesDocumentAtom, { ...doc, sections, notes: nextNotes });
});

export const reorderNotesInSectionAtom = atom(
  null,
  (get, set, payload: { sectionId: string; noteIds: string[] }) => {
    const doc = get(stickyNotesDocumentAtom);
    const sections = doc.sections.map((section) => {
      if (section.id !== payload.sectionId) return section;
      const known = new Set(section.noteIds);
      const reordered = payload.noteIds.filter((id) => known.has(id));
      // Defensive: append any ids that the caller missed.
      for (const id of section.noteIds) {
        if (!reordered.includes(id)) reordered.push(id);
      }
      return { ...section, noteIds: reordered };
    });
    set(stickyNotesDocumentAtom, { ...doc, sections });
  }
);

export const moveNoteToSectionAtom = atom(
  null,
  (
    get,
    set,
    payload: {
      noteId: string;
      fromSectionId: string;
      toSectionId: string;
      index: number;
    }
  ) => {
    const doc = get(stickyNotesDocumentAtom);
    if (!doc.notes[payload.noteId]) return;
    const sections = doc.sections.map((section) => {
      if (section.id === payload.fromSectionId) {
        return {
          ...section,
          noteIds: section.noteIds.filter((id) => id !== payload.noteId),
        };
      }
      return section;
    });
    const target = sections.find((s) => s.id === payload.toSectionId);
    if (!target) return;
    const insertAt = Math.max(
      0,
      Math.min(payload.index, target.noteIds.length)
    );
    const nextTarget = {
      ...target,
      noteIds: [
        ...target.noteIds.slice(0, insertAt),
        payload.noteId,
        ...target.noteIds.slice(insertAt),
      ],
    };
    const nextSections = sections.map((s) =>
      s.id === target.id ? nextTarget : s
    );
    set(stickyNotesDocumentAtom, { ...doc, sections: nextSections });
  }
);

// ---------------------------------------------------------------------------
// Hydration + debounced persistence hook
// ---------------------------------------------------------------------------

/**
 * Hydrate the document once on mount and persist (debounced) on changes.
 * Mount this once near the top of any tree that uses sticky-notes atoms.
 *
 * Implementation notes:
 * - The load promise is guarded by a `cancelled` flag so unmount during
 *   first read doesn't blow away local edits (`.cursor/rules/orgii-frontend.mdc`
 *   rule on async cleanup).
 * - Saves are skipped until hydration completes so we don't overwrite the
 *   on-disk document with the empty default.
 */
export function useHydrateStickyNotes(): void {
  const [doc, setDoc] = useAtom(stickyNotesDocumentAtom);
  const [hydrated, setHydrated] = useAtom(stickyNotesHydratedAtom);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // One-shot hydration.
  useEffect(() => {
    if (hydrated) return;
    let cancelled = false;
    loadStickyNotesDocument()
      .then((loaded) => {
        if (cancelled) return;
        if (loaded) setDoc(loaded);
        setHydrated(true);
      })
      .catch((error) => {
        if (cancelled) return;
        logger.error("Failed to load sticky notes document", error);
        // Mark hydrated so the UI exits its loading state — we'll start
        // from an empty doc and persist on the next edit.
        setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
    // setDoc / setHydrated are stable from useAtom.
  }, [hydrated, setDoc, setHydrated]);

  // Debounced persistence.
  useEffect(() => {
    if (!hydrated) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveStickyNotesDocument(doc).catch((error) => {
        logger.error("Failed to save sticky notes document", error);
      });
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [doc, hydrated]);
}
