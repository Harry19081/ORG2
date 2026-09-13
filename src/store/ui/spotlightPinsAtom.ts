import { atomWithStorage } from "jotai/utils";

/** Local UI preferences; retain only identities, never rows or action closures. */
export const spotlightCommandPinsAtom = atomWithStorage<string[]>(
  "orgii-spotlight-command-pins",
  []
);
export const spotlightDirectoryPinsAtom = atomWithStorage<string[]>(
  "orgii-spotlight-directory-pins",
  []
);
