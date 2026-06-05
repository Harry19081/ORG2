/**
 * Sticky Notes — Tauri command wrappers.
 *
 * Backend persistence lives at `~/.orgii/sticky-notes.json` (atomic
 * tmp+rename write inside the Rust `sticky_notes` module). The document
 * shape is opaque to Rust; the frontend types in `@src/types/stickyNotes`
 * are the source of truth.
 */
import { invoke } from "@tauri-apps/api/core";

import type { StickyNotesDocument } from "@src/types/stickyNotes";

/**
 * Load the persisted sticky-notes document. Returns `null` on first run
 * (when the JSON file does not yet exist).
 */
export async function loadStickyNotesDocument(): Promise<StickyNotesDocument | null> {
  const raw = await invoke<StickyNotesDocument | null>("sticky_notes_load");
  return raw ?? null;
}

/**
 * Persist the entire sticky-notes document. The Rust side performs an
 * atomic tmp+rename so partial writes are not observable.
 */
export async function saveStickyNotesDocument(
  document: StickyNotesDocument
): Promise<void> {
  await invoke("sticky_notes_save", { document });
}
