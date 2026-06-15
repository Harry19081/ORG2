import { UserRound, Users } from "lucide-react";

import type { NavigationMenuItem } from "@src/scaffold/NavigationSidebar/components/NavigationMenu/config";
import type {
  CollabMemberRecord,
  CollabOrgRecord,
  RemoteTeammateSessionMetadata,
} from "@src/store/collaboration/types";

export const COLLAB_ORG_SECTION_PREFIX = "colleagues-org-section:";
export const COLLAB_MEMBER_PREFIX = "colleagues-member:";
export const COLLAB_TEAMMATE_SESSION_PREFIX = "colleagues-teammate-session:";

function normalizeSearchValue(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function matchesSearchQuery(
  query: string,
  ...values: Array<string | undefined>
): boolean {
  if (!query) return true;
  return values.some((value) =>
    value ? normalizeSearchValue(value).includes(query) : false
  );
}

export function getCollabOrgMenuItemId(orgId: string): string {
  return `${COLLAB_ORG_SECTION_PREFIX}${orgId}`;
}

export function getCollabMemberMenuItemId(memberId: string): string {
  return `${COLLAB_MEMBER_PREFIX}${memberId}`;
}

export function getCollabTeammateSessionMenuItemId(sessionId: string): string {
  return `${COLLAB_TEAMMATE_SESSION_PREFIX}${sessionId}`;
}

export function getCollabTeammateSessionIdFromMenuItemId(
  itemId: string
): string | null {
  if (!itemId.startsWith(COLLAB_TEAMMATE_SESSION_PREFIX)) return null;
  return itemId.slice(COLLAB_TEAMMATE_SESSION_PREFIX.length) || null;
}

export function buildColleaguesSidebarMenuItems({
  orgs,
  members,
  remoteSessions,
  searchQuery,
  unknownOrgLabel,
}: {
  orgs: readonly CollabOrgRecord[];
  members: readonly CollabMemberRecord[];
  remoteSessions: readonly RemoteTeammateSessionMetadata[];
  searchQuery: string;
  unknownOrgLabel: string;
}): NavigationMenuItem[] {
  const normalizedQuery = normalizeSearchValue(searchQuery);
  const orgsById = new Map(orgs.map((org) => [org.id, org]));
  const sessionsByOrgId = new Map<string, RemoteTeammateSessionMetadata[]>();
  const membersByOrgId = new Map<string, CollabMemberRecord[]>();

  for (const member of members) {
    if (member.removedAt) continue;
    const orgMembers = membersByOrgId.get(member.orgId) ?? [];
    orgMembers.push(member);
    membersByOrgId.set(member.orgId, orgMembers);
  }

  for (const session of remoteSessions) {
    const orgSessions = sessionsByOrgId.get(session.orgId) ?? [];
    orgSessions.push(session);
    sessionsByOrgId.set(session.orgId, orgSessions);
  }

  const menuItems: NavigationMenuItem[] = [];

  for (const org of orgs) {
    const orgSessions = sessionsByOrgId.get(org.id) ?? [];
    const orgMembers = membersByOrgId.get(org.id) ?? [];
    const filteredMembers = orgMembers.filter((member) =>
      matchesSearchQuery(
        normalizedQuery,
        org.name,
        member.displayName,
        member.identityKind,
        member.role
      )
    );
    const filteredSessions = orgSessions.filter((session) =>
      matchesSearchQuery(
        normalizedQuery,
        org.name,
        session.title,
        session.ownerDisplayName,
        session.ownerIdentityKind,
        session.repoPath,
        session.branch,
        session.status
      )
    );

    if (
      normalizedQuery &&
      filteredMembers.length === 0 &&
      filteredSessions.length === 0 &&
      !matchesSearchQuery(normalizedQuery, org.name)
    ) {
      continue;
    }

    const children: NavigationMenuItem[] = filteredMembers.map((member) => ({
      id: getCollabMemberMenuItemId(member.id),
      key: getCollabMemberMenuItemId(member.id),
      label: member.displayName,
      searchText: [
        org.name,
        member.displayName,
        member.identityKind,
        member.role,
      ]
        .filter(Boolean)
        .join(" "),
      icon: UserRound,
      iconName: "user-round",
      shortcut: member.identityKind,
    }));

    children.push(
      ...filteredSessions.map((session) => ({
        id: getCollabTeammateSessionMenuItemId(session.id),
        key: getCollabTeammateSessionMenuItemId(session.id),
        label: session.title,
        searchText: [
          org.name,
          session.ownerDisplayName,
          session.ownerIdentityKind,
          session.repoPath,
          session.branch,
        ]
          .filter(Boolean)
          .join(" "),
        icon: Users,
        iconName: "users",
        shortcut: session.status
          ? `${session.ownerIdentityKind} · ${session.status}`
          : session.ownerIdentityKind,
      }))
    );

    menuItems.push({
      id: getCollabOrgMenuItemId(org.id),
      key: getCollabOrgMenuItemId(org.id),
      label: org.name,
      searchText: [org.name, ...orgMembers.map((member) => member.displayName)]
        .filter(Boolean)
        .join(" "),
      icon: Users,
      iconName: "users",
      children,
    });
  }

  if (menuItems.length > 0) {
    return menuItems;
  }

  const orphanSessions = remoteSessions.filter((session) => {
    if (orgsById.has(session.orgId)) return false;
    return matchesSearchQuery(
      normalizedQuery,
      session.title,
      session.ownerDisplayName,
      session.ownerIdentityKind,
      session.repoPath,
      session.branch,
      session.status
    );
  });

  if (orphanSessions.length === 0) {
    return menuItems;
  }

  menuItems.push({
    id: `${COLLAB_ORG_SECTION_PREFIX}unknown`,
    key: `${COLLAB_ORG_SECTION_PREFIX}unknown`,
    label: unknownOrgLabel,
  });

  for (const session of orphanSessions) {
    menuItems.push({
      id: getCollabTeammateSessionMenuItemId(session.id),
      key: getCollabTeammateSessionMenuItemId(session.id),
      label: session.title,
      searchText: [
        session.ownerDisplayName,
        session.ownerIdentityKind,
        session.repoPath,
        session.branch,
      ]
        .filter(Boolean)
        .join(" "),
      icon: Users,
      iconName: "users",
      shortcut: session.status
        ? `${session.ownerIdentityKind} · ${session.status}`
        : session.ownerIdentityKind,
    });
  }

  return menuItems;
}
