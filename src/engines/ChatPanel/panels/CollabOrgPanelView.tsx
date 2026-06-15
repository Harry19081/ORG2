import { useAtom, useAtomValue, useSetAtom } from "jotai";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import Button from "@src/components/Button";
import Input from "@src/components/Input";
import TabPill from "@src/components/TabPill";
import {
  listCollabChatMessages,
  postCollabChatMessage,
} from "@src/features/TeamCollaboration/collabHubClient";
import { SectionContainer } from "@src/modules/shared/layouts/SectionLayout";
import { SessionTable } from "@src/modules/shared/layouts/blocks";
import type { SessionTableItem } from "@src/modules/shared/layouts/blocks";
import {
  collabChatMessagesAtom,
  collabConnectionStatesAtom,
  collabMembersAtom,
  collabOrgsAtom,
  remoteTeammateSessionsAtom,
} from "@src/store/collaboration/collabOrgsAtom";
import {
  COLLAB_CONNECTION_STATUS,
  COLLAB_IDENTITY_KIND,
} from "@src/store/collaboration/types";
import type {
  CollabChatMessageRecord,
  CollabMemberRecord,
  RemoteTeammateSessionMetadata,
} from "@src/store/collaboration/types";
import type { ChatPanelSelectedCollabOrg } from "@src/store/ui/chatPanelAtom";
import { chatPanelSelectedCollabOrgAtom } from "@src/store/ui/chatPanelAtom";
import { formatSmartDateTime } from "@src/util/data/formatters/date";

const COLLAB_ORG_TAB = {
  SESSIONS: "sessions",
  MEMBERS: "members",
  CHAT: "chat",
} as const;

type CollabOrgTab = (typeof COLLAB_ORG_TAB)[keyof typeof COLLAB_ORG_TAB];

const CHAT_HISTORY_LIMIT = 100;

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

function toSessionTableItem(
  session: RemoteTeammateSessionMetadata,
  fallbackStatusLabel: string
): SessionTableItem {
  return {
    id: session.id,
    title: session.title,
    description: session.ownerDisplayName,
    statusLabel: session.status ?? fallbackStatusLabel,
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

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-fill-1 px-3 py-2">
      <div className="text-[11px] text-text-3">{label}</div>
      <div className="mt-1 text-[16px] font-semibold text-text-1">{value}</div>
    </div>
  );
}

