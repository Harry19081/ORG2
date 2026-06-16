import { useAtom, useAtomValue, useSetAtom } from "jotai";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { projectApi } from "@src/api/http/project";
import Button from "@src/components/Button";
import Input from "@src/components/Input";
import TabPill from "@src/components/TabPill";
import { supabaseSyncClient } from "@src/features/TeamCollaboration/sync/supabaseSyncClient";
import { useSessionView } from "@src/hooks/ui/tabs/useSessionView";
import WorkItemContentStack from "@src/modules/ProjectManager/WorkItems/components/WorkItemContentStack";
import { SectionContainer } from "@src/modules/shared/layouts/SectionLayout";
import {
  DETAIL_PANEL_TOKENS,
  DetailPanelContainer,
  SessionTable,
} from "@src/modules/shared/layouts/blocks";
import type { SessionTableItem } from "@src/modules/shared/layouts/blocks";
import {
  collabChatMessagesAtom,
  collabInvitesAtom,
  collabMembersAtom,
  collabOrgsAtom,
  collabProjectsAtom,
  collabSessionAccessSettingsAtom,
  collabSessionSnapshotRequestsAtom,
  collabWorkItemsAtom,
  remoteTeammateSessionsAtom,
} from "@src/store/collaboration/collabOrgsAtom";
import {
  COLLAB_CONNECTION_STATUS,
  COLLAB_IDENTITY_KIND,
  COLLAB_ROLE,
  COLLAB_SESSION_ACCESS_MODE,
  COLLAB_SYNC_BACKEND,
  COLLAB_WORKSPACE_SCOPE,
} from "@src/store/collaboration/types";
import type {
  CollabChatMessageRecord,
  CollabInviteRecord,
  CollabMemberRecord,
  CollabProjectMetadataRecord,
  CollabSessionAccessMode,
  CollabSessionAccessSettings,
  CollabWorkItemMetadataRecord,
  RemoteTeammateSessionMetadata,
} from "@src/store/collaboration/types";
import { sessionsAtom } from "@src/store/session";
import type { ChatPanelSelectedCollabOrg } from "@src/store/ui/chatPanelAtom";
import { chatPanelSelectedCollabOrgAtom } from "@src/store/ui/chatPanelAtom";
import { copyText } from "@src/util/data/clipboard";
import { formatSmartDateTime } from "@src/util/data/formatters/date";

const COLLAB_ORG_TAB = {
  WORK_ITEMS: "workItems",
  PROJECTS: "projects",
  SESSIONS: "sessions",
  MEMBERS: "members",
  CHAT: "chat",
  SETTINGS: "settings",
} as const;

type CollabOrgTab = (typeof COLLAB_ORG_TAB)[keyof typeof COLLAB_ORG_TAB];

const CHAT_HISTORY_LIMIT = 100;
const DEFAULT_INVITE_USAGE_LIMIT = 10;

const SESSION_STATUS_COLOR = {
  [COLLAB_CONNECTION_STATUS.CONNECTED]: "var(--color-success-6)",
  [COLLAB_CONNECTION_STATUS.CONNECTING]: "var(--color-warning-6)",
  [COLLAB_CONNECTION_STATUS.DISCONNECTED]: "var(--color-text-4)",
  [COLLAB_CONNECTION_STATUS.ERROR]: "var(--color-danger-6)",
} as const;

