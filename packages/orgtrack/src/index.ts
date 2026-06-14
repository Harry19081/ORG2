export const ORGTRACK_SCHEMA_VERSION = 1 as const;
export const ORGTRACK_DIR_NAME = ".orgtrack" as const;

export type OrgtrackTier = "meta" | "details" | "trajectory";
export type ActivityKind =
  | "heartbeat"
  | "tool_call"
  | "file_edit"
  | "file_create"
  | "file_delete"
  | "terminal_command"
  | "agent_action"
  | "message"
  | "import_event"
  | "focus_gained"
  | "focus_lost";

export interface AgentMetadata {
  dispatchCategory?: string;
  rustAgentType?: string;
  cliAgentType?: string;
  agentExecMode?: string;
  providerModelType?: string;
  model?: string;
  keySource?: string;
  origin?: string;
  displayName?: string;
  parsedCategories: Record<string, string>;
}

export interface SessionRecord {
  schemaVersion: number;
  source: string;
  sourceSessionId: string;
  sessionId: string;
  title: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
  workspacePath?: string;
  branch?: string;
  parentSessionId?: string;
  orgMemberId?: string;
  metadata: AgentMetadata;
}

export interface ActivityRecord {
  schemaVersion: number;
  recordId: string;
  source: string;
  sourceEventId?: string;
  sessionId?: string;
  timestamp: string;
  kind: ActivityKind;
  workspacePath?: string;
  filePath?: string;
  language?: string;
  linesAdded: number;
  linesRemoved: number;
  metadataJson?: string;
  tier: OrgtrackTier;
}

export interface FileChangeRecord {
  schemaVersion: number;
  recordId: string;
  source: string;
  sessionId: string;
  filePath: string;
  pathHash: string;
  functionName?: string;
  nodeType?: string;
  startLine?: number;
  endLine?: number;
  linesAdded: number;
  linesRemoved: number;
  timestamp: number;
  tier: OrgtrackTier;
  metadata: AgentMetadata;
}

export interface CoreSessionSummary {
  sessionId: string;
  title: string;
  source: string;
  workspacePath?: string;
  filesChanged: number;
  relatedCommits: number;
  committedRatePercent: number;
  model?: string;
  keySource?: string;
}
