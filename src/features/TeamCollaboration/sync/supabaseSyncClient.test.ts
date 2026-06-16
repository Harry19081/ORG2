import { afterEach, describe, expect, it, vi } from "vitest";

import { COLLAB_IDENTITY_KIND } from "@src/store/collaboration/types";

import { ORGII_SUPABASE_SETUP_SQL } from "./supabaseSetupSql";
import { supabaseSyncClient } from "./supabaseSyncClient";

const SUPABASE_URL = "https://team.supabase.co";
const ANON_KEY = "anon-key";

function mockJsonResponse(payload: unknown, ok = true): Response {
  return new Response(JSON.stringify(payload), {
    status: ok ? 200 : 400,
    headers: { "content-type": "application/json" },
  });
}

describe("Supabase sync setup SQL", () => {
  it("declares required RPC functions and snapshot bucket", () => {
    expect(ORGII_SUPABASE_SETUP_SQL).toContain("orgii_sync_version");
    expect(ORGII_SUPABASE_SETUP_SQL).toContain("orgii_create_org");
    expect(ORGII_SUPABASE_SETUP_SQL).toContain("orgii_upsert_project");
    expect(ORGII_SUPABASE_SETUP_SQL).toContain("orgii_upsert_work_item");
    expect(ORGII_SUPABASE_SETUP_SQL).toContain("orgii_upsert_session_metadata");
    expect(ORGII_SUPABASE_SETUP_SQL).toContain("orgii-session-snapshots");
  });
});

describe("supabaseSyncClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("verifies setup through the version RPC", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockJsonResponse(1));

    await expect(
      supabaseSyncClient.verifySetup({
        supabaseUrl: SUPABASE_URL,
        anonKey: ANON_KEY,
      })
    ).resolves.toEqual({ ok: true, schemaVersion: 1, missing: [] });

    expect(fetchMock).toHaveBeenCalledWith(
      `${SUPABASE_URL}/rest/v1/rpc/orgii_sync_version`,
      expect.objectContaining({ method: "POST" })
    );
  });

  it("builds create org RPC requests with local Supabase profile fields", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockJsonResponse({
        org: {
          id: "org-1",
          name: "Team Alpha",
          syncBackend: "supabase",
          supabaseUrl: SUPABASE_URL,
          supabaseAnonKey: ANON_KEY,
          orgSecret: "secret-1",
          createdAt: "2026-06-16T00:00:00.000Z",
        },
        member: {
          id: "member-1",
          orgId: "org-1",
          displayName: "Ada",
          avatar: { initials: "A", variant: "v" },
          role: "admin",
          identityKind: "human",
          joinedAt: "2026-06-16T00:00:00.000Z",
        },
      })
    );

    await supabaseSyncClient.createOrg({
      supabaseUrl: `${SUPABASE_URL}/`,
      anonKey: ANON_KEY,
      orgSecret: "secret-1",
      name: "Team Alpha",
      displayName: "Ada",
      identityKind: COLLAB_IDENTITY_KIND.HUMAN,
    });

    const body = JSON.parse(
      String((fetchMock.mock.calls[0]?.[1] as RequestInit).body)
    ) as Record<string, unknown>;
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `${SUPABASE_URL}/rest/v1/rpc/orgii_create_org`
    );
    expect(body.org_name).toBe("Team Alpha");
    expect(body.payload).toMatchObject({
      syncBackend: "supabase",
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: ANON_KEY,
      orgSecret: "secret-1",
    });
  });
});
