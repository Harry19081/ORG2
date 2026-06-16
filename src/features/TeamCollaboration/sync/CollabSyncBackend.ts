import type { SessionEvent } from "@src/engines/SessionCore/core/types";
import type {
  CollabChatMessageRecord,
  CollabIdentityKind,
  CollabInviteRecord,
  CollabMemberRecord,
  CollabOrgRecord,
  CollabProjectMetadataRecord,
  CollabWorkItemMetadataRecord,
  RemoteTeammateSessionMetadata,
} from "@src/store/collaboration/types";

export interface CollabSyncProfile {
  supabaseUrl: string;
  anonKey: string;
  orgSecret?: string;
  memberId?: string;
}

export interface CreateOrgInput extends CollabSyncProfile {
  name: string;
  displayName: string;
  identityKind: CollabIdentityKind;
}

export interface AcceptInviteInput extends CollabSyncProfile {
  inviteCode: string;
  displayName: string;
  identityKind: CollabIdentityKind;
}

export interface CreateInviteInput extends CollabSyncProfile {
  orgId: string;
  usageLimit?: number;
  expiresAt?: string;
}

export interface RemoveMemberInput extends CollabSyncProfile {
  orgId: string;
  memberId: string;
}

export interface ListChatMessagesInput extends CollabSyncProfile {
  orgId: string;
  limit?: number;
}

export interface PostChatMessageInput extends CollabSyncProfile {
  orgId: string;
  memberId: string;
  authorDisplayName: string;
  authorIdentityKind: CollabIdentityKind;
  body: string;
}

export interface UpsertProjectMetadataInput extends CollabSyncProfile {
  orgId: string;
  project: CollabProjectMetadataRecord;
}

export interface UpsertWorkItemInput extends CollabSyncProfile {
  orgId: string;
  workItem: CollabWorkItemMetadataRecord;
}

export interface UpsertSessionMetadataInput extends CollabSyncProfile {
  session: RemoteTeammateSessionMetadata;
}

export interface RemoveSessionMetadataInput extends CollabSyncProfile {
  orgId: string;
  sourceSessionId: string;
  ownerMemberId: string;
}

export interface RequestSessionSnapshotInput extends CollabSyncProfile {
  requestId: string;
  orgId: string;
  requesterMemberId: string;
  ownerMemberId: string;
  sourceSessionId: string;
}

export interface PublishSessionSnapshotInput extends CollabSyncProfile {
  requestId: string;
  orgId: string;
  sourceSessionId: string;
  session: RemoteTeammateSessionMetadata;
  events: SessionEvent[];
}

export interface DenySessionSnapshotInput extends CollabSyncProfile {
  requestId: string;
  reason: string;
}

export interface ListOrgStateInput extends CollabSyncProfile {
  orgId: string;
  sinceTimestamp?: string;
}

export interface CollabOrgState {
  orgs: CollabOrgRecord[];
  members: CollabMemberRecord[];
  invites: CollabInviteRecord[];
  projects: CollabProjectMetadataRecord[];
  workItems: CollabWorkItemMetadataRecord[];
  sessions: RemoteTeammateSessionMetadata[];
  chatMessages: CollabChatMessageRecord[];
  snapshotRequests: Array<{
    requestId: string;
    orgId: string;
    requesterMemberId: string;
    ownerMemberId: string;
    sourceSessionId: string;
    status: "pending" | "sent" | "denied" | "completed" | "failed";
    error?: string;
    createdAt: string;
    updatedAt?: string;
    session?: RemoteTeammateSessionMetadata;
    events?: SessionEvent[];
  }>;
}

export interface VerifySetupInput extends CollabSyncProfile {}

export interface VerifySetupResult {
  ok: boolean;
  schemaVersion?: number;
  missing?: string[];
}

export interface CollabSyncBackendClient {
  verifySetup(input: VerifySetupInput): Promise<VerifySetupResult>;
  createOrg(
    input: CreateOrgInput
  ): Promise<{ org: CollabOrgRecord; member: CollabMemberRecord }>;
  acceptInvite(
    input: AcceptInviteInput
  ): Promise<{ org: CollabOrgRecord; member: CollabMemberRecord }>;
  createInvite(input: CreateInviteInput): Promise<CollabInviteRecord>;
  removeMember(input: RemoveMemberInput): Promise<CollabMemberRecord>;
  listChatMessages(
    input: ListChatMessagesInput
  ): Promise<CollabChatMessageRecord[]>;
  postChatMessage(
    input: PostChatMessageInput
  ): Promise<CollabChatMessageRecord>;
  upsertProjectMetadata(input: UpsertProjectMetadataInput): Promise<void>;
  upsertWorkItem(input: UpsertWorkItemInput): Promise<void>;
  upsertSessionMetadata(input: UpsertSessionMetadataInput): Promise<void>;
  removeSessionMetadata(input: RemoveSessionMetadataInput): Promise<void>;
  requestSessionSnapshot(input: RequestSessionSnapshotInput): Promise<void>;
  publishSessionSnapshot(input: PublishSessionSnapshotInput): Promise<void>;
  denySessionSnapshot(input: DenySessionSnapshotInput): Promise<void>;
  listOrgState(input: ListOrgStateInput): Promise<CollabOrgState>;
}
