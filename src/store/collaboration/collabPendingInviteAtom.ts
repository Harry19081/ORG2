import { atom } from "jotai";

import type { CollabJoinDeepLink } from "./deepLink";

/**
 * A collaboration invite captured from an `orgii://collaboration/join` deep
 * link, waiting to be consumed by `CreateCollabOrgView` to prefill the JOIN
 * form (Org source = Supabase Sync, Setup mode = Join, invite code + Supabase
 * project fields filled).
 *
 * In-memory only: the prefill is a one-shot hand-off from the deep-link
 * handler to the form. The form clears it once consumed so reopening the
 * surface manually does not re-trigger a stale prefill.
 */
export type CollabPendingInvite = CollabJoinDeepLink;

export const collabPendingInviteAtom = atom<CollabPendingInvite | null>(null);
collabPendingInviteAtom.debugLabel = "collabPendingInviteAtom";
