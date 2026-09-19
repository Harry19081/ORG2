import { describe, expect, it } from "vitest";

import {
  ACCOUNT_SETUP_METHOD_METADATA_KEY,
  codexReconnectSetupMethod,
  withRecordedSetupMethod,
} from "./accountSetupMethod";

describe("codexReconnectSetupMethod", () => {
  it("reopens the method the account was added with", () => {
    expect(
      codexReconnectSetupMethod({
        accountMetadata: { [ACCOUNT_SETUP_METHOD_METADATA_KEY]: "autodetect" },
      })
    ).toBe("autodetect");
    expect(
      codexReconnectSetupMethod({
        accountMetadata: { [ACCOUNT_SETUP_METHOD_METADATA_KEY]: "enter_token" },
      })
    ).toBe("enter_token");
  });

  it("falls back to sign-in for accounts saved before the method was recorded", () => {
    expect(codexReconnectSetupMethod(undefined)).toBe("signin");
    expect(codexReconnectSetupMethod({})).toBe("signin");
    expect(
      codexReconnectSetupMethod({ accountMetadata: { email: "a@b.c" } })
    ).toBe("signin");
  });

  it("ignores a recorded method Codex does not offer", () => {
    expect(
      codexReconnectSetupMethod({
        accountMetadata: { [ACCOUNT_SETUP_METHOD_METADATA_KEY]: "guided" },
      })
    ).toBe("signin");
  });
});

describe("withRecordedSetupMethod", () => {
  it("adds the chosen method to the detected account metadata", () => {
    expect(
      withRecordedSetupMethod({ email: "a@b.c" }, "autodetect", "signin")
    ).toEqual({
      email: "a@b.c",
      [ACCOUNT_SETUP_METHOD_METADATA_KEY]: "autodetect",
    });
  });

  it("records the step's default when the selector was never touched", () => {
    expect(withRecordedSetupMethod(undefined, undefined, "signin")).toEqual({
      [ACCOUNT_SETUP_METHOD_METADATA_KEY]: "signin",
    });
  });

  it("leaves metadata alone when no method is known", () => {
    expect(withRecordedSetupMethod(undefined, undefined, undefined)).toBe(
      undefined
    );
    expect(withRecordedSetupMethod({}, undefined, undefined)).toBe(undefined);
    expect(
      withRecordedSetupMethod({ email: "a@b.c" }, undefined, undefined)
    ).toEqual({ email: "a@b.c" });
  });
});
