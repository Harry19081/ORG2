/**
 * Pure helpers for the `orgii://collaboration/join` deep link.
 *
 * The URL scheme `orgii://` is the OS-level deep link protocol registered in
 * `src-tauri/tauri.conf.json` (`deep-link.desktop.schemes`). The in-app
 * collaboration JOIN surface opens once these helpers extract Supabase sync
 * invite data from the link.
 *
 * Kept free of React / Jotai / Tauri imports so the parsing and the
 * "is this a collab-join link?" decision can be unit tested in isolation.
 */
import { parseCollabInviteInput } from "./protocol";

export const COLLAB_JOIN_DEEP_LINK_HOST = "collaboration";
export const COLLAB_JOIN_DEEP_LINK_PATH = "join";

export interface CollabJoinDeepLink {
  supabaseUrl?: string;
  anonKey?: string;
  inviteCode: string;
}

/**
 * Whether `url` is an `orgii://collaboration/join` deep link (regardless of
 * whether its query params are valid). Used to branch a deep link toward the
 * collaboration JOIN flow before falling back to generic route conversion.
 */
export function isCollabJoinDeepLink(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed.toLowerCase().startsWith("orgii://")) return false;
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.replace(/^\/+|\/+$/g, "").toLowerCase();
    return (
      host === COLLAB_JOIN_DEEP_LINK_HOST && path === COLLAB_JOIN_DEEP_LINK_PATH
    );
  } catch {
    return false;
  }
}

/**
 * Parse an `orgii://collaboration/join?sync=supabase&supabase=…&invite=…`
 * deep link into the values needed to prefill the JOIN form. Returns `null` for
 * anything that is not a valid collab-join link — including a missing invite
 * code, a malformed URL, a non-collaboration `orgii://` path, or any
 * `yorgai://` link. A missing Supabase URL is allowed because the user can
 * supply it manually. Query params are URL-decoded by `URLSearchParams`.
 */
export function parseCollabJoinDeepLink(
  url: string
): CollabJoinDeepLink | null {
  if (!isCollabJoinDeepLink(url)) return null;
  try {
    const { supabaseUrl, anonKey, inviteCode } = parseCollabInviteInput(
      url.trim()
    );
    return { supabaseUrl, anonKey, inviteCode };
  } catch {
    return null;
  }
}
