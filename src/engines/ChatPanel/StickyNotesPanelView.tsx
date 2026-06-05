/**
 * Sticky Notes — full-page chat-panel surface.
 *
 * Grid-layout board: sections render as collapsible groups stacked
 * vertically, each section's body is a wrapped grid of sticky-note
 * cards. Notes can drag within a section or across sections; sections
 * themselves are vertically reorderable.
 *
 * A single `<DndContext>` wraps the section list and every section's
 * card grid so cards can drag across sections. Drag identity is
 * resolved via `useSortable({ id, data })` —
 * `{ kind: "section" }` for sections, `{ kind: "note", sectionId }`
 * for cards.
 *
 * Persistence is automatic: every write goes through the existing
 * `stickyNotesDocumentAtom` mutation atoms, which the
 * `useHydrateStickyNotes` hook debounces into the Tauri JSON file at
 * `~/.orgii/sticky-notes.json`.
 */
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  pointerWithin,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useAtomValue, useSetAtom } from "jotai";
import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { scaleAwareModifier, useWebViewSensors } from "@src/lib/dndKit";
import {
  moveNoteToSectionAtom,
  reorderNotesInSectionAtom,
  reorderSectionsAtom,
  stickyNotesDocumentAtom,
  stickyNotesHydratedAtom,
  useHydrateStickyNotes,
} from "@src/store/stickyNotes/stickyNotesAtom";
import type {
  StickyNote as StickyNoteModel,
  StickyNoteSection,
} from "@src/types/stickyNotes";

import { StickyNotesBoardSection } from "./StickyNotesPanel";

interface ActiveDrag {
  kind: "section" | "note";
  id: string;
  /** Only set for notes — the section the note is currently parented to. */
  sectionId?: string;
}

