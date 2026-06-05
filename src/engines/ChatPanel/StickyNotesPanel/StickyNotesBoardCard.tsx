import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useSetAtom } from "jotai";
import { GripVertical, Trash2 } from "lucide-react";
import React, { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import Button from "@src/components/Button";
import Input from "@src/components/Input";
import Textarea from "@src/components/Textarea";
import {
  removeNoteAtom,
  updateNoteAtom,
} from "@src/store/stickyNotes/stickyNotesAtom";
import {
  STICKY_NOTE_COLORS,
  type StickyNote,
  type StickyNoteColor,
} from "@src/types/stickyNotes";

const NOTE_BACKGROUND_CLASS: Record<StickyNoteColor, string> = {
  yellow: "bg-warning-1",
  pink: "bg-danger-1",
  blue: "bg-primary-1",
  green: "bg-success-1",
  purple: "bg-purple-1",
  gray: "bg-fill-1",
};

const NOTE_SWATCH_CLASS: Record<StickyNoteColor, string> = {
  yellow: "bg-warning-6",
  pink: "bg-danger-6",
  blue: "bg-primary-6",
  green: "bg-success-6",
  purple: "bg-purple-500",
  gray: "bg-fill-4",
};

interface StickyNotesBoardCardProps {
  note: StickyNote;
  sectionId: string;
}

const StickyNotesBoardCard: React.FC<StickyNotesBoardCardProps> = ({
  note,
  sectionId,
}) => {
  const { t } = useTranslation("navigation");
  const updateNote = useSetAtom(updateNoteAtom);
  const removeNote = useSetAtom(removeNoteAtom);

  const sortableData = useMemo(
    () => ({ kind: "note" as const, id: note.id, sectionId }),
    [note.id, sectionId]
  );

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: note.id, data: sortableData });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleTitleChange = useCallback(
    (title: string) => {
      updateNote({ id: note.id, patch: { title } });
    },
    [note.id, updateNote]
  );

  const handleBodyChange = useCallback(
    (body: string) => {
      updateNote({ id: note.id, patch: { body } });
    },
    [note.id, updateNote]
  );

  const handleColor = useCallback(
    (color: StickyNoteColor) => {
      if (color === note.color) return;
      updateNote({ id: note.id, patch: { color } });
    },
    [note.color, note.id, updateNote]
  );

  const handleRemove = useCallback(() => {
    removeNote(note.id);
  }, [note.id, removeNote]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex min-h-[132px] min-w-0 flex-col gap-1 rounded-lg p-1 transition-opacity ${NOTE_BACKGROUND_CLASS[note.color]} ${
        isDragging ? "opacity-50" : ""
      }`}
      data-testid="chat-panel-sticky-notes-card"
    >
      <div className="flex min-w-0 items-center gap-1">
        <Input
          type="text"
          value={note.title}
          onChange={handleTitleChange}
          placeholder={t("stickyNotes.noteTitlePlaceholder")}
          fieldVariant="ghost"
          size="small"
          className="flex-1 hover:!bg-transparent"
        />
        <Button
          htmlType="button"
          variant="danger"
          appearance="ghost"
          size="mini"
          iconOnly
          onClick={handleRemove}
          aria-label={t("stickyNotes.deleteNote")}
          title={t("stickyNotes.deleteNote")}
          className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
          icon={<Trash2 size={14} strokeWidth={2} />}
        />
        <Button
          htmlType="button"
          variant="tertiary"
          appearance="ghost"
          size="mini"
          iconOnly
          aria-label="Drag note"
          className="shrink-0 cursor-grab text-text-3 opacity-0 transition-opacity active:cursor-grabbing group-hover:opacity-100"
          icon={<GripVertical size={14} strokeWidth={2} />}
          {...attributes}
          {...listeners}
        />
      </div>

      <Textarea
        value={note.body}
        onChange={handleBodyChange}
        placeholder={t("stickyNotes.noteBodyPlaceholder")}
        rows={4}
        size="small"
        resize="vertical"
        fieldVariant="ghost"
        className="min-h-[88px] w-full flex-1 hover:!bg-transparent"
      />

      <div
        className="flex items-center gap-1 px-8 opacity-0 transition-opacity group-hover:opacity-100"
        role="group"
        aria-label={t("stickyNotes.color")}
      >
        {STICKY_NOTE_COLORS.map((color) => {
          const isActive = color === note.color;
          return (
            <Button
              key={color}
              htmlType="button"
              variant="tertiary"
              appearance="ghost"
              size="mini"
              iconOnly
              aria-label={color}
              aria-pressed={isActive}
              onClick={() => handleColor(color)}
              className={`${NOTE_SWATCH_CLASS[color]} transition-opacity ${
                isActive
                  ? "ring-1 ring-text-1 ring-offset-1 ring-offset-bg-1"
                  : "opacity-70 hover:opacity-100"
              }`}
              style={{ width: 14, height: 14, borderRadius: "9999px" }}
            />
          );
        })}
      </div>
    </div>
  );
};

export default StickyNotesBoardCard;
