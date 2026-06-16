import { describe, expect, it } from "vitest";

import {
  COLLAB_MESSAGE_TYPE,
  COLLAB_PROTOCOL_VERSION,
  buildCollabInviteLink,
  createCollabAvatarIdentity,
  normalizeSupabaseProjectUrl,
  parseCollabInviteInput,
  parseCollabMessageEnvelope,
} from "./protocol";
import {
  COLLAB_IDENTITY_KIND,
  COLLAB_SESSION_ACCESS_MODE,
  COLLAB_WORKSPACE_SCOPE,
} from "./types";

describe("collaboration protocol helpers", () => {
  it("normalizes Supabase project URLs", () => {
    expect(
      normalizeSupabaseProjectUrl("https://team.supabase.co/path/?x=1#y")
    ).toBe("https://team.supabase.co/path");
  });

  it("builds and parses invite links", () => {
    const link = buildCollabInviteLink({
      supabaseUrl: "https://team.supabase.co/",
      anonKey: "anon-key",
      inviteCode: "invite-1",
    });

    expect(parseCollabInviteInput(link)).toEqual({
      syncBackend: "supabase",
      supabaseUrl: "https://team.supabase.co",
      anonKey: "anon-key",
      inviteCode: "invite-1",
    });
  });

  it("accepts raw invite codes", () => {
    expect(parseCollabInviteInput(" invite-2 ")).toEqual({
      inviteCode: "invite-2",
    });
  });

  it("creates deterministic lightweight avatar identities", () => {
    expect(createCollabAvatarIdentity("Ada Lovelace").initials).toBe("AL");
    expect(["v", "h"]).toContain(
      createCollabAvatarIdentity("Ada Lovelace").variant
    );
  });

  it("parses session access settings", () => {
    const parsed = parseCollabMessageEnvelope({
      protocolVersion: COLLAB_PROTOCOL_VERSION,
      id: "evt-session-1",
      orgId: "org-1",
      senderMemberId: "mem-1",
      sentAt: "2026-06-15T00:00:00.000Z",
      type: COLLAB_MESSAGE_TYPE.SESSION_METADATA_UPSERT,
      payload: {
        session: {
          id: "org-1:mem-1:session-1",
          orgId: "org-1",
          ownerMemberId: "mem-1",
          ownerUserId: "mem-1",
          ownerDisplayName: "Ada",
          ownerIdentityKind: COLLAB_IDENTITY_KIND.HUMAN,
          sourceSessionId: "session-1",
          title: "Fix issue",
          repoPath: "/repo",
          accessMode: COLLAB_SESSION_ACCESS_MODE.FULL_REPLAY,
        },
      },
    });

    expect(parsed.type).toBe(COLLAB_MESSAGE_TYPE.SESSION_METADATA_UPSERT);
    if (parsed.type !== COLLAB_MESSAGE_TYPE.SESSION_METADATA_UPSERT) {
      throw new Error("Expected session metadata upsert");
    }
    expect(parsed.payload.session.accessMode).toBe(
      COLLAB_SESSION_ACCESS_MODE.FULL_REPLAY
    );
  });

  it("parses session snapshot denial envelopes", () => {
    const parsed = parseCollabMessageEnvelope({
      protocolVersion: COLLAB_PROTOCOL_VERSION,
      id: "evt-denied-1",
      orgId: "org-1",
      senderMemberId: "mem-1",
      sentAt: "2026-06-15T00:00:00.000Z",
      type: COLLAB_MESSAGE_TYPE.SESSION_SNAPSHOT_DENIED,
      payload: {
        requestId: "request-1",
        sourceSessionId: "session-1",
        reason: "Session replay is not allowed by owner settings",
      },
    });

    expect(parsed.type).toBe(COLLAB_MESSAGE_TYPE.SESSION_SNAPSHOT_DENIED);
    if (parsed.type !== COLLAB_MESSAGE_TYPE.SESSION_SNAPSHOT_DENIED) {
      throw new Error("Expected session snapshot denial");
    }
    expect(parsed.payload.reason).toContain("not allowed");
  });

  it("parses session snapshot response envelopes", () => {
    const parsed = parseCollabMessageEnvelope({
      protocolVersion: COLLAB_PROTOCOL_VERSION,
      id: "evt-response-1",
      orgId: "org-1",
      senderMemberId: "mem-1",
      sentAt: "2026-06-15T00:00:00.000Z",
      type: COLLAB_MESSAGE_TYPE.SESSION_SNAPSHOT_RESPONSE,
      payload: {
        requestId: "request-1",
        sourceSessionId: "session-1",
        session: {
          id: "org-1:mem-1:session-1",
          orgId: "org-1",
          ownerMemberId: "mem-1",
          ownerUserId: "mem-1",
          ownerDisplayName: "Ada",
          ownerIdentityKind: COLLAB_IDENTITY_KIND.HUMAN,
          sourceSessionId: "session-1",
          title: "Fix issue",
          repoPath: "/repo",
          accessMode: COLLAB_SESSION_ACCESS_MODE.FULL_REPLAY,
        },
        events: [],
      },
    });

    expect(parsed.type).toBe(COLLAB_MESSAGE_TYPE.SESSION_SNAPSHOT_RESPONSE);
    if (parsed.type !== COLLAB_MESSAGE_TYPE.SESSION_SNAPSHOT_RESPONSE) {
      throw new Error("Expected session snapshot response");
    }
    expect(parsed.payload.events).toEqual([]);
  });

  it("uses the selected workspace scope constant", () => {
    expect(COLLAB_WORKSPACE_SCOPE.SELECTED_WORKSPACES).toBe(
      "selected_workspaces"
    );
  });

  it("parses group chat message envelopes", () => {
    const parsed = parseCollabMessageEnvelope({
      protocolVersion: COLLAB_PROTOCOL_VERSION,
      id: "evt-1",
      orgId: "org-1",
      senderMemberId: "mem-1",
      sentAt: "2026-06-15T00:00:00.000Z",
      type: COLLAB_MESSAGE_TYPE.CHAT_MESSAGE,
      payload: {
        message: {
          id: "msg-1",
          orgId: "org-1",
          authorMemberId: "mem-1",
          authorDisplayName: "Ada",
          authorIdentityKind: COLLAB_IDENTITY_KIND.HUMAN,
          body: "Sharing https://example.com",
          createdAt: "2026-06-15T00:00:00.000Z",
        },
      },
    });

    expect(parsed.type).toBe(COLLAB_MESSAGE_TYPE.CHAT_MESSAGE);
    if (parsed.type !== COLLAB_MESSAGE_TYPE.CHAT_MESSAGE) {
      throw new Error("Expected chat message");
    }
    expect(parsed.payload.message.body).toBe("Sharing https://example.com");
  });
});