const StickyNotesPanelView: React.FC = () => {
  const { t } = useTranslation("navigation");
  useHydrateStickyNotes();

  const doc = useAtomValue(stickyNotesDocumentAtom);
  const hydrated = useAtomValue(stickyNotesHydratedAtom);
  const reorderSections = useSetAtom(reorderSectionsAtom);
  const reorderNotesInSection = useSetAtom(reorderNotesInSectionAtom);
  const moveNoteToSection = useSetAtom(moveNoteToSectionAtom);

  const sensors = useWebViewSensors({ activationDistance: 5 });

  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);

  const sectionIds = useMemo(
    () => doc.sections.map((section) => section.id),
    [doc.sections]
  );

  /**
   * Reverse index from note id → section id. Built once per doc
   * mutation so the drag handler can look up the source section in
   * O(1) without scanning every section on each drag event.
   */
  const noteToSection = useMemo(() => {
    const map = new Map<string, string>();
    for (const section of doc.sections) {
      for (const noteId of section.noteIds) {
        map.set(noteId, section.id);
      }
    }
    return map;
  }, [doc.sections]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as ActiveDrag | undefined;
    if (!data) {
      setActiveDrag(null);
      return;
    }
    setActiveDrag({
      kind: data.kind,
      id: String(event.active.id),
      sectionId: data.sectionId,
    });
  }, []);

  const handleDragCancel = useCallback(() => {
    setActiveDrag(null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDrag(null);
      const { active, over } = event;
      if (!over) return;

      const activeData = active.data.current as ActiveDrag | undefined;
      const overData = over.data.current as ActiveDrag | undefined;
      if (!activeData) return;

      // ── Section reorder ──────────────────────────────────────────
      if (activeData.kind === "section") {
        if (!overData || overData.kind !== "section") return;
        if (active.id === over.id) return;
        const fromIndex = sectionIds.indexOf(String(active.id));
        const toIndex = sectionIds.indexOf(String(over.id));
        if (fromIndex === -1 || toIndex === -1) return;
        const next = [...sectionIds];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        reorderSections(next);
        return;
      }

      // ── Note drag ────────────────────────────────────────────────
      const noteId = String(active.id);
      const fromSectionId = noteToSection.get(noteId);
      if (!fromSectionId) return;

      // The drop target is either another note (sortable card) or a
      // section body (droppable). Resolve the destination section.
      let toSectionId: string | undefined;
      let insertIndex: number | undefined;

      if (overData?.kind === "note" && overData.sectionId) {
        toSectionId = overData.sectionId;
        const target = doc.sections.find((s) => s.id === toSectionId);
        if (!target) return;
        const overIndex = target.noteIds.indexOf(String(over.id));
        insertIndex = overIndex === -1 ? target.noteIds.length : overIndex;
      } else if (overData?.kind === "section") {
        toSectionId = String(over.id);
        const target = doc.sections.find((s) => s.id === toSectionId);
        if (!target) return;
        insertIndex = target.noteIds.length;
      } else {
        return;
      }

      if (fromSectionId === toSectionId) {
        // Reorder within the same section.
        const section = doc.sections.find((s) => s.id === fromSectionId);
        if (!section) return;
        const fromIndex = section.noteIds.indexOf(noteId);
        if (fromIndex === -1 || insertIndex === undefined) return;
        if (fromIndex === insertIndex) return;
        const next = [...section.noteIds];
        next.splice(fromIndex, 1);
        // After removing, indices past the original location shift
        // left by 1. Clamp so the new insert position never overflows.
        const adjusted =
          insertIndex > fromIndex ? insertIndex - 1 : insertIndex;
        next.splice(Math.max(0, Math.min(adjusted, next.length)), 0, noteId);
        reorderNotesInSection({ sectionId: fromSectionId, noteIds: next });
        return;
      }

      if (toSectionId === undefined || insertIndex === undefined) return;
      moveNoteToSection({
        noteId,
        fromSectionId,
        toSectionId,
        index: insertIndex,
      });
    },
    [
      doc.sections,
      moveNoteToSection,
      noteToSection,
      reorderNotesInSection,
      reorderSections,
      sectionIds,
    ]
  );

  const activeOverlay = useMemo(() => {
    if (!activeDrag) return null;
    if (activeDrag.kind === "note") {
      const note = doc.notes[activeDrag.id] as StickyNoteModel | undefined;
      if (!note) return null;
      return (
        <div className="pointer-events-none w-[260px] rounded-lg bg-surface-hover px-3 py-2 text-[13px] font-medium text-text-1 shadow-lg">
          {note.title.trim() || t("stickyNotes.untitledNote")}
        </div>
      );
    }
    const section = doc.sections.find(
      (candidate: StickyNoteSection) => candidate.id === activeDrag.id
    );
    if (!section) return null;
    return (
      <div className="pointer-events-none w-[320px] rounded-lg border border-border-1 bg-fill-1 px-3 py-2 text-[13px] font-medium text-text-1 shadow-lg">
        {section.title.trim() || t("stickyNotes.untitledSection")}
      </div>
    );
  }, [activeDrag, doc.notes, doc.sections, t]);

  const isEmpty = hydrated && doc.sections.length === 0;

  return (
    <div
      className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden"
      data-testid="chat-panel-sticky-notes"
    >
      {/* Board body */}
      {isEmpty ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-[13px] text-text-3">
          {t("stickyNotes.emptyBoard")}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          modifiers={[scaleAwareModifier]}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext
            items={sectionIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-1">
              {doc.sections.map((section) => {
                const notes = section.noteIds
                  .map((id) => doc.notes[id])
                  .filter((note): note is StickyNoteModel => Boolean(note));
                return (
                  <StickyNotesBoardSection
                    key={section.id}
                    section={section}
                    notes={notes}
                  />
                );
              })}
            </div>
          </SortableContext>
          <DragOverlay dropAnimation={null}>{activeOverlay}</DragOverlay>
        </DndContext>
      )}
    </div>
  );
};

export default StickyNotesPanelView;
