import { describe, expect, it } from "vitest";

import { isCollabJoinDeepLink, parseCollabJoinDeepLink } from "../deepLink";
import { buildCollabInviteLink } from "../protocol";

const SUPABASE_URL = "https://team-project.supabase.co";
const ANON_KEY = "anon-public-key";
const INVITE = "2poycTL4TJfAc_Zd7mbvmXv_9JtrFX-1";

describe("isCollabJoinDeepLink", () => {
  it("recognizes an orgii collaboration/join link", () => {
    expect(
      isCollabJoinDeepLink(
        `orgii://collaboration/join?sync=supabase&supabase=${encodeURIComponent(SUPABASE_URL)}&invite=${INVITE}`
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
  it("parses a valid link with URL-encoded Supabase project", () => {
    expect(
      parseCollabJoinDeepLink(
        `orgii://collaboration/join?sync=supabase&supabase=${encodeURIComponent(SUPABASE_URL)}&anon=${encodeURIComponent(ANON_KEY)}&invite=${INVITE}`
      )
    ).toEqual({
      supabaseUrl: SUPABASE_URL,
      anonKey: ANON_KEY,
      inviteCode: INVITE,
    });
  });

  it("decodes the Supabase URL built by buildCollabInviteLink round-trip", () => {
    const link = buildCollabInviteLink({
      supabaseUrl: SUPABASE_URL,
      anonKey: ANON_KEY,
      inviteCode: INVITE,
    });
    expect(parseCollabJoinDeepLink(link)).toEqual({
      supabaseUrl: SUPABASE_URL,
      anonKey: ANON_KEY,
      inviteCode: INVITE,
    });
  });

  it("allows a missing Supabase URL (user supplies it manually)", () => {
    expect(
      parseCollabJoinDeepLink(`orgii://collaboration/join?invite=${INVITE}`)
    ).toEqual({
      supabaseUrl: undefined,
      anonKey: undefined,
      inviteCode: INVITE,
    });
  });

  it("returns null when the invite code is missing", () => {
    expect(
      parseCollabJoinDeepLink(
        `orgii://collaboration/join?supabase=${encodeURIComponent(SUPABASE_URL)}`
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
