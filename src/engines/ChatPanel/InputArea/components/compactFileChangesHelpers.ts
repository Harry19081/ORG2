import { getFileName } from "@src/util/file/pathUtils";

export interface FileChangeInfo {
  path: string;
  fileName: string;
  status: string;
  additions: number;
  deletions: number;
  lineCount: number;
}

export interface FileChangesResult {
  files: FileChangeInfo[];
  totalAdditions: number;
  totalDeletions: number;
  stats: { added: number; modified: number; deleted: number };
}

/** Minimal shape of an orgtrack final-diff record consumed by the pill. */
export interface FinalDiffLike {
  filePath: string;
  isDeleted?: boolean;
  linesAdded: number;
  linesRemoved: number;
}

/**
 * Map a single orgtrack final-diff record to the pill's `FileChangeInfo`.
 * Pure so the composer pill's stats math stays unit-testable.
 */
export function mapFinalDiffToFileChangeInfo(
  finalDiff: FinalDiffLike
): FileChangeInfo {
  return {
    path: finalDiff.filePath,
    fileName: getFileName(finalDiff.filePath),
    status: finalDiff.isDeleted ? "D" : "M",
    additions: finalDiff.linesAdded,
    deletions: finalDiff.linesRemoved,
    lineCount: finalDiff.linesAdded + finalDiff.linesRemoved,
  };
}

/** Minimal chat-event shape needed to count round boundaries. */
export interface ChatRoundEvent {
  source?: string | null;
  displayText?: string | null;
}

/**
 * Count chat "rounds" by user-message boundaries — matching `useChatGroups`,
 * which opens a new group at each `source === "user"` event with display text.
 * User messages do not appear mid-stream, so this stays stable during a
 * streaming turn and only grows when a new round begins.
 */
export function countChatRounds(events: ReadonlyArray<ChatRoundEvent>): number {
  let count = 0;
  for (const event of events) {
    if (event.source === "user" && Boolean(event.displayText)) {
      count += 1;
    }
  }
  return count;
}

/**
 * Build the composer files pill's reload signal. Shaped like the per-round
 * footer's `turnFilesReloadKey` (`${sessionId}:${roundCount}:${working|idle}`)
 * so the orgtrack snapshot is refetched when the session changes, a new round
 * appears, or the agent transitions to idle — never on every streamed tick.
 */
export function buildCompactFilesReloadKey(
  sessionId: string | null,
  roundCount: number,
  isAgentWorking: boolean
): string {
  return `${sessionId ?? ""}:${roundCount}:${isAgentWorking ? "working" : "idle"}`;
}
