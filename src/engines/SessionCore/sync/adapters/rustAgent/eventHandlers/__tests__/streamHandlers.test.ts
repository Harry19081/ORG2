import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionEvent } from "@src/engines/SessionCore/core/types";

import { dispatchAgentEvent } from "..";
import {
  cancelPendingLiveStreamWrites,
  handleMessageDelta,
  handleStreamingComplete,
  handleThinkingDelta,
} from "../streamHandlers";
import {
  clearSessionStreamingStopped,
  markSessionStreamingStopped,
} from "../streamHelpers";
import type { EventHandlerContext } from "../types";

const { upsertSpy, replaceAndRemoveSpy, removeByIdPrefixSpy } = vi.hoisted(
  () => ({
    upsertSpy: vi.fn().mockResolvedValue(undefined),
    replaceAndRemoveSpy: vi.fn().mockResolvedValue(true),
    removeByIdPrefixSpy: vi.fn().mockResolvedValue(1),
  })
);

vi.mock("@src/engines/SessionCore/core/store/EventStoreProxy", () => ({
  eventStoreProxy: {
    upsert: upsertSpy,
    replaceAndRemove: replaceAndRemoveSpy,
    removeByIdPrefix: removeByIdPrefixSpy,
  },
}));

function ref<T>(value: T): { current: T } {
  return { current: value };
}

async function flushLiveUpserts(): Promise<void> {
  await vi.runOnlyPendingTimersAsync();
}

function createCtx(): EventHandlerContext {
  return {
    filterSessionIdRef: ref("session-1"),
    assistantStreamRef: ref({ idRef: ref(""), contentRef: ref("") }),
    thinkingStreamRef: ref({ idRef: ref(""), contentRef: ref("") }),
    inlineThinkingIdRef: ref(""),
    execOutputBufferRef: ref(""),
    streamingInfoRef: ref({
      isStreaming: false,
      isThinking: false,
      content: "",
    }),
    onStreamingDeltaRef: ref(vi.fn()),
    onAgentCompleteRef: ref(undefined),
    onStatusChangeRef: ref(vi.fn()),
    onQuestionRequestRef: ref(undefined),
    setStreaming: vi.fn(),
    features: {},
    getDefaultStore: () => null,
  };
}

function makeMessageCompleteEvent(): SessionEvent {
  return {
    id: "stream-msg-session-1-1-final",
    chunk_id: null,
    sessionId: "session-1",
    createdAt: "2026-05-22T07:02:25.900Z",
    functionName: "assistant_message",
    uiCanonical: "assistant_message",
    actionType: "assistant",
    args: {},
    result: {
      content: "Done.",
    },
    source: "assistant",
    displayText: "Done.",
    displayStatus: "completed",
    displayVariant: "message",
    activityStatus: "agent",
  };
}

function makeThinkingCompleteEvent(): SessionEvent {
  return {
    id: "stream-think-session-1-1-final",
    chunk_id: null,
    sessionId: "session-1",
    createdAt: "2026-05-22T07:02:25.900Z",
    functionName: "thinking",
    uiCanonical: "thinking",
    actionType: "llm_thinking",
    args: {},
    result: {
      content: "The user wants a simple plan in Chinese.",
      thought: "The user wants a simple plan in Chinese.",
    },
    source: "assistant",
    displayText: "The user wants a simple plan in Chinese.",
    displayStatus: "completed",
    displayVariant: "thinking",
    activityStatus: "agent",
  };
}

