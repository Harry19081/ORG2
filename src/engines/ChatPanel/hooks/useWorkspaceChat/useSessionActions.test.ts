import { describe, expect, it, vi } from "vitest";

import type { SessionEvent } from "@src/engines/SessionCore/core/types";

import {
  hasSessionProducedOutput,
  resolveRestorableUserMessage,
} from "./useSessionActions";

vi.hoisted(() => {
  Object.defineProperty(globalThis.window, "matchMedia", {
    writable: true,
    value: () => ({ matches: false }),
  });
});

describe("resolveRestorableUserMessage", () => {
  it("preserves image attachments when restoring from a snapshot-backed user event", () => {
    const imageDataUrls = ["data:image/png;base64,one"];

    expect(
      resolveRestorableUserMessage({
        snapshotDisplayText: "please inspect this screenshot",
        snapshotImages: imageDataUrls,
        lastUserMessage: {
          displayContent: "please inspect this screenshot",
          imageDataUrls,
        },
      })
    ).toEqual({
      displayContent: "please inspect this screenshot",
      imageDataUrls,
    });
  });

  it("uses lastUserMessage images when older snapshot data omitted images", () => {
    const imageDataUrls = ["data:image/png;base64,restored"];

    expect(
      resolveRestorableUserMessage({
        snapshotDisplayText: "cancel me",
        lastUserMessage: {
          displayContent: "cancel me",
          imageDataUrls,
        },
      })
    ).toEqual({
      displayContent: "cancel me",
      imageDataUrls,
    });
  });

  it("does not attach stale images to a different snapshot message", () => {
    expect(
      resolveRestorableUserMessage({
        snapshotDisplayText: "newer message",
        lastUserMessage: {
          displayContent: "older message",
          imageDataUrls: ["data:image/png;base64,stale"],
        },
      })
    ).toEqual({
      displayContent: "newer message",
      imageDataUrls: undefined,
    });
  });

  it("falls back to pending synthetic event images when no snapshot exists", () => {
    const imageDataUrls = ["data:image/png;base64,pending"];

    expect(
      resolveRestorableUserMessage({
        pendingDisplayText: "pending message",
        pendingImages: imageDataUrls,
      })
    ).toEqual({
      displayContent: "pending message",
      imageDataUrls,
    });
  });
});

describe("hasSessionProducedOutput", () => {
  function event(overrides: Partial<SessionEvent>): SessionEvent {
    return {
      id: "event-1",
      sessionId: "session-1",
      source: "user",
      createdAt: new Date().toISOString(),
      actionType: "raw",
      functionName: "user_message",
      displayVariant: "message",
      ...overrides,
    } as SessionEvent;
  }

  it("returns false when the current session only has user input", () => {
    expect(
      hasSessionProducedOutput([event({ source: "user" })], "session-1")
    ).toBe(false);
  });

  it("returns true after assistant output exists in the current session", () => {
    expect(
      hasSessionProducedOutput(
        [event({ source: "user" }), event({ source: "assistant" })],
        "session-1"
      )
    ).toBe(true);
  });

  it("ignores output from other sessions", () => {
    expect(
      hasSessionProducedOutput(
        [
          event({ source: "assistant", sessionId: "other-session" }),
          event({ source: "user" }),
        ],
        "session-1"
      )
    ).toBe(false);
  });
});
