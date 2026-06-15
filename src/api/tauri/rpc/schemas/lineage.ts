/**
 * Lineage RPC Schemas
 *
 * Zod schemas for get_session_impact / get_provenance_session_ids commands.
 * Rust source: src-tauri/src/project_management/lineage/
 *
 * Note: get_session_impact returns serde_json::Value in Rust, but we
 * describe the known SessionImpact shape from analytics.rs.
 */
import { z } from "zod/v4";

// ── Input schemas ──

export const GetSessionImpactInput = z.object({
  sessionId: z.string(),
});

// ── Output schemas ──

export const FunctionEntrySchema = z.object({
  file: z.string(),
  name: z.string(),
  nodeType: z.string(),
  lines: z.tuple([z.number().int(), z.number().int()]),
});

export const SessionImpactSchema = z.object({
  sessionId: z.string(),
  filesTouched: z.array(z.string()),
  functionsCreated: z.array(FunctionEntrySchema),
  commitsInfluenced: z.array(z.string()),
  totalLinesAttributed: z.number().int(),
  firstEditAt: z.number().int().nullable().optional(),
  lastCommitAt: z.number().int().nullable().optional(),
});

export const OrgtrackTierSchema = z.enum(["meta", "details", "trajectory"]);
export const OrgtrackTimelineEntryTypeSchema = z.enum([
  "session_edit",
  "commit_link",
]);

export const OrgtrackExportInput = z.object({
  repoPath: z.string(),
  tier: OrgtrackTierSchema.optional(),
  allowRawTrajectory: z.boolean().optional(),
});

export const OrgtrackScanStartInput = z.object({
  repoPath: z.string(),
  tier: OrgtrackTierSchema.optional(),
  allowRawTrajectory: z.boolean().optional(),
  resume: z.boolean().optional(),
  rebuild: z.boolean().optional(),
});

export const OrgtrackScanStatusInput = z.object({
  repoPath: z.string(),
});

export const OrgtrackScanCancelInput = z.object({
  repoPath: z.string(),
});

