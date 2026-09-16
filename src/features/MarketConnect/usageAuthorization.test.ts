// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import type { MarketExecutionProfile } from "./marketProfiles";
import { activateManagedService } from "./rpc";
import {
  authorizedProfile,
  USAGE_AUTHORIZATION_EVENT,
  type UsagePrompt,
} from "./usageAuthorization";

vi.mock("./rpc", () => ({ activateManagedService: vi.fn() }));
const access = {
  access_id: "pa_example",
  service_id: "pkg_example",
  workspace_id: "ws_example",
  status: "active" as const,
  budget_usd6: 1_000_000,
  revision: 1,
};
const profile = (): MarketExecutionProfile => ({
  id: "market:example",
  label: "Example package",
  connection: {
    identity_user_id: "11111111-1111-4111-8111-111111111111",
    workspace_id: "ws_connection",
    target: "org2",
  },
  entitlementWorkspaceId: "ws_connection",
  entitlementId: "pkg_example",
  serviceId: "pkg_example",
  modelsByAgent: {
    claude_code: ["example-messages"],
    codex: ["example-responses"],
  },
  expiresAt: null,
  managed: {
    service_id: "pkg_example",
    title: "Example package",
    version_id: "pv_example",
    requires_confirmation: true,
    access: null,
    models: [
      {
        model: "example-messages",
        protocol: "anthropic_messages",
        clients: ["org2", "claude_code"],
        pricing: {},
        availability: "available",
      },
      {
        model: "example-responses",
        protocol: "openai_responses",
        clients: ["org2", "codex"],
        pricing: {},
        availability: "available",
      },
    ],
  },
});
afterEach(() => {
  vi.clearAllMocks();
});

it("confirms all included models once and reuses the same access when switching models", async () => {
  const selected = profile();
  const prompts: UsagePrompt[] = [];
  const confirm = (event: Event) => {
    const prompt = (event as CustomEvent<UsagePrompt>).detail;
    prompts.push(prompt);
    prompt.resolve(1_000_000);
  };
  window.addEventListener(USAGE_AUTHORIZATION_EVENT, confirm);
  vi.mocked(activateManagedService).mockResolvedValue(access);
  try {
    const enabled = await authorizedProfile(selected, "example-messages");
    expect(prompts).toHaveLength(1);
    expect(prompts[0]?.service.models.map((m) => m.model)).toEqual([
      "example-messages",
      "example-responses",
    ]);
    expect(prompts[0]).not.toHaveProperty("model");
    expect(activateManagedService).toHaveBeenCalledExactlyOnceWith(
      selected.connection,
      selected.managed,
      1_000_000,
    );
    const switched = await authorizedProfile(enabled, "example-responses");
    expect(switched).toBe(enabled);
    expect(switched.entitlementId).toBe(access.access_id);
    expect(prompts).toHaveLength(1);
    expect(activateManagedService).toHaveBeenCalledTimes(1);
  } finally {
    window.removeEventListener(USAGE_AUTHORIZATION_EVENT, confirm);
  }
});

it("cancelling a package confirmation grants access to none of its models", async () => {
  const selected = profile();
  selected.managed!.access = access;
  const cancel = (event: Event) =>
    (event as CustomEvent<UsagePrompt>).detail.resolve(null);
  window.addEventListener(USAGE_AUTHORIZATION_EVENT, cancel);
  try {
    for (const model of selected.managed!.models) {
      await expect(authorizedProfile(selected, model.model)).rejects.toThrow(
        "usage_authorization_cancelled",
      );
    }
    expect(activateManagedService).not.toHaveBeenCalled();
  } finally {
    window.removeEventListener(USAGE_AUTHORIZATION_EVENT, cancel);
  }
});

it("keeps availability a call constraint rather than a per-model activation", async () => {
  const enabled = profile();
  enabled.managed!.access = access;
  enabled.managed!.requires_confirmation = false;
  enabled.managed!.models[1]!.availability = "temporarily_unavailable";
  await expect(authorizedProfile(enabled, "example-responses")).rejects.toThrow(
    "model_temporarily_unavailable",
  );
  await expect(authorizedProfile(enabled, "example-messages")).resolves.toBe(
    enabled,
  );
  expect(activateManagedService).not.toHaveBeenCalled();
});