describe("Rust Agent stream handlers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    clearSessionStreamingStopped("session-1");
    cancelPendingLiveStreamWrites("session-1");
  });

  afterEach(() => {
    cancelPendingLiveStreamWrites("session-1");
    vi.useRealTimers();
  });

  it("drops stopped-turn live stream events without poisoning the next turn", async () => {
    const ctx = createCtx();

    await dispatchAgentEvent(
      {
        type: "agent:message_delta",
        sessionId: "session-1",
        turnId: "turn-a",
        content: "before stop",
      },
      ctx
    );
    await flushLiveUpserts();
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    vi.clearAllMocks();

    markSessionStreamingStopped("session-1");

    await dispatchAgentEvent(
      {
        type: "agent:message_delta",
        sessionId: "session-1",
        turnId: "turn-a",
        content: "late",
      },
      ctx
    );
    await dispatchAgentEvent(
      {
        type: "agent:thinking_delta",
        sessionId: "session-1",
        turnId: "turn-a",
        content: "late",
      },
      ctx
    );
    await dispatchAgentEvent(
      {
        type: "agent:tool_call_delta",
        sessionId: "session-1",
        turnId: "turn-a",
        toolCallId: "call-1",
        tool: "edit_file",
        argumentsDelta: "{}",
      },
      ctx
    );
    await dispatchAgentEvent(
      {
        type: "agent:streaming_complete",
        sessionId: "session-1",
        turnId: "turn-a",
        streamType: "message",
        event: makeMessageCompleteEvent(),
      },
      ctx
    );

    await flushLiveUpserts();
    expect(upsertSpy).not.toHaveBeenCalled();
    expect(replaceAndRemoveSpy).not.toHaveBeenCalled();
    expect(ctx.setStreaming).not.toHaveBeenCalled();
    expect(ctx.onStatusChangeRef.current).not.toHaveBeenCalledWith("running");

    clearSessionStreamingStopped("session-1");
    await dispatchAgentEvent(
      {
        type: "agent:message_delta",
        sessionId: "session-1",
        turnId: "turn-b",
        content: "new turn",
      },
      ctx
    );

    await flushLiveUpserts();
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    expect(ctx.setStreaming).toHaveBeenCalledWith(true);
  });

  it("upserts message deltas as coalesced live EventStore events", async () => {
    const ctx = createCtx();

    handleMessageDelta(
      { type: "agent:message_delta", content: "Hello" },
      "session-1",
      ctx
    );

    expect(ctx.assistantStreamRef?.current.contentRef.current).toBe("Hello");
    expect(ctx.assistantStreamRef?.current.idRef.current).toMatch(
      /^stream-msg-live-session-1-/
    );
    expect(ctx.onStreamingDeltaRef?.current).toHaveBeenCalledWith({
      isStreaming: true,
      isThinking: false,
      content: "Hello",
    });
    expect(upsertSpy).not.toHaveBeenCalled();
    await flushLiveUpserts();
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: ctx.assistantStreamRef?.current.idRef.current,
        functionName: "assistant_message",
        actionType: "assistant",
        result: { observation: "Hello" },
        displayStatus: "running",
        displayVariant: "message",
        isDelta: true,
      }),
      "session-1"
    );
    expect(replaceAndRemoveSpy).not.toHaveBeenCalled();
  });

  it("normalizes cumulative message delta snapshots without duplicating prefixes", async () => {
    const ctx = createCtx();

    handleMessageDelta(
      { type: "agent:message_delta", content: "Hello" },
      "session-1",
      ctx
    );
    handleMessageDelta(
      { type: "agent:message_delta", content: "Hello world" },
      "session-1",
      ctx
    );

    expect(ctx.assistantStreamRef?.current.contentRef.current).toBe(
      "Hello world"
    );
    expect(ctx.onStreamingDeltaRef?.current).toHaveBeenLastCalledWith({
      isStreaming: true,
      isThinking: false,
      content: "Hello world",
    });
    expect(upsertSpy).not.toHaveBeenCalled();
    await flushLiveUpserts();
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    expect(upsertSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        result: { observation: "Hello world" },
        displayText: "Hello world",
      }),
      "session-1"
    );
  });

  it("drops pending coalesced live writes when stop happens before flush", async () => {
    const ctx = createCtx();

    for (let idx = 0; idx < 100; idx += 1) {
      handleMessageDelta(
        {
          type: "agent:message_delta",
          sessionId: "session-1",
          turnId: "turn-flood",
          content: `token-${idx} `,
        },
        "session-1",
        ctx
      );
    }

    expect(upsertSpy).not.toHaveBeenCalled();
    markSessionStreamingStopped("session-1");
    cancelPendingLiveStreamWrites("session-1");
    await flushLiveUpserts();

    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it("removes live message placeholder on backend-authoritative completion", async () => {
    const ctx = createCtx();
    handleMessageDelta(
      { type: "agent:message_delta", content: "Hello" },
      "session-1",
      ctx
    );
    const liveMessageId = ctx.assistantStreamRef?.current.idRef.current ?? null;
    const completeEvent = makeMessageCompleteEvent();

    await handleStreamingComplete(
      {
        type: "agent:streaming_complete",
        streamType: "message",
        event: completeEvent,
      },
      "session-1",
      ctx
    );

    expect(ctx.assistantStreamRef?.current.idRef.current).toBe("");
    expect(ctx.assistantStreamRef?.current.contentRef.current).toBe("");
    expect(ctx.setStreaming).toHaveBeenCalledWith(false);
    expect(ctx.onStatusChangeRef.current).toHaveBeenCalledWith("completed");
    expect(replaceAndRemoveSpy).not.toHaveBeenCalled();
    expect(removeByIdPrefixSpy).toHaveBeenCalledWith(
      liveMessageId,
      "session-1"
    );
  });

  it("upserts thinking deltas as coalesced live EventStore events", async () => {
    const ctx = createCtx();

    handleThinkingDelta(
      { type: "agent:thinking_delta", content: "Thinking" },
      "session-1",
      ctx
    );

    expect(ctx.thinkingStreamRef?.current.contentRef.current).toBe("Thinking");
    expect(ctx.thinkingStreamRef?.current.idRef.current).toMatch(
      /^stream-think-live-session-1-/
    );
    expect(ctx.onStreamingDeltaRef?.current).toHaveBeenCalledWith({
      isStreaming: true,
      isThinking: true,
      content: "Thinking",
    });
    expect(upsertSpy).not.toHaveBeenCalled();
    await flushLiveUpserts();
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: ctx.thinkingStreamRef?.current.idRef.current,
        functionName: "thinking",
        actionType: "llm_thinking_delta",
        result: { observation: "Thinking" },
        displayStatus: "running",
        displayVariant: "thinking",
        isDelta: true,
      }),
      "session-1"
    );
    expect(replaceAndRemoveSpy).not.toHaveBeenCalled();
  });

  it("normalizes cumulative thinking delta snapshots without duplicating prefixes", async () => {
    const ctx = createCtx();

    handleThinkingDelta(
      { type: "agent:thinking_delta", content: "Thinking" },
      "session-1",
      ctx
    );
    handleThinkingDelta(
      { type: "agent:thinking_delta", content: "Thinking through it" },
      "session-1",
      ctx
    );

    expect(ctx.thinkingStreamRef?.current.contentRef.current).toBe(
      "Thinking through it"
    );
    expect(ctx.onStreamingDeltaRef?.current).toHaveBeenLastCalledWith({
      isStreaming: true,
      isThinking: true,
      content: "Thinking through it",
    });
    expect(upsertSpy).not.toHaveBeenCalled();
    await flushLiveUpserts();
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    expect(upsertSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        result: { observation: "Thinking through it" },
        displayText: "Thinking through it",
      }),
      "session-1"
    );
  });

  it("removes live thinking placeholder on backend-authoritative completion", async () => {
    const ctx = createCtx();
    handleThinkingDelta(
      { type: "agent:thinking_delta", content: "Thinking" },
      "session-1",
      ctx
    );
    const liveThinkingId = ctx.thinkingStreamRef?.current.idRef.current ?? null;
    const completeEvent = makeThinkingCompleteEvent();

    await handleStreamingComplete(
      {
        type: "agent:streaming_complete",
        streamType: "thinking",
        event: completeEvent,
      },
      "session-1",
      ctx
    );

    expect(ctx.thinkingStreamRef?.current.idRef.current).toBe("");
    expect(ctx.thinkingStreamRef?.current.contentRef.current).toBe("");
    expect(ctx.onStreamingDeltaRef?.current).toHaveBeenLastCalledWith({
      isStreaming: false,
      isThinking: false,
      content: "",
    });
    await flushLiveUpserts();
    expect(upsertSpy).not.toHaveBeenCalled();
    expect(replaceAndRemoveSpy).not.toHaveBeenCalled();
    expect(removeByIdPrefixSpy).toHaveBeenCalledWith(
      liveThinkingId,
      "session-1"
    );
  });
});