function createLocalChatMessageId(orgId: string): string {
  return `${orgId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

interface CollabOrgPanelViewProps {
  selectedCollabOrg: ChatPanelSelectedCollabOrg;
}

function formatSessionDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return formatSmartDateTime(value);
}

function getInviteRemainingUses(invite: CollabInviteRecord): number {
  return Math.max(0, invite.usageLimit - invite.usageCount);
}

function isToday(value: string | undefined): boolean {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function normalizeWorkspacePath(path: string | undefined): string | null {
  const trimmed = path?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, "");
}

function createDefaultAccessSettings(
  orgId: string,
  memberId: string
): CollabSessionAccessSettings {
  return {
    orgId,
    memberId,
    accessMode: COLLAB_SESSION_ACCESS_MODE.OFF,
    workspaceScope: COLLAB_WORKSPACE_SCOPE.SELECTED_WORKSPACES,
    workspacePaths: [],
    updatedAt: new Date().toISOString(),
  };
}

function toSessionTableItem(
  session: RemoteTeammateSessionMetadata,
  fallbackStatusLabel: string,
  metadataOnlyLabel: string
): SessionTableItem {
  return {
    id: session.id,
    title: session.title,
    description: session.ownerDisplayName,
    statusLabel:
      session.accessMode === COLLAB_SESSION_ACCESS_MODE.METADATA_ONLY
        ? metadataOnlyLabel
        : (session.status ?? fallbackStatusLabel),
    statusColor: SESSION_STATUS_COLOR[COLLAB_CONNECTION_STATUS.CONNECTED],
    agentLabel: session.ownerDisplayName,
    workspaceLabel: session.repoPath,
    workspaceTitle: session.repoPath,
    modelLabel: session.branch,
    startedLabel: formatSessionDate(session.lastActivityAt),
    lastUpdatedLabel: formatSessionDate(session.lastActivityAt),
  };
}

function upsertChatMessage(
  messages: CollabChatMessageRecord[],
  incoming: CollabChatMessageRecord
): CollabChatMessageRecord[] {
  const existingIndex = messages.findIndex(
    (message) => message.id === incoming.id
  );
  if (existingIndex < 0) return [...messages, incoming];
  const next = [...messages];
  next[existingIndex] = incoming;
  return next;
}

function upsertInvite(
  invites: CollabInviteRecord[],
  incoming: CollabInviteRecord
): CollabInviteRecord[] {
  const existingIndex = invites.findIndex(
    (invite) => invite.id === incoming.id
  );
  if (existingIndex < 0) return [incoming, ...invites];
  const next = [...invites];
  next[existingIndex] = incoming;
  return next;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getStringField(
  record: Record<string, unknown>,
  fieldNames: string[],
  fallback = "—"
): string {
  for (const fieldName of fieldNames) {
    const value = record[fieldName];
    if (typeof value === "string" && value.trim()) return value;
  }
  return fallback;
}

function getRecordField(
  record: Record<string, unknown>,
  fieldName: string
): Record<string, unknown> | null {
  const value = record[fieldName];
  return isRecord(value) ? value : null;
}

function getMetadataId(record: Record<string, unknown>): string | null {
  const id = record.id;
  return typeof id === "string" && id.trim() ? id : null;
}

function replaceOrgMetadata<TRecord extends Record<string, unknown>>(
  records: TRecord[],
  orgId: string,
  incoming: TRecord[]
): TRecord[] {
  return [...incoming, ...records.filter((record) => record.orgId !== orgId)];
}

function upsertMember(
  members: CollabMemberRecord[],
  incoming: CollabMemberRecord
): CollabMemberRecord[] {
  const existingIndex = members.findIndex(
    (member) => member.id === incoming.id
  );
  if (existingIndex < 0) return [incoming, ...members];
  const next = [...members];
  next[existingIndex] = { ...members[existingIndex], ...incoming };
  return next;
}

function MemberStatusPill({
  active,
  label,
}: {
  active: boolean;
  label: string;
}): React.ReactNode {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-fill-2 px-2 py-0.5 text-[11px] font-medium text-text-2">
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active ? "bg-success-6" : "bg-fill-4"
        }`}
      />
      {label}
    </span>
  );
}

