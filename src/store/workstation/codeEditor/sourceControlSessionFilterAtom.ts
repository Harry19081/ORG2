import { atom } from "jotai";

export const SOURCE_CONTROL_ALL_SESSIONS_FILTER = "all" as const;

export type SourceControlSessionFilter =
  | typeof SOURCE_CONTROL_ALL_SESSIONS_FILTER
  | string;

/** Active agent-session filter for Source Control's All Changes view. */
export const sourceControlSessionFilterAtom = atom<SourceControlSessionFilter>(
  SOURCE_CONTROL_ALL_SESSIONS_FILTER
);
sourceControlSessionFilterAtom.debugLabel = "sourceControlSessionFilterAtom";
