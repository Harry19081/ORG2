/**
 * Sticky Notes — frontend domain types.
 *
 * The document is persisted as JSON via the `sticky_notes_load` /
 * `sticky_notes_save` Tauri commands (file: `~/.orgii/sticky-notes.json`).
 * The Rust side treats the payload as opaque, so this file is the
 * source of truth for the on-disk shape.
 */

export const STICKY_NOTE_COLORS = [
  "yellow",
  "pink",
  "blue",
  "green",
  "purple",
  "gray",
] as const;

export type StickyNoteColor = (typeof STICKY_NOTE_COLORS)[number];

export interface StickyNote {
  id: string;
  title: string;
  /** Markdown body, rendered with `react-markdown` + `remark-gfm`. */
  body: string;
  color: StickyNoteColor;
  /** Epoch ms. */
  createdAt: number;
  /** Epoch ms. */
  updatedAt: number;
}

export interface StickyNoteSection {
  id: string;
  title: string;
  /** Ordered list of note ids belonging to this section. */
  noteIds: string[];
  collapsed?: boolean;
}

export interface StickyNotesDocument {
  version: 1;
  /** Ordered top-level sections. */
  sections: StickyNoteSection[];
  /** Flat note pool, keyed by note id. */
  notes: Record<string, StickyNote>;
}

export function createEmptyDocument(): StickyNotesDocument {
  return { version: 1, sections: [], notes: {} };
}
