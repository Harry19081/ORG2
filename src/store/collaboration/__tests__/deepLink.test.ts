import { describe, expect, it } from "vitest";

import { isCollabJoinDeepLink, parseCollabJoinDeepLink } from "../deepLink";
import { buildCollabInviteLink } from "../protocol";

const HUB = "https://orgii-collab-hub.orgii.workers.dev";
const INVITE = "2poycTL4TJfAc_Zd7mbvmXv_9JtrFX-1";

describe("isCollabJoinDeepLink", () => {
  it("recognizes an orgii collaboration/join link", () => {
    expect(
      isCollabJoinDeepLink(
        `orgii://collaboration/join?hub=${encodeURIComponent(HUB)}&invite=${INVITE}`
      )
    ).toBe(true);
  });

  it("ignores trailing slashes and case in scheme", () => {
    expect(
      isCollabJoinDeepLink(`ORGII://collaboration/join/?invite=${INVITE}`)
    ).toBe(true);
  });

  it("rejects a non-collaboration orgii path", () => {
    expect(isCollabJoinDeepLink("orgii://marketplace/callback?code=abc")).toBe(
      false
    );
  });

  it("rejects a different orgii collaboration action", () => {
    expect(isCollabJoinDeepLink("orgii://collaboration/leave")).toBe(false);
  });

  it("does not match yorgai:// links", () => {
    expect(isCollabJoinDeepLink("yorgai://collaboration/join?invite=x")).toBe(
      false
    );
  });
});

describe("parseCollabJoinDeepLink", () => {
  it("parses a valid link with URL-encoded hub", () => {
    expect(
      parseCollabJoinDeepLink(
        `orgii://collaboration/join?hub=${encodeURIComponent(HUB)}&invite=${INVITE}`
      )
    ).toEqual({ hubUrl: HUB, inviteCode: INVITE });
  });

  it("decodes the hub built by buildCollabInviteLink round-trip", () => {
    const link = buildCollabInviteLink({ hubUrl: HUB, inviteCode: INVITE });
    expect(parseCollabJoinDeepLink(link)).toEqual({
      hubUrl: HUB,
      inviteCode: INVITE,
    });
  });

  it("allows a missing hub (user supplies it manually)", () => {
    expect(
      parseCollabJoinDeepLink(`orgii://collaboration/join?invite=${INVITE}`)
    ).toEqual({ hubUrl: undefined, inviteCode: INVITE });
  });

  it("returns null when the invite code is missing", () => {
    expect(
      parseCollabJoinDeepLink(
        `orgii://collaboration/join?hub=${encodeURIComponent(HUB)}`
      )
    ).toBeNull();
  });

  it("returns null for a non-collaboration orgii path", () => {
    expect(
      parseCollabJoinDeepLink("orgii://marketplace/callback?code=abc")
    ).toBeNull();
  });

  it("returns null for a yorgai:// OAuth callback (passthrough unaffected)", () => {
    expect(
      parseCollabJoinDeepLink("yorgai://marketplace/callback?code=abc")
    ).toBeNull();
  });

  it("returns null for a malformed link", () => {
    expect(parseCollabJoinDeepLink("orgii://")).toBeNull();
    expect(parseCollabJoinDeepLink("not a url")).toBeNull();
  });
});
