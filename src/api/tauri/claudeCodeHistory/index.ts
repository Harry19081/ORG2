import { invoke } from "@tauri-apps/api/core";

import type { ActivityChunk } from "@src/types/session/session";

export interface ClaudeCodeHistorySessionRow {
  sessionId: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  category: "external_history";
  readOnly: true;
  model?: string;
  totalTokens: number;
  background: boolean;
  isActive: boolean;
  repoPath?: string;
  repoName?: string;
  branch?: string;
}

export interface ClaudeCodeHistorySessionPage {
  sessions: ClaudeCodeHistorySessionRow[];
  hasMore: boolean;
}

export async function claudeCodeHistoryListSessions(args?: {
  limit?: number;
  offset?: number;
}): Promise<ClaudeCodeHistorySessionPage> {
  return invoke<ClaudeCodeHistorySessionPage>(
    "claude_code_history_list_sessions",
    {
      limit: args?.limit,
      offset: args?.offset,
    }
  );
}

export async function claudeCodeHistoryChunks(
  sessionId: string
): Promise<ActivityChunk[]> {
  return invoke<ActivityChunk[]>("claude_code_history_chunks", { sessionId });
}