export const OrgtrackScanStatusSchema = z.enum([
  "idle",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const OrgtrackScanPhaseSchema = z.enum([
  "discover",
  "provenance",
  "local_edits",
  "sessions",
  "commits",
  "index",
  "done",
]);

export const OrgtrackScanCountsSchema = z.object({
  sessions: z.number().int(),
  files: z.number().int(),
  commits: z.number().int(),
  entries: z.number().int(),
  records: z.number().int(),
});

export const OrgtrackScanProgressSchema = z.object({
  schemaVersion: z.number().int(),
  repoPath: z.string(),
  tier: OrgtrackTierSchema,
  status: OrgtrackScanStatusSchema,
  phase: OrgtrackScanPhaseSchema,
  processed: z.number().int(),
  total: z.number().int(),
  counts: OrgtrackScanCountsSchema,
  lastError: z.string().nullable().optional(),
  resumable: z.boolean(),
  cancelRequested: z.boolean(),
  startedAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().nullable().optional(),
});

export const OrgtrackIndexInput = z.object({
  repoPath: z.string(),
});

export const OrgtrackFileTimelineInput = z.object({
  repoPath: z.string(),
  filePath: z.string(),
});

export const OrgtrackFileSessionLookupInput = z.object({
  repoPath: z.string(),
  filePath: z.string(),
});

export const OrgtrackSessionSummariesInput = z.object({
  workspacePath: z.string().optional(),
});

export const OrgtrackReachabilityStateSchema = z.enum([
  "uncommitted",
  "linked_unreachable",
  "reachable_exact",
  "landed_equivalent",
  "reverted_or_absent",
  "unknown",
]);

export const OrgtrackParsedCategorySchema = z.object({
  key: z.string(),
  value: z.string(),
  source: z.string(),
});

export const OrgtrackAgentIdentitySchema = z.object({
  dispatchCategory: z.string().nullable().optional(),
  rustAgentType: z.string().nullable().optional(),
  cliAgentType: z.string().nullable().optional(),
  agentExecMode: z.string().nullable().optional(),
  sessionId: z.string(),
  displayName: z.string().nullable().optional(),
  providerModelType: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  keySource: z.string().nullable().optional(),
  origin: z.string().nullable().optional(),
  parsedCategories: z.array(OrgtrackParsedCategorySchema),
});

export const OrgtrackBranchContextSchema = z.object({
  authoringBranch: z.string().nullable().optional(),
  authoringHeadSha: z.string().nullable().optional(),
  authoringBaseBranch: z.string().nullable().optional(),
  authoringBaseSha: z.string().nullable().optional(),
  defaultBranch: z.string().nullable().optional(),
  worktreePathHash: z.string().nullable().optional(),
});

export const OrgtrackReachabilitySchema = z.object({
  state: OrgtrackReachabilityStateSchema,
  checkedAtHead: z.string().nullable().optional(),
  isReachableFromCurrentHead: z.boolean().nullable().optional(),
  isReachableFromDefaultBranch: z.boolean().nullable().optional(),
  firstReachableCommitSha: z.string().nullable().optional(),
  currentFileContainsAttributedRange: z.string().nullable().optional(),
});

export const OrgtrackExportResultSchema = z.object({
  repoPath: z.string(),
  orgtrackPath: z.string(),
  exportedTier: OrgtrackTierSchema,
  sessionsWritten: z.number().int(),
  filesWritten: z.number().int(),
  commitsWritten: z.number().int(),
  entriesWritten: z.number().int(),
  recordsWritten: z.number().int(),
  manifestVersion: z.number().int(),
});

export const OrgtrackIndexSessionSchema = z.object({
  sessionId: z.string(),
  label: z.string(),
  filesCount: z.number().int(),
  commitsCount: z.number().int(),
  committedFilesCount: z.number().int().optional(),
  committedRatePercent: z.number().int().optional(),
  firstEditAt: z.number().int().nullable().optional(),
  lastEditAt: z.number().int().nullable().optional(),
  agentIdentity: OrgtrackAgentIdentitySchema,
});

export const OrgtrackIndexFileSchema = z.object({
  path: z.string(),
  pathHash: z.string(),
  sessionsCount: z.number().int(),
  commitsCount: z.number().int(),
  entriesCount: z.number().int(),
});

export const OrgtrackIndexCommitSchema = z.object({
  commitSha: z.string(),
  filesCount: z.number().int(),
  sessionsCount: z.number().int(),
  reachabilityState: OrgtrackReachabilityStateSchema,
});

export const OrgtrackSummaryBucketSchema = z.object({
  key: z.string(),
  label: z.string(),
  count: z.number().int(),
});

export const OrgtrackIndexSummarySchema = z.object({
  sessionsByAppType: z.array(OrgtrackSummaryBucketSchema),
  modelsUsed: z.array(OrgtrackSummaryBucketSchema),
  totalSessions: z.number().int(),
  totalFiles: z.number().int(),
  totalCommits: z.number().int(),
  totalEntries: z.number().int(),
});

export const OrgtrackIndexSchema = z.object({
  schemaVersion: z.number().int(),
  generatedAt: z.string(),
  exportedTier: OrgtrackTierSchema,
  derivedVersion: z.number().int(),
  summary: OrgtrackIndexSummarySchema,
  sessions: z.array(OrgtrackIndexSessionSchema),
  files: z.array(OrgtrackIndexFileSchema),
  commits: z.array(OrgtrackIndexCommitSchema),
});

export const OrgtrackFileTimelineEntrySchema = z.object({
  entryType: OrgtrackTimelineEntryTypeSchema,
  id: z.string(),
  filePath: z.string(),
  sessionId: z.string().nullable().optional(),
  sessionLabel: z.string().nullable().optional(),
  agentIdentity: OrgtrackAgentIdentitySchema.nullable().optional(),
  branchContext: OrgtrackBranchContextSchema,
  commitSha: z.string().nullable().optional(),
  reachability: OrgtrackReachabilitySchema,
  timestamp: z.number().int(),
  summary: z.string().nullable().optional(),
  functionName: z.string().nullable().optional(),
  nodeType: z.string().nullable().optional(),
  startLine: z.number().int().nullable().optional(),
  endLine: z.number().int().nullable().optional(),
  tier: OrgtrackTierSchema,
});

export const OrgtrackFileTimelineSchema = z.object({
  schemaVersion: z.number().int(),
  filePath: z.string(),
  pathHash: z.string(),
  entries: z.array(OrgtrackFileTimelineEntrySchema),
});

export const OrgtrackFileSessionSummarySchema = z.object({
  sessionId: z.string(),
  sessionLabel: z.string().nullable().optional(),
  agentIdentity: OrgtrackAgentIdentitySchema.nullable().optional(),
  firstEditAt: z.number().int(),
  lastEditAt: z.number().int(),
  editCount: z.number().int(),
  commitShas: z.array(z.string()),
  reachabilityStates: z.array(OrgtrackReachabilityStateSchema),
});

export const OrgtrackFileSessionLookupSchema = z.object({
  schemaVersion: z.number().int(),
  filePath: z.string(),
  pathHash: z.string(),
  sessions: z.array(OrgtrackFileSessionSummarySchema),
});

export type FunctionEntry = z.output<typeof FunctionEntrySchema>;
export type SessionImpact = z.output<typeof SessionImpactSchema>;
export type OrgtrackTier = z.output<typeof OrgtrackTierSchema>;
export type OrgtrackExportResult = z.output<typeof OrgtrackExportResultSchema>;
export type OrgtrackScanStatus = z.output<typeof OrgtrackScanStatusSchema>;
export type OrgtrackScanPhase = z.output<typeof OrgtrackScanPhaseSchema>;
export type OrgtrackScanCounts = z.output<typeof OrgtrackScanCountsSchema>;
export type OrgtrackScanProgress = z.output<typeof OrgtrackScanProgressSchema>;
export type OrgtrackIndex = z.output<typeof OrgtrackIndexSchema>;
export type OrgtrackFileTimeline = z.output<typeof OrgtrackFileTimelineSchema>;
export const CoreSessionSummarySchema = z.object({
  sessionId: z.string(),
  title: z.string(),
  source: z.string(),
  workspacePath: z.string().nullable().optional(),
  filesChanged: z.number().int(),
  linesAdded: z.number().int(),
  linesRemoved: z.number().int(),
  relatedCommits: z.number().int(),
  committedRatePercent: z.number().int(),
  model: z.string().nullable().optional(),
  keySource: z.string().nullable().optional(),
});

export type OrgtrackFileSessionLookup = z.output<
  typeof OrgtrackFileSessionLookupSchema
>;
export type CoreSessionSummary = z.output<typeof CoreSessionSummarySchema>;
export type OrgtrackFileTimelineEntry = z.output<
  typeof OrgtrackFileTimelineEntrySchema
>;
