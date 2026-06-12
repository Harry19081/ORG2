import { z } from "zod/v4";

const SourceCategorySchema = z.enum(["cli", "agent", "os", "remote_shared"]);
const ShareModeSchema = z.enum(["readonly"]);
const MirrorStatusSchema = z.enum([
  "connecting",
  "live",
  "disconnected",
  "ended",
]);

export const RemoteSharedSessionRecordSchema = z.object({
  sessionId: z.string(),
  sourceSessionId: z.string(),
  shareId: z.string(),
  sourceCategory: SourceCategorySchema,
  shareMode: ShareModeSchema,
  name: z.string(),
  status: MirrorStatusSchema,
  repoName: z.string().optional(),
  repoPath: z.string().optional(),
  model: z.string().optional(),
  cliAgentType: z.string().optional(),
  sourcePeerLabel: z.string().optional(),
  metadataJson: z.string().optional(),
  totalTokens: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastConnectedAt: z.string().optional(),
  endedAt: z.string().optional(),
});

const CreateRemoteSharedSessionRequestSchema = z.object({
  sessionId: z.string().min(1),
  sourceSessionId: z.string().min(1),
  shareId: z.string().min(1),
  sourceCategory: SourceCategorySchema,
  shareMode: ShareModeSchema,
  name: z.string().min(1),
  status: MirrorStatusSchema.default("connecting"),
  repoName: z.string().optional(),
  repoPath: z.string().optional(),
  model: z.string().optional(),
  cliAgentType: z.string().optional(),
  sourcePeerLabel: z.string().optional(),
  metadataJson: z.string().optional(),
  totalTokens: z.number().int().optional(),
});

export const CreateRemoteSharedSessionInput = z.object({
  request: CreateRemoteSharedSessionRequestSchema,
});

const PatchRemoteSharedSessionRequestSchema = z
  .object({
    sessionId: z.string().min(1),
    name: z.string().optional(),
    status: MirrorStatusSchema.optional(),
    repoName: z.string().nullable().optional(),
    repoPath: z.string().nullable().optional(),
    model: z.string().nullable().optional(),
    cliAgentType: z.string().nullable().optional(),
    sourcePeerLabel: z.string().nullable().optional(),
    metadataJson: z.string().nullable().optional(),
    totalTokens: z.number().int().optional(),
    lastConnectedAt: z.string().nullable().optional(),
    endedAt: z.string().nullable().optional(),
  })
  .refine(
    (input) =>
      input.name !== undefined ||
      input.status !== undefined ||
      input.repoName !== undefined ||
      input.repoPath !== undefined ||
      input.model !== undefined ||
      input.cliAgentType !== undefined ||
      input.sourcePeerLabel !== undefined ||
      input.metadataJson !== undefined ||
      input.totalTokens !== undefined ||
      input.lastConnectedAt !== undefined ||
      input.endedAt !== undefined,
    { message: "remote_shared_session_patch: at least one field must be set" }
  );

export const PatchRemoteSharedSessionInput = z.object({
  request: PatchRemoteSharedSessionRequestSchema,
});

export const RemoteSharedSessionIdInput = z.object({
  sessionId: z.string().min(1),
});

export const RemoteSharedSessionListSchema = z.array(
  RemoteSharedSessionRecordSchema
);

export type RemoteSharedSessionRecord = z.output<
  typeof RemoteSharedSessionRecordSchema
>;
export type CreateRemoteSharedSessionInput = z.input<
  typeof CreateRemoteSharedSessionInput
>;
export type PatchRemoteSharedSessionInput = z.input<
  typeof PatchRemoteSharedSessionInput
>;