export const CollabOrgPanelView: React.FC<CollabOrgPanelViewProps> = ({
  selectedCollabOrg,
}) => {
  const { t } = useTranslation("navigation");
  const orgs = useAtomValue(collabOrgsAtom);
  const members = useAtomValue(collabMembersAtom);
  const connectionStates = useAtomValue(collabConnectionStatesAtom);
  const remoteSessions = useAtomValue(remoteTeammateSessionsAtom);
  const [chatMessages, setChatMessages] = useAtom(collabChatMessagesAtom);
  const setSelectedCollabOrg = useSetAtom(chatPanelSelectedCollabOrgAtom);
  const [activeTab, setActiveTab] = useState<CollabOrgTab>(
    selectedCollabOrg.memberId
      ? COLLAB_ORG_TAB.MEMBERS
      : COLLAB_ORG_TAB.SESSIONS
  );
  const [draftMessage, setDraftMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

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
    () => orgMembers.find((member) => member.accessToken),
    [orgMembers]
  );
  const connectionState = connectionStates.find(
    (state) => state.orgId === selectedCollabOrg.orgId
  );
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
        toSessionTableItem(session, t("collaboration.sessionStatusActive"))
      ),
    [visibleSessions, t]
  );
  const todaySessionCount = visibleSessions.filter((session) =>
    isToday(session.lastActivityAt)
  ).length;
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

  useEffect(() => {
    if (!org?.hubUrl || !currentMember?.accessToken) return;
    let cancelled = false;
    listCollabChatMessages({
      hubUrl: org.hubUrl,
      orgId: org.id,
      accessToken: currentMember.accessToken,
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
  }, [currentMember?.accessToken, org?.hubUrl, org?.id, setChatMessages]);

  const handleSendMessage = useCallback(async () => {
    const body = draftMessage.trim();
    if (!body || !org || sending) return;
    setSending(true);
    setChatError(null);
    try {
      if (org.hubUrl && currentMember?.accessToken) {
        const message = await postCollabChatMessage({
          hubUrl: org.hubUrl,
          orgId: org.id,
          accessToken: currentMember.accessToken,
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

  const handleSelectMember = useCallback(
    (member: CollabMemberRecord) => {
      setSelectedCollabOrg({ orgId: member.orgId, memberId: member.id });
      setActiveTab(COLLAB_ORG_TAB.MEMBERS);
    },
    [setSelectedCollabOrg]
  );

  const handleBackToOrg = useCallback(() => {
    setSelectedCollabOrg({ orgId: selectedCollabOrg.orgId });
    setActiveTab(COLLAB_ORG_TAB.SESSIONS);
  }, [selectedCollabOrg.orgId, setSelectedCollabOrg]);

  const tabs = useMemo(
    () => [
      { key: COLLAB_ORG_TAB.SESSIONS, label: t("collaboration.tabs.sessions") },
      { key: COLLAB_ORG_TAB.MEMBERS, label: t("collaboration.tabs.members") },
      { key: COLLAB_ORG_TAB.CHAT, label: t("collaboration.tabs.chat") },
    ],
    [t]
  );

  if (!org) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-[13px] text-text-3">
        {t("collaboration.orgNotFound")}
      </div>
    );
  }

  const title = selectedMember?.displayName ?? org.name;
  const connected =
    connectionState?.status === COLLAB_CONNECTION_STATUS.CONNECTED;
  const selectedMemberActive = selectedMember
    ? activeMemberIds.has(selectedMember.id)
    : connected;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-bg-1">
      <div className="shrink-0 border-b border-border-2 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-text-1">
              {title}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[12px] text-text-3">
              <span>
                {selectedMember ? org.name : t("collaboration.orgDemoTitle")}
              </span>
              <MemberStatusPill
                active={selectedMemberActive}
                label={
                  selectedMember
                    ? selectedMemberActive
                      ? t("collaboration.status.activeToday")
                      : t("collaboration.status.idle")
                    : connected
                      ? t("collaboration.status.connected")
                      : t("collaboration.status.offline")
                }
              />
            </div>
          </div>
          {selectedMember ? (
            <Button htmlType="button" size="small" onClick={handleBackToOrg}>
              {t("collaboration.backToOrg")}
            </Button>
          ) : null}
        </div>
        <div className="mt-3">
          <TabPill
            tabs={tabs}
            activeTab={activeTab}
            onChange={(tab) => setActiveTab(tab as CollabOrgTab)}
            variant="pill"
            size="small"
            fillWidth={false}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
        <div className="mx-auto flex w-full max-w-[900px] flex-col gap-3">
          <SectionContainer color="chatPanelInfo" padding="default">
            <div className="grid grid-cols-2 gap-2 @[720px]:grid-cols-4">
              <StatCard
                label={t("collaboration.stats.members")}
                value={orgMembers.length}
              />
              <StatCard
                label={t("collaboration.stats.sessionsToday")}
                value={todaySessionCount}
              />
              <StatCard
                label={t("collaboration.stats.totalSessions")}
                value={visibleSessions.length}
              />
              <StatCard
                label={t("collaboration.stats.activeToday")}
                value={
                  selectedMember
                    ? activeMemberIds.has(selectedMember.id)
                      ? 1
                      : 0
                    : activeMemberIds.size
                }
              />
            </div>
          </SectionContainer>

          {activeTab === COLLAB_ORG_TAB.SESSIONS ? (
            <SessionTable
              items={sessionItems}
              showSearch
              surfaceVariant="transparent"
              pageSize={10}
            />
          ) : null}

          {activeTab === COLLAB_ORG_TAB.MEMBERS ? (
            <SectionContainer color="chatPanelInfo" padding="default">
              <div className="flex flex-col divide-y divide-border-2">
                {orgMembers.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    className="flex w-full items-center justify-between gap-3 py-2 text-left transition-colors hover:bg-surface-hover"
                    onClick={() => handleSelectMember(member)}
                  >
                    <span className="min-w-0 px-3 text-[13px] font-medium text-text-1">
                      {member.displayName}
                    </span>
                    <span className="flex min-w-0 items-center gap-2 px-3 text-[12px] text-text-3">
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
                ))}
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
      </div>
    </div>
  );
};

export default CollabOrgPanelView;
