// @vitest-environment jsdom
import React, { act, createElement } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ClaudeProviderProfile,
  HarnessConnectionView,
} from "@src/api/tauri/rpc/schemas/agentOrgs";

import ClaudeProfileEditor from "./ClaudeProfileEditor";
import { newClaudeProfile } from "./useClaudeProfileEditor";
import { refreshHarnessConnections } from "./useHarnessConnection";

const mocks = vi.hoisted(() => ({
  status: vi.fn(),
  saveProfile: vi.fn(),
  deleteProfile: vi.fn(),
  fetchModels: vi.fn(),
  test: vi.fn(),
  apply: vi.fn(),
  cancelTest: vi.fn(),
  restore: vi.fn(),
}));
vi.mock("@src/api/tauri/rpc", () => ({
  rpc: {
    agentOrgs: {
      connections: mocks,
      managedConfig: { restoreDefault: mocks.restore },
    },
  },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
// Native controls keep user events observable; the production form and controller run unchanged.
vi.mock("@src/components/Select", () => ({
  default: ({
    ariaLabel,
    options,
    value,
    disabled,
    onChange,
  }: {
    ariaLabel: string;
    options: { value: string; label: string; disabled?: boolean }[];
    value: string;
    disabled: boolean;
    onChange: (v: string) => void;
  }) =>
    createElement(
      "select",
      {
        "aria-label": ariaLabel,
        value,
        disabled,
        onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
          onChange(e.target.value),
      },
      options.map((o) =>
        createElement(
          "option",
          { key: o.value, value: o.value, disabled: o.disabled },
          o.label
        )
      )
    ),
}));
let container: HTMLDivElement;
let root: Root;
let view: HarnessConnectionView;
function maybeButton(label: string) {
  return [...container.querySelectorAll("button")].find(
    (b) => b.textContent === label
  );
}
function button(label: string) {
  const found = [...container.querySelectorAll("button")].find(
    (b) => b.textContent === label
  );
  if (!found) throw new Error(`Missing button ${label}`);
  return found;
}
async function click(label: string) {
  await act(async () => button(label).click());
}
async function input(label: string, value: string) {
  const element = container.querySelector<HTMLInputElement>(
    `input[aria-label="${label}"]`
  )!;
  expect(element).not.toBeNull();
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )!.set!.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function mount(
  target: ClaudeProviderProfile["target"] = "claude_code",
  profileId: string | null = null
) {
  await act(async () =>
    root.render(createElement(ClaudeProfileEditor, { target, profileId }))
  );
}
// With no profileId the editor opens a new draft on mount; saving is the only
// step left. The list that chooses a profile lives in AppConnectionPage.
async function createAndSave() {
  await click("claudeProfiles.save");
}
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  view = {
    installed: true,
    profiles: [],
    appliedProfile: null,
    config: {
      agentName: "claude_code",
      supported: true,
      mode: "default",
      hasDefaultBackup: false,
      conflict: false,
      selectedKeyId: null,
      selectedModel: null,
      selectedProvider: null,
      proxyUrl: null,
      message: null,
      targetFiles: [],
    },
    choices: [
      {
        keyId: "key",
        name: "Gateway",
        models: ["vendor/model"],
        endpoint: "https://gateway.example",
        requiresTest: true,
        reason: null,
      },
    ],
  };
  mocks.status.mockImplementation(async () => structuredClone(view));
  mocks.saveProfile.mockImplementation(
    async ({ profile }: { profile: ClaudeProviderProfile }) => {
      const saved = { ...profile, revision: profile.revision + 1 };
      view.profiles = [saved];
      return saved;
    }
  );
  mocks.test.mockResolvedValue("receipt");
  mocks.apply.mockImplementation(async () => view.config);
  mocks.cancelTest.mockResolvedValue(undefined);
  mocks.fetchModels.mockResolvedValue(["custom/manual"]);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  refreshHarnessConnections();
});

describe("ClaudeProfileEditor", () => {
  it("renders mapping rows and saves without applying, then requires tests for activation", async () => {
    await mount();
    expect(
      container.querySelector(
        'input[aria-label="Subagent claudeProfiles.requestModel"]'
      )
    ).not.toBeNull();
    await input("Opus claudeProfiles.requestModel", "vendor/opus");
    await input("Opus claudeProfiles.displayName", "Visible Opus");
    // Nothing is saved yet, so there is nothing to test or apply.
    expect(maybeButton("harnessConnections.apply")).toBeUndefined();
    await click("claudeProfiles.save");
    expect(mocks.apply).not.toHaveBeenCalled();
    expect(
      mocks.saveProfile.mock.calls[0][0].profile.models.roles.opus
    ).toEqual({
      model: "vendor/opus",
      displayName: "Visible Opus",
      context1m: false,
    });
    await click("claudeProfiles.test");
    expect(button("harnessConnections.apply").disabled).toBe(false);
    await click("harnessConnections.apply");
    expect(mocks.apply.mock.calls[0][0]).toMatchObject({
      agentName: "claude_code",
      receipt: "receipt",
      routing: "direct",
      profile: { revision: 1 },
    });
  });
  it("invalidates test evidence for endpoint and role changes", async () => {
    await mount();
    await createAndSave();
    await click("claudeProfiles.test");
    await input("harnessConnections.endpoint", "https://another.example");
    expect(button("harnessConnections.apply").disabled).toBe(true);
    await click("claudeProfiles.save");
    await click("claudeProfiles.test");
    await input("Sonnet claudeProfiles.displayName", "Changed label");
    expect(button("harnessConnections.apply").disabled).toBe(true);
  });
  it("uses one model for all roles and keeps Subagent labels absent", async () => {
    await mount();
    await input("Sonnet claudeProfiles.requestModel", "one-model");
    await click("claudeProfiles.useOne");
    await click("claudeProfiles.save");
    const roles = mocks.saveProfile.mock.calls[0][0].profile.models.roles;
    for (const role of ["sonnet", "opus", "fable", "haiku", "subagent"])
      expect(roles[role].model).toBe("one-model");
    expect(roles.subagent.displayName).toBe("");
  });
  it("omits unsupported Desktop subagent controls and sends a separate target", async () => {
    await mount("claude_desktop");
    await createAndSave();
    expect(
      container.querySelector(
        'input[aria-label="Subagent claudeProfiles.requestModel"]'
      )
    ).toBeNull();
    expect(mocks.saveProfile.mock.calls[0][0].profile.target).toBe(
      "claude_desktop"
    );
  });
  it("keeps manual model entry usable when discovery fails", async () => {
    mocks.fetchModels.mockRejectedValue(new Error("Discovery unavailable"));
    await mount();
    await click("claudeProfiles.fetchModels");
    expect(container.textContent).toContain("Discovery unavailable");
    await input("Sonnet claudeProfiles.requestModel", "manual/model");
    await click("claudeProfiles.save");
    expect(
      mocks.saveProfile.mock.calls[0][0].profile.models.roles.sonnet.model
    ).toBe("manual/model");
  });
  it("cancels on unmount and ignores late test completion", async () => {
    let complete!: (v: string) => void;
    mocks.test.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          complete = resolve;
        })
    );
    await mount();
    await createAndSave();
    await click("claudeProfiles.test");
    await act(async () => root.render(null));
    expect(mocks.cancelTest).toHaveBeenCalledWith({
      requestId: mocks.test.mock.calls[0][0].requestId,
    });
    await act(async () => complete("late-receipt"));
    expect(mocks.apply).not.toHaveBeenCalled();
  });
  it("loads the connection the list selected into the form", async () => {
    const saved = {
      ...newClaudeProfile("claude_code", "Profile", view),
      revision: 1,
    };
    view.profiles = [saved];
    view.config.mode = "direct";
    await mount("claude_code", saved.id);
    expect(
      container.querySelector<HTMLInputElement>(
        'input[aria-label="claudeProfiles.name"]'
      )?.value
    ).toBe("Profile");
  });
  it("copies an existing connection without activating it", async () => {
    const source = {
      ...newClaudeProfile("claude_code", "Profile", view),
      revision: 1,
    };
    view.profiles = [source];
    view.config.mode = "direct";
    view.config.selectedKeyId = "key";
    view.config.selectedModel = "old-model";
    // Copy acts on a saved connection, so the list has to be on one.
    await mount("claude_code", source.id);
    await click("claudeProfiles.copy");
    expect(
      container.querySelector<HTMLInputElement>(
        'input[aria-label="Sonnet claudeProfiles.requestModel"]'
      )?.value
    ).toBe("old-model");
    expect(mocks.apply).not.toHaveBeenCalled();
    expect(mocks.saveProfile).not.toHaveBeenCalled();
  });
});