export const CollabOrgPanelView: React.FC<CollabOrgPanelViewProps> = ({
  selectedCollabOrg,
}) => {
  const { t } = useTranslation("navigation");
  const orgs = useAtomValue(collabOrgsAtom);
  const sessions = useAtomValue(sessionsAtom);
  const remoteSessions = useAtomValue(remoteTeammateSessionsAtom);
  const { openSession } = useSessionView();
  const [chatMessages, setChatMessages] = useAtom(collabChatMessagesAtom);
  const [members, setMembers] = useAtom(collabMembersAtom);
  const [invites, setInvites] = useAtom(collabInvitesAtom);
  const [projects, setProjects] = useAtom(collabProjectsAtom);
  const [workItems, setWorkItems] = useAtom(collabWorkItemsAtom);
  const [accessSettingsList, setAccessSettingsList] = useAtom(
    collabSessionAccessSettingsAtom
  );
  const [snapshotRequests, setSnapshotRequests] = useAtom(
    collabSessionSnapshotRequestsAtom
  );
  const setSelectedCollabOrg = useSetAtom(chatPanelSelectedCollabOrgAtom);
  const [activeTab, setActiveTab] = useState<CollabOrgTab>(
    selectedCollabOrg.memberId
      ? COLLAB_ORG_TAB.MEMBERS
      : COLLAB_ORG_TAB.WORK_ITEMS
  );
  const [draftMessage, setDraftMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [copyingInvite, setCopyingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [localMetadataError, setLocalMetadataError] = useState<string | null>(
    null
  );

  const org = useMemo(
    () => orgs.find((candidate) => candidate.id === selectedCollabOrg.orgId),
    [orgs, selectedCollabOrg.orgId]
  );
  const orgMembers = useMemo(
    () =>
      members.filter(
        (member) =>
          member.orgId === selectedCollabOrg.orgId && !member.removedAt
      ),
    [members, selectedCollabOrg.orgId]
  );
  const selectedMember = useMemo(
    () =>
      selectedCollabOrg.memberId
        ? orgMembers.find((member) => member.id === selectedCollabOrg.memberId)
        : null,
    [orgMembers, selectedCollabOrg.memberId]
  );
  const currentMember = useMemo(
    () =>
      orgMembers.find((member) => member.id === org?.localMemberId) ??
      orgMembers.find((member) => member.role === COLLAB_ROLE.ADMIN) ??
      orgMembers[0],
    [org?.localMemberId, orgMembers]
  );
  const currentAccessSettings = useMemo(() => {
    if (!currentMember) return null;
    return (
      accessSettingsList.find(
        (settings) =>
          settings.orgId === selectedCollabOrg.orgId &&
          settings.memberId === currentMember.id
      ) ??
      createDefaultAccessSettings(selectedCollabOrg.orgId, currentMember.id)
    );
  }, [accessSettingsList, currentMember, selectedCollabOrg.orgId]);
  const workspaceOptions = useMemo(() => {
    const paths = new Set<string>();
    for (const session of sessions) {
      const normalizedPath = normalizeWorkspacePath(session.repoPath);
      if (normalizedPath) paths.add(normalizedPath);
    }
    return Array.from(paths).sort((left, right) => left.localeCompare(right));
  }, [sessions]);
  const latestInvite = useMemo(
    () =>
      invites
        .filter(
          (invite) =>
            invite.orgId === selectedCollabOrg.orgId && !invite.revokedAt
        )
        .sort((left, right) =>
          right.createdAt.localeCompare(left.createdAt)
        )[0],
    [invites, selectedCollabOrg.orgId]
  );
  const canCreateInvite =
    Boolean(org?.supabaseUrl && org.supabaseAnonKey && org.orgSecret) &&
    currentMember?.role === COLLAB_ROLE.ADMIN;
  const orgSessions = useMemo(
    () =>
      remoteSessions.filter(
        (session) => session.orgId === selectedCollabOrg.orgId
      ),
    [remoteSessions, selectedCollabOrg.orgId]
  );
  const visibleSessions = useMemo(
    () =>
      selectedMember
        ? orgSessions.filter(
            (session) => session.ownerMemberId === selectedMember.id
          )
        : orgSessions,
    [orgSessions, selectedMember]
  );
  const sessionItems = useMemo(
    () =>
      visibleSessions.map((session) =>
        toSessionTableItem(
          session,
          t("collaboration.sessionStatusActive"),
          t("collaboration.access.metadataOnlyBadge")
        )
      ),
    [visibleSessions, t]
  );
  const activeMemberIds = new Set(
    orgSessions
      .filter((session) => isToday(session.lastActivityAt))
      .map((session) => session.ownerMemberId)
  );
  const orgChatMessages = useMemo(
    () =>
      chatMessages
        .filter((message) => message.orgId === selectedCollabOrg.orgId)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    [chatMessages, selectedCollabOrg.orgId]
  );
  const orgProjects = useMemo(
    () =>
      projects.filter((project) => project.orgId === selectedCollabOrg.orgId),
    [projects, selectedCollabOrg.orgId]
  );
  const orgWorkItems = useMemo(
    () =>
      workItems.filter(
        (workItem) => workItem.orgId === selectedCollabOrg.orgId
      ),
    [selectedCollabOrg.orgId, workItems]
  );
  const latestSnapshotRequest = useMemo(
    () =>
      snapshotRequests
        .filter((request) => request.orgId === selectedCollabOrg.orgId)
        .sort((left, right) =>
          right.createdAt.localeCompare(left.createdAt)
        )[0],
    [selectedCollabOrg.orgId, snapshotRequests]
  );

  useEffect(() => {
    if (!org || org.syncBackend === COLLAB_SYNC_BACKEND.SUPABASE) return;
    let cancelled = false;

    const loadLocalOrgMetadata = async () => {
      setLocalMetadataError(null);
      const projectData = await projectApi.readProjects({ orgId: org.id });
      if (cancelled) return;

      const nextProjects: CollabProjectMetadataRecord[] = projectData.map(
        (project) => ({
          id: project.meta.id,
          orgId: org.id,
          name: project.meta.name,
          slug: project.slug,
          status: project.meta.status,
          priority: project.meta.priority,
          health: project.meta.health,
          lead: project.meta.lead,
          description: project.description,
          updatedAt: project.meta.updated_at,
        })
      );

      const workItemGroups = await Promise.all(
        projectData.map(async (project) => {
          const enrichedWorkItems = await projectApi.readWorkItemsEnriched(
            project.slug,
            { orgId: org.id }
          );
          return enrichedWorkItems.map<CollabWorkItemMetadataRecord>(
            (workItem) => ({
              id: workItem.id,
              orgId: org.id,
              title: workItem.title,
              status: workItem.status,
              priority: workItem.priority,
              projectId: workItem.project?.id ?? project.meta.id,
              projectName: workItem.project?.name ?? project.meta.name,
              assigneeName: workItem.assignee?.name,
              updatedAt: workItem.updatedAt,
            })
          );
        })
      );
      if (cancelled) return;

      setProjects((current) =>
        replaceOrgMetadata(current, org.id, nextProjects)
      );
      setWorkItems((current) =>
        replaceOrgMetadata(current, org.id, workItemGroups.flat())
      );
    };

    void loadLocalOrgMetadata().catch((error: unknown) => {
      if (cancelled) return;
      setLocalMetadataError(
        error instanceof Error ? error.message : String(error)
      );
    });

    return () => {
      cancelled = true;
    };
  }, [org, setProjects, setWorkItems]);

  useEffect(() => {
    if (!org?.supabaseUrl || !org.supabaseAnonKey || !org.orgSecret) return;
    let cancelled = false;
    supabaseSyncClient
      .listChatMessages({
        supabaseUrl: org.supabaseUrl,
        anonKey: org.supabaseAnonKey,
        orgSecret: org.orgSecret,
        orgId: org.id,
        limit: CHAT_HISTORY_LIMIT,
      })
      .then((messages) => {
        if (cancelled) return;
        setChatMessages((current) =>
          messages.reduce(upsertChatMessage, current)
        );
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setChatError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      cancelled = true;
    };
  }, [
    org?.id,
    org?.orgSecret,
    org?.supabaseAnonKey,
    org?.supabaseUrl,
    setChatMessages,
  ]);

  const handleSendMessage = useCallback(async () => {
    const body = draftMessage.trim();
    if (!body || !org || sending) return;
    setSending(true);
    setChatError(null);
    try {
      if (
        org.supabaseUrl &&
        org.supabaseAnonKey &&
        org.orgSecret &&
        currentMember
      ) {
        const message = await supabaseSyncClient.postChatMessage({
          supabaseUrl: org.supabaseUrl,
          anonKey: org.supabaseAnonKey,
          orgSecret: org.orgSecret,
          orgId: org.id,
          memberId: currentMember.id,
          authorDisplayName: currentMember.displayName,
          authorIdentityKind: currentMember.identityKind,
          body,
        });
        setChatMessages((current) => upsertChatMessage(current, message));
      } else {
        const author =
          currentMember ??
          orgMembers.find(
            (member) => member.identityKind === COLLAB_IDENTITY_KIND.HUMAN
          ) ??
          orgMembers[0];
        const message: CollabChatMessageRecord = {
          id: createLocalChatMessageId(org.id),
          orgId: org.id,
          authorMemberId: author?.id ?? "local-human",
          authorDisplayName:
            author?.displayName ?? t("collaboration.localHuman"),
          authorIdentityKind:
            author?.identityKind ?? COLLAB_IDENTITY_KIND.HUMAN,
          body,
          createdAt: new Date().toISOString(),
        };
        setChatMessages((current) => upsertChatMessage(current, message));
      }
      setDraftMessage("");
    } catch (error) {
      setChatError(error instanceof Error ? error.message : String(error));
    } finally {
      setSending(false);
    }
  }, [
    currentMember,
    draftMessage,
    org,
    orgMembers,
    sending,
    setChatMessages,
    t,
  ]);

  const updateAccessSettings = useCallback(
    (
      updates: Partial<
        Pick<CollabSessionAccessSettings, "accessMode" | "workspacePaths">
      >
    ) => {
      if (!currentMember || !currentAccessSettings) return;
      const nextSettings: CollabSessionAccessSettings = {
        ...currentAccessSettings,
        ...updates,
        workspaceScope: COLLAB_WORKSPACE_SCOPE.SELECTED_WORKSPACES,
        updatedAt: new Date().toISOString(),
      };
      setAccessSettingsList((current) => {
        const existingIndex = current.findIndex(
          (settings) =>
            settings.orgId === nextSettings.orgId &&
            settings.memberId === nextSettings.memberId
        );
        if (existingIndex < 0) return [nextSettings, ...current];
        const next = [...current];
        next[existingIndex] = nextSettings;
        return next;
      });
    },
    [currentAccessSettings, currentMember, setAccessSettingsList]
  );

  const handleSelectAccessMode = useCallback(
    (accessMode: CollabSessionAccessMode) => {
      updateAccessSettings({ accessMode });
    },
    [updateAccessSettings]
  );

  const handleToggleWorkspace = useCallback(
    (workspacePath: string) => {
      if (!currentAccessSettings) return;
      const workspacePaths = currentAccessSettings.workspacePaths.includes(
        workspacePath
      )
        ? currentAccessSettings.workspacePaths.filter(
            (path) => path !== workspacePath
          )
        : [...currentAccessSettings.workspacePaths, workspacePath];
      updateAccessSettings({ workspacePaths });
    },
    [currentAccessSettings, updateAccessSettings]
  );

  const handleSelectMember = useCallback(
    (member: CollabMemberRecord) => {
      setSelectedCollabOrg({ orgId: member.orgId, memberId: member.id });
      setActiveTab(COLLAB_ORG_TAB.MEMBERS);
    },
    [setSelectedCollabOrg]
  );

  const handleSelectSession = useCallback(
    (item: SessionTableItem) => {
      const remoteSession = orgSessions.find(
        (session) => session.id === item.id
      );
      if (!remoteSession) return;

      const localSession = sessions.find(
        (session) =>
          session.session_id === remoteSession.sourceSessionId ||
          session.session_id === remoteSession.id
      );

      if (localSession) {
        openSession(
          localSession.session_id,
          localSession.name || localSession.user_input || remoteSession.title,
          localSession.repoPath ?? remoteSession.repoPath
        );
        return;
      }

      if (remoteSession.accessMode !== COLLAB_SESSION_ACCESS_MODE.FULL_REPLAY) {
        setSnapshotRequests((current) => [
          {
            requestId: crypto.randomUUID(),
            orgId: remoteSession.orgId,
            requesterMemberId: currentMember?.id ?? "local-member",
            ownerMemberId: remoteSession.ownerMemberId,
            sourceSessionId: remoteSession.sourceSessionId,
            createdAt: new Date().toISOString(),
            status: "denied",
            error: t("collaboration.access.metadataOnlyDenied"),
          },
          ...current,
        ]);
        return;
      }

      setSnapshotRequests((current) => [
        {
          requestId: crypto.randomUUID(),
          orgId: remoteSession.orgId,
          requesterMemberId: currentMember?.id ?? "local-member",
          ownerMemberId: remoteSession.ownerMemberId,
          sourceSessionId: remoteSession.sourceSessionId,
          createdAt: new Date().toISOString(),
          status: "pending",
        },
        ...current,
      ]);
    },
    [
      currentMember?.id,
      openSession,
      orgSessions,
      sessions,
      setSnapshotRequests,
      t,
    ]
  );

  const handleBackToOrg = useCallback(() => {
    setSelectedCollabOrg({ orgId: selectedCollabOrg.orgId });
    setActiveTab(COLLAB_ORG_TAB.SESSIONS);
  }, [selectedCollabOrg.orgId, setSelectedCollabOrg]);

  const handleCreateInvite = useCallback(async () => {
    if (
      !org?.supabaseUrl ||
      !org.supabaseAnonKey ||
      !org.orgSecret ||
      creatingInvite
    ) {
      return;
    }
    setCreatingInvite(true);
    setInviteError(null);
    try {
      const invite = await supabaseSyncClient.createInvite({
        supabaseUrl: org.supabaseUrl,
        anonKey: org.supabaseAnonKey,
        orgSecret: org.orgSecret,
        orgId: org.id,
        usageLimit: DEFAULT_INVITE_USAGE_LIMIT,
      });
      setInvites((current) => upsertInvite(current, invite));
      await copyText(invite.inviteLink);
      setCopyingInvite(true);
      window.setTimeout(() => setCopyingInvite(false), 1500);
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : String(error));
    } finally {
      setCreatingInvite(false);
    }
  }, [creatingInvite, org, setInvites]);

  const handleCopyInvite = useCallback(async () => {
    if (!latestInvite?.inviteLink || copyingInvite) return;
    setInviteError(null);
    try {
      await copyText(latestInvite.inviteLink);
      setCopyingInvite(true);
      window.setTimeout(() => setCopyingInvite(false), 1500);
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : String(error));
    }
  }, [copyingInvite, latestInvite?.inviteLink]);

  const handleRemoveMember = useCallback(
    async (member: CollabMemberRecord) => {
      if (
        !org?.supabaseUrl ||
        !org.supabaseAnonKey ||
        !org.orgSecret ||
        removingMemberId
      ) {
        return;
      }
      setRemovingMemberId(member.id);
      setMemberError(null);
      try {
        const removedMember = await supabaseSyncClient.removeMember({
          supabaseUrl: org.supabaseUrl,
          anonKey: org.supabaseAnonKey,
          orgSecret: org.orgSecret,
          orgId: org.id,
          memberId: member.id,
        });
        setMembers((current) => upsertMember(current, removedMember));
        if (selectedCollabOrg.memberId === member.id) {
          setSelectedCollabOrg({ orgId: selectedCollabOrg.orgId });
        }
      } catch (error) {
        setMemberError(error instanceof Error ? error.message : String(error));
      } finally {
        setRemovingMemberId(null);
      }
    },
    [
      org,
      removingMemberId,
      selectedCollabOrg.memberId,
      selectedCollabOrg.orgId,
      setMembers,
      setSelectedCollabOrg,
    ]
  );

  const tabs = useMemo(() => {
    const baseTabs = [
      {
        key: COLLAB_ORG_TAB.WORK_ITEMS,
        label: t("collaboration.tabs.workItems"),
      },
      { key: COLLAB_ORG_TAB.PROJECTS, label: t("collaboration.tabs.projects") },
      { key: COLLAB_ORG_TAB.SESSIONS, label: t("collaboration.tabs.sessions") },
      { key: COLLAB_ORG_TAB.MEMBERS, label: t("collaboration.tabs.members") },
      { key: COLLAB_ORG_TAB.CHAT, label: t("collaboration.tabs.chat") },
    ];
    if (!currentMember) return baseTabs;
    return [
      ...baseTabs,
      { key: COLLAB_ORG_TAB.SETTINGS, label: t("collaboration.tabs.settings") },
    ];
  }, [currentMember, t]);

  if (!org) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-[13px] text-text-3">
        {t("collaboration.orgNotFound")}
      </div>
    );
  }

  const descriptionContent = (
    <section
      className={`${DETAIL_PANEL_TOKENS.contentWidth} flex flex-col`}
      data-testid="chat-panel-collab-org-section"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <TabPill
          tabs={tabs}
          activeTab={activeTab}
          onChange={(tab) => setActiveTab(tab as CollabOrgTab)}
          variant="simple"
          size="large"
          fillWidth={false}
        />
        {selectedMember ? (
          <Button htmlType="button" size="small" onClick={handleBackToOrg}>
            {t("collaboration.backToOrg")}
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        {activeTab === COLLAB_ORG_TAB.WORK_ITEMS ? (
          <SectionContainer color="chatPanelInfo" padding="default">
            <div className="flex min-h-[320px] flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[13px] font-semibold text-text-1">
                    {t("collaboration.workItems.title")}
                  </div>
                  <div className="mt-1 text-[12px] text-text-3">
                    {t("collaboration.workItems.description")}
                  </div>
                </div>
                <div className="rounded-full bg-fill-1 px-2 py-0.5 text-[11px] text-text-3">
                  {t("collaboration.workItems.count", {
                    count: orgWorkItems.length,
                  })}
                </div>
              </div>
              {localMetadataError ? (
                <div className="rounded-lg bg-danger-1 px-3 py-2 text-[12px] text-danger-6">
                  {localMetadataError}
                </div>
              ) : null}
              {orgWorkItems.length === 0 ? (
                <div className="flex min-h-[220px] items-center justify-center rounded-lg bg-fill-1 px-4 text-center text-[13px] text-text-3">
                  {t("collaboration.workItems.empty")}
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-border-2 rounded-xl border border-border-2 bg-bg-2">
                  {orgWorkItems.map((workItem, index) => {
                    const project = getRecordField(workItem, "project");
                    const projectName = project
                      ? getStringField(project, ["name"])
                      : getStringField(workItem, ["projectName", "projectId"]);
                    return (
                      <div
                        key={getMetadataId(workItem) ?? `work-item-${index}`}
                        className="flex flex-col gap-2 px-3 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-[13px] font-semibold text-text-1">
                              {getStringField(workItem, ["title", "name"])}
                            </div>
                            <div className="mt-1 truncate text-[12px] text-text-3">
                              {projectName}
                            </div>
                          </div>
                          <div className="shrink-0 rounded-full bg-fill-1 px-2 py-0.5 text-[11px] text-text-3">
                            {getStringField(workItem, ["status"])}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 text-[11px] text-text-3">
                          <span className="rounded-full bg-fill-1 px-2 py-0.5">
                            {getStringField(workItem, ["priority"])}
                          </span>
                          <span className="rounded-full bg-fill-1 px-2 py-0.5">
                            {getStringField(
                              workItem,
                              ["assigneeName"],
                              t("collaboration.workItems.unassigned")
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </SectionContainer>
        ) : null}

        {activeTab === COLLAB_ORG_TAB.PROJECTS ? (
          <SectionContainer color="chatPanelInfo" padding="default">
            <div className="flex min-h-[320px] flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[13px] font-semibold text-text-1">
                    {t("collaboration.projects.title")}
                  </div>
                  <div className="mt-1 text-[12px] text-text-3">
                    {t("collaboration.projects.description")}
                  </div>
                </div>
                <div className="rounded-full bg-fill-1 px-2 py-0.5 text-[11px] text-text-3">
                  {t("collaboration.projects.count", {
                    count: orgProjects.length,
                  })}
                </div>
              </div>
              {localMetadataError ? (
                <div className="rounded-lg bg-danger-1 px-3 py-2 text-[12px] text-danger-6">
                  {localMetadataError}
                </div>
              ) : null}
              {orgProjects.length === 0 ? (
                <div className="flex min-h-[220px] items-center justify-center rounded-lg bg-fill-1 px-4 text-center text-[13px] text-text-3">
                  {t("collaboration.projects.empty")}
                </div>
              ) : (
                <div className="grid gap-3 @[720px]:grid-cols-2">
                  {orgProjects.map((project, index) => (
                    <div
                      key={getMetadataId(project) ?? `project-${index}`}
                      className="rounded-xl border border-border-2 bg-bg-2 px-3 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-semibold text-text-1">
                            {getStringField(project, ["name", "title"])}
                          </div>
                          <div className="mt-1 line-clamp-2 text-[12px] text-text-3">
                            {getStringField(
                              project,
                              ["description"],
                              t("collaboration.projects.noDescription")
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 rounded-full bg-fill-1 px-2 py-0.5 text-[11px] text-text-3">
                          {getStringField(project, ["status"])}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-text-3">
                        <span className="rounded-full bg-fill-1 px-2 py-0.5">
                          {getStringField(project, ["priority"])}
                        </span>
                        <span className="rounded-full bg-fill-1 px-2 py-0.5">
                          {getStringField(project, ["health"])}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SectionContainer>
        ) : null}

        {activeTab === COLLAB_ORG_TAB.SESSIONS ? (
          <>
            <SessionTable
              items={sessionItems}
              onSelect={handleSelectSession}
              showSearch
              surfaceVariant="chatPanel"
              maxHeight={520}
              pageSize={10}
              pageSizeOptions={[10, 25, 50]}
            />
            {latestSnapshotRequest?.status === "pending" ||
            latestSnapshotRequest?.status === "sent" ? (
              <div className="rounded-lg bg-fill-1 px-3 py-2 text-[12px] text-text-3">
                {t("collaboration.access.requestPending")}
              </div>
            ) : null}
            {latestSnapshotRequest?.error ? (
              <div className="rounded-lg bg-danger-1 px-3 py-2 text-[12px] text-danger-6">
                {latestSnapshotRequest.error}
              </div>
            ) : null}
          </>
        ) : null}

        {activeTab === COLLAB_ORG_TAB.MEMBERS ? (
          <>
            {!selectedMember ? (
              <SectionContainer color="chatPanelInfo" padding="none">
                <div className="flex flex-col gap-3 p-4 @[720px]:flex-row @[720px]:items-center @[720px]:justify-between">
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-text-1">
                      {t("collaboration.invite.title")}
                    </div>
                    {!canCreateInvite ? (
                      <div className="mt-1 text-[12px] text-text-3">
                        {t("collaboration.invite.adminOnly")}
                      </div>
                    ) : null}
                    {latestInvite ? (
                      <div className="mt-2 rounded-lg bg-fill-1 px-3 py-2">
                        <div className="select-text break-all text-[12px] text-text-2">
                          {latestInvite.inviteLink}
                        </div>
                        <div className="mt-1 text-[11px] text-text-3">
                          {t("collaboration.invite.remainingUses", {
                            count: getInviteRemainingUses(latestInvite),
                          })}
                          {latestInvite.expiresAt
                            ? ` · ${t("collaboration.invite.expires", {
                                date: formatSessionDate(latestInvite.expiresAt),
                              })}`
                            : ""}
                        </div>
                      </div>
                    ) : null}
                    {inviteError ? (
                      <div className="mt-2 text-[12px] text-danger-6">
                        {inviteError}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {latestInvite ? (
                      <Button
                        htmlType="button"
                        size="small"
                        disabled={copyingInvite}
                        onClick={() => void handleCopyInvite()}
                      >
                        {copyingInvite
                          ? t("collaboration.copiedInvite")
                          : t("collaboration.copyInvite")}
                      </Button>
                    ) : null}
                    <Button
                      htmlType="button"
                      size="small"
                      variant="primary"
                      disabled={!canCreateInvite || creatingInvite}
                      loading={creatingInvite}
                      onClick={() => void handleCreateInvite()}
                    >
                      {latestInvite
                        ? t("collaboration.invite.createNew")
                        : t("collaboration.invite.create")}
                    </Button>
                  </div>
                </div>
              </SectionContainer>
            ) : null}

            <SectionContainer color="chatPanelInfo" padding="default">
              <div className="flex flex-col divide-y divide-border-2">
                {memberError ? (
                  <div className="px-3 pb-2 text-[12px] text-danger-6">
                    {memberError}
                  </div>
                ) : null}
                {orgMembers.map((member) => {
                  const canRemoveMember =
                    currentMember?.role === COLLAB_ROLE.ADMIN &&
                    currentMember.id !== member.id &&
                    Boolean(
                      org.supabaseUrl && org.supabaseAnonKey && org.orgSecret
                    );
                  return (
                    <div
                      key={member.id}
                      className="flex w-full items-center justify-between gap-3 py-2"
                    >
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center justify-between gap-3 px-3 text-left transition-colors hover:bg-surface-hover"
                        onClick={() => handleSelectMember(member)}
                      >
                        <span className="min-w-0 text-[13px] font-medium text-text-1">
                          {member.displayName}
                        </span>
                        <span className="flex min-w-0 items-center gap-2 text-[12px] text-text-3">
                          <span>{member.identityKind}</span>
                          <span>·</span>
                          <span>{member.role}</span>
                          <MemberStatusPill
                            active={activeMemberIds.has(member.id)}
                            label={
                              activeMemberIds.has(member.id)
                                ? t("collaboration.status.activeToday")
                                : t("collaboration.status.idle")
                            }
                          />
                        </span>
                      </button>
                      {canRemoveMember ? (
                        <Button
                          htmlType="button"
                          size="mini"
                          variant="danger"
                          appearance="ghost"
                          disabled={Boolean(removingMemberId)}
                          loading={removingMemberId === member.id}
                          onClick={() => void handleRemoveMember(member)}
                        >
                          {t("collaboration.members.remove")}
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </SectionContainer>
          </>
        ) : null}

        {activeTab === COLLAB_ORG_TAB.SETTINGS ? (
          <SectionContainer color="chatPanelInfo" padding="default">
            <div className="flex flex-col gap-4">
              <div>
                <div className="text-[13px] font-semibold text-text-1">
                  {t("collaboration.access.title")}
                </div>
                <div className="mt-1 text-[12px] text-text-3">
                  {t("collaboration.access.description")}
                </div>
              </div>
              <div className="grid gap-2 @[720px]:grid-cols-3">
                {[
                  COLLAB_SESSION_ACCESS_MODE.OFF,
                  COLLAB_SESSION_ACCESS_MODE.METADATA_ONLY,
                  COLLAB_SESSION_ACCESS_MODE.FULL_REPLAY,
                ].map((accessMode) => (
                  <button
                    key={accessMode}
                    type="button"
                    className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                      currentAccessSettings?.accessMode === accessMode
                        ? "border-accent-6 bg-accent-2 text-text-1"
                        : "border-border-2 bg-bg-2 text-text-2 hover:bg-surface-hover"
                    }`}
                    onClick={() => handleSelectAccessMode(accessMode)}
                  >
                    <div className="text-[12px] font-semibold">
                      {t(`collaboration.access.modes.${accessMode}.title`)}
                    </div>
                    <div className="mt-1 text-[11px] text-text-3">
                      {t(
                        `collaboration.access.modes.${accessMode}.description`
                      )}
                    </div>
                  </button>
                ))}
              </div>
              <div>
                <div className="text-[12px] font-semibold text-text-1">
                  {t("collaboration.access.workspaces")}
                </div>
                <div className="mt-1 text-[12px] text-text-3">
                  {t("collaboration.access.workspacesHint")}
                </div>
                <div className="mt-3 flex flex-col divide-y divide-border-2 rounded-xl border border-border-2 bg-bg-2">
                  {workspaceOptions.length === 0 ? (
                    <div className="px-3 py-3 text-[12px] text-text-3">
                      {t("collaboration.access.noWorkspaces")}
                    </div>
                  ) : (
                    workspaceOptions.map((workspacePath) => {
                      const selected =
                        currentAccessSettings?.workspacePaths.includes(
                          workspacePath
                        ) ?? false;
                      return (
                        <label
                          key={workspacePath}
                          className="flex cursor-pointer items-center gap-3 px-3 py-2 text-[12px] text-text-2 hover:bg-surface-hover"
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() =>
                              handleToggleWorkspace(workspacePath)
                            }
                          />
                          <span
                            className="min-w-0 truncate"
                            title={workspacePath}
                          >
                            {workspacePath}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
              <div className="text-warning-7 rounded-lg bg-warning-1 px-3 py-2 text-[12px]">
                {t("collaboration.access.fullReplayWarning")}
              </div>
            </div>
          </SectionContainer>
        ) : null}

        {activeTab === COLLAB_ORG_TAB.CHAT ? (
          <SectionContainer color="chatPanelInfo" padding="default">
            <div className="flex min-h-[320px] flex-col gap-3">
              <div className="text-[12px] text-text-3">
                {t("collaboration.chat.hint")}
              </div>
              <div className="min-h-0 flex-1 overflow-auto rounded-lg bg-fill-1 p-3">
                {orgChatMessages.length === 0 ? (
                  <div className="flex h-full min-h-[160px] items-center justify-center text-[13px] text-text-3">
                    {t("collaboration.chat.empty")}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {orgChatMessages.map((message) => (
                      <div
                        key={message.id}
                        className="rounded-lg bg-bg-2 px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px] text-text-3">
                          <span className="font-medium text-text-2">
                            {message.authorDisplayName}
                          </span>
                          <span>{formatSessionDate(message.createdAt)}</span>
                        </div>
                        <div className="mt-1 whitespace-pre-wrap break-words text-[13px] text-text-1">
                          {message.body}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {chatError ? (
                <div className="text-[12px] text-danger-6">{chatError}</div>
              ) : null}
              {currentMember?.identityKind === COLLAB_IDENTITY_KIND.AGENT ? (
                <div className="text-[12px] text-text-3">
                  {t("collaboration.chat.humanOnly")}
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={draftMessage}
                    onChange={setDraftMessage}
                    placeholder={t("collaboration.chat.placeholder")}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void handleSendMessage();
                      }
                    }}
                  />
                  <Button
                    htmlType="button"
                    variant="primary"
                    disabled={!draftMessage.trim() || sending}
                    loading={sending}
                    onClick={() => void handleSendMessage()}
                  >
                    {t("collaboration.chat.send")}
                  </Button>
                </div>
              )}
            </div>
          </SectionContainer>
        ) : null}
      </div>
    </section>
  );

  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden"
      data-testid="chat-panel-collab-org-detail"
    >
      <DetailPanelContainer testId="collab-org-panel">
        <WorkItemContentStack
          descriptionContent={descriptionContent}
          descriptionFlexible
          scrollable
        />
      </DetailPanelContainer>
    </div>
  );
};

export default CollabOrgPanelView;
