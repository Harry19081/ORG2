import { describe, expect, it } from "vitest";

import {
  COLLAB_MESSAGE_TYPE,
  COLLAB_PROTOCOL_VERSION,
  buildCollabInviteLink,
  createCollabAvatarIdentity,
  normalizeCollabHubUrl,
  parseCollabInviteInput,
  parseCollabMessageEnvelope,
  toCollabWebSocketUrl,
} from "./protocol";
import { COLLAB_IDENTITY_KIND } from "./types";

describe("collaboration protocol helpers", () => {
  it("normalizes hub URLs", () => {
    expect(
      normalizeCollabHubUrl("https://team.example.workers.dev/path/?x=1#y")
    ).toBe("https://team.example.workers.dev/path");
  });

  it("builds and parses invite links", () => {
    const link = buildCollabInviteLink({
      hubUrl: "https://team.example.workers.dev/",
      inviteCode: "invite-1",
    });

    expect(parseCollabInviteInput(link)).toEqual({
      hubUrl: "https://team.example.workers.dev",
      inviteCode: "invite-1",
    });
  });

  it("accepts raw invite codes", () => {
    expect(parseCollabInviteInput(" invite-2 ")).toEqual({
      inviteCode: "invite-2",
    });
  });

  it("converts HTTP hub URL to WebSocket room URL", () => {
    expect(
      toCollabWebSocketUrl("https://team.example.workers.dev", "org-1")
    ).toBe("wss://team.example.workers.dev/orgs/org-1/ws");
  });

  it("creates deterministic lightweight avatar identities", () => {
    expect(createCollabAvatarIdentity("Ada Lovelace").initials).toBe("AL");
    expect(["v", "h"]).toContain(
      createCollabAvatarIdentity("Ada Lovelace").variant
    );
  });

  it("parses group chat message envelopes", () => {
    expect(
      parseCollabMessageEnvelope({
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
      }).payload.message.body
    ).toBe("Sharing https://example.com");
  });
});
