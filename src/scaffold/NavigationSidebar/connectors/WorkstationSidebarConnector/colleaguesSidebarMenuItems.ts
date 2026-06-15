import { LayoutDashboard, UserRound, Users } from "lucide-react";

import type { NavigationMenuItem } from "@src/scaffold/NavigationSidebar/components/NavigationMenu/config";
import type {
  CollabMemberRecord,
  CollabOrgRecord,
  RemoteTeammateSessionMetadata,
} from "@src/store/collaboration/types";

export const COLLAB_ORG_SECTION_PREFIX = "separator-colleagues-org-section:";
export const COLLAB_ORG_DASHBOARD_PREFIX = "colleagues-org-dashboard:";
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

export function getCollabOrgDashboardMenuItemId(orgId: string): string {
  return `${COLLAB_ORG_DASHBOARD_PREFIX}${orgId}`;
}

export function getCollabOrgIdFromDashboardMenuItemId(
  itemId: string
): string | null {
  if (!itemId.startsWith(COLLAB_ORG_DASHBOARD_PREFIX)) return null;
  return itemId.slice(COLLAB_ORG_DASHBOARD_PREFIX.length) || null;
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
  dashboardLabel,
  unknownOrgLabel,
}: {
  orgs: readonly CollabOrgRecord[];
  members: readonly CollabMemberRecord[];
  remoteSessions: readonly RemoteTeammateSessionMetadata[];
  searchQuery: string;
  dashboardLabel: string;
  unknownOrgLabel: string;
}): NavigationMenuItem[] {
  const normalizedQuery = normalizeSearchValue(searchQuery);
  const orgsById = new Map(orgs.map((org) => [org.id, org]));
  const membersByOrgId = new Map<string, CollabMemberRecord[]>();

  for (const member of members) {
    if (member.removedAt) continue;
    const orgMembers = membersByOrgId.get(member.orgId) ?? [];
    orgMembers.push(member);
    membersByOrgId.set(member.orgId, orgMembers);
  }

  const menuItems: NavigationMenuItem[] = [];

  for (const org of orgs) {
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

    if (
      normalizedQuery &&
      filteredMembers.length === 0 &&
      !matchesSearchQuery(normalizedQuery, org.name, dashboardLabel)
    ) {
      continue;
    }

    menuItems.push({
      id: getCollabOrgMenuItemId(org.id),
      key: getCollabOrgMenuItemId(org.id),
      label: org.name,
      searchText: [org.name, ...orgMembers.map((member) => member.displayName)]
        .filter(Boolean)
        .join(" "),
    });

    menuItems.push({
      id: getCollabOrgDashboardMenuItemId(org.id),
      key: getCollabOrgDashboardMenuItemId(org.id),
      label: dashboardLabel,
      searchText: [org.name, dashboardLabel].filter(Boolean).join(" "),
      icon: LayoutDashboard,
      iconName: "layout-dashboard",
    });

    menuItems.push(
      ...filteredMembers.map((member) => ({
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
      }))
    );
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
