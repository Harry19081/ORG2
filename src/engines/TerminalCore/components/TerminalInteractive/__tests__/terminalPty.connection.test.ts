import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cleanupPtyListeners } from "../terminalLifecycle";
import { flushBacklog, unregisterPane } from "../terminalOutputScheduler";
import { paneMap } from "../terminalOutputSchedulerState";
import { initPtyConnection } from "../terminalPty";

const transport = vi.hoisted(() => ({
  invoke: vi.fn(),
  listen: vi.fn(),
  channel: vi.fn(),
}));
vi.mock("@src/util/platform/tauri/init", () => ({
  invokeTauri: transport.invoke,
  listenTauri: transport.listen,
  createTauriChannel: transport.channel,
  isTauriReady: () => true,
}));
vi.mock("../bufferCache", () => ({
  getTerminalBuffer: vi.fn(),
  deleteTerminalBuffer: vi.fn(),
}));
vi.mock("../terminalRenderSettle", () => ({
  writeWithRenderSettle: (
    terminal: { write: (text: unknown) => void },
    text: unknown
  ) => terminal.write(text),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((accept, fail) => {
    reject = fail;
    resolve = accept;
  });
  return { promise, resolve, reject };
}
const sessionId = "terminal-pty-owner-test";
let listeners: {
  name: string;
  callback: (event: { payload: unknown }) => void;
  unlisten: ReturnType<typeof vi.fn>;
}[];
let aborts: AbortController[];
const base = {
  output: "",
  covers_seq: 0,
  missed_output: true,
  pending_utf8_b64: "",
};
function start(shared?: ReturnType<typeof refs>) {
  const state = shared ?? refs();
  const abort = new AbortController();
  aborts.push(abort);
  const promise = initPtyConnection({
    ...state,
    cols: 80,
    rows: 24,
    sessionKey: "owner-test",
    isForeground: false,
    repoPathRef: { current: undefined },
    shellType: "default",
    setIsBrowserMode: vi.fn(),
    setIsConnecting: vi.fn(),
    abortSignal: abort.signal,
  } as unknown as Parameters<typeof initPtyConnection>[0]);
  return { ...state, abort, promise };
}
function refs() {
  return {
    terminalRef: {
      current: { write: vi.fn(), writeln: vi.fn(), focus: vi.fn() },
    },
    sessionIdRef: { current: null as string | null },
    unlistenOutputRef: { current: null as (() => void) | null },
    unlistenExitRef: { current: null as (() => void) | null },
  };
}
async function settle() {
  for (let i = 0; i < 12; i++) await Promise.resolve();
}
function output(bytes: number[], seq: number) {
  const listener = listeners
    .filter(
      (entry) =>
        entry.name.startsWith("pty-output") &&
        entry.unlisten.mock.calls.length === 0
    )
    .slice(-1)[0]!;
  listener.callback({
    payload: {
      b64: btoa(String.fromCharCode(...bytes)),
      byte_count: bytes.length,
      seq,
    },
  });
}
beforeEach(() => {
  listeners = [];
  aborts = [];
  transport.listen.mockImplementation((name, callback) => {
    const unlisten = vi.fn();
    listeners.push({ name, callback, unlisten });
    return Promise.resolve(unlisten);
  });
  transport.invoke.mockImplementation((name) =>
    Promise.resolve(name === "attach_pty_stream" ? base : undefined)
  );
  transport.channel.mockImplementation((callback) => ({ callback }));
});
afterEach(() => {
  for (const abort of aborts) abort.abort();
  unregisterPane(sessionId);
  vi.clearAllMocks();
});
describe("PTY connection ownership and stream restoration", () => {
  it("late output-listener registration cannot remove the remounted pane", async () => {
    const pending = deferred<() => void>();
    const oldUnlisten = vi.fn();
    transport.listen.mockImplementationOnce(() => pending.promise);
    const shared = refs();
    const old = start(shared);
    old.abort.abort();
    cleanupPtyListeners(shared);
    shared.terminalRef.current = {
      write: vi.fn(),
      writeln: vi.fn(),
      focus: vi.fn(),
    };
    const replacement = start(shared);
    await replacement.promise;
    const pane = paneMap.get(sessionId);
    pending.resolve(oldUnlisten);
    await old.promise;
    expect(paneMap.get(sessionId)).toBe(pane);
    expect(oldUnlisten).toHaveBeenCalledOnce();
    output([65], 0);
    flushBacklog(sessionId, 100);
    expect(replacement.terminalRef.current.write).toHaveBeenCalledWith("A");
  });
  it("late exit-listener registration cannot unsubscribe replacement listeners", async () => {
    const pending = deferred<() => void>();
    transport.listen
      .mockImplementationOnce((name, callback) => {
        const unlisten = vi.fn();
        listeners.push({ name, callback, unlisten });
        return Promise.resolve(unlisten);
      })
      .mockImplementationOnce(() => pending.promise);
    const shared = refs();
    const old = start(shared);
    await settle();
    old.abort.abort();
    cleanupPtyListeners(shared);
    shared.terminalRef.current = {
      write: vi.fn(),
      writeln: vi.fn(),
      focus: vi.fn(),
    };
    const replacement = start(shared);
    await replacement.promise;
    const replacementOutput = listeners
      .filter((entry) => entry.name.startsWith("pty-output"))
      .slice(-1)[0]!;
    pending.resolve(vi.fn());
    await old.promise;
    expect(replacementOutput.unlisten).not.toHaveBeenCalled();
    output([66], 0);
    flushBacklog(sessionId, 100);
    expect(shared.terminalRef.current.write).toHaveBeenCalledWith("B");
  });
  it("late restore finally cannot resume the replacement before its own snapshot", async () => {
    const oldAttach = deferred<typeof base>();
    const nextAttach = deferred<typeof base>();
    let count = 0;
    transport.invoke.mockImplementation((name) =>
      name === "attach_pty_stream"
        ? ++count === 1
          ? oldAttach.promise
          : nextAttach.promise
        : Promise.resolve()
    );
    const shared = refs();
    const old = start(shared);
    await settle();
    old.abort.abort();
    cleanupPtyListeners(shared);
    shared.terminalRef.current = {
      write: vi.fn(),
      writeln: vi.fn(),
      focus: vi.fn(),
    };
    const replacement = start(shared);
    await settle();
    const pane = paneMap.get(sessionId)!;
    expect(pane.suspended).toBe(true);
    oldAttach.resolve({ ...base, covers_seq: 500 });
    await old.promise;
    expect(paneMap.get(sessionId)).toBe(pane);
    expect(pane.suspended).toBe(true);
    nextAttach.resolve(base);
    await replacement.promise;
    expect(pane.suspended).toBe(false);
  });
  it("failed exit subscription releases its output listener and scheduler", async () => {
    transport.listen
      .mockImplementationOnce((name, callback) => {
        const unlisten = vi.fn();
        listeners.push({ name, callback, unlisten });
        return Promise.resolve(unlisten);
      })
      .mockRejectedValueOnce(new Error("subscription failed"));
    const connection = start();
    await connection.promise;
    expect(listeners[0]!.unlisten).toHaveBeenCalledOnce();
    expect(paneMap.has(sessionId)).toBe(false);
    expect(connection.terminalRef.current.writeln).toHaveBeenCalled();
  });
  it("late registration failure cannot write an error into the replacement", async () => {
    const pending = deferred<() => void>();
    transport.listen.mockImplementationOnce(() => pending.promise);
    const shared = refs();
    const old = start(shared);
    const replacement = start(shared);
    await replacement.promise;
    const pane = paneMap.get(sessionId);
    pending.reject(new Error("old subscription failed"));
    await old.promise;
    expect(shared.terminalRef.current.writeln).not.toHaveBeenCalled();
    expect(paneMap.get(sessionId)).toBe(pane);
  });
  it("restores half a codepoint and removes covered raw bytes before decoding", async () => {
    const pending = deferred<typeof base>();
    transport.invoke.mockImplementation((name) =>
      name === "attach_pty_stream" ? pending.promise : Promise.resolve()
    );
    const connection = start();
    await settle();
    output([0xe2, 0x94, 0x80], 0);
    pending.resolve({ ...base, covers_seq: 1, pending_utf8_b64: "4g==" });
    await connection.promise;
    flushBacklog(sessionId, 100);
    expect(
      connection.terminalRef.current.write.mock.calls
        .map(([text]) => text)
        .join("")
    ).toBe("─");
    expect(transport.invoke).toHaveBeenCalledWith(
      "attach_pty_output_channel",
      expect.objectContaining({ ownerId: expect.any(Number) })
    );
  });
  it("flushes queued final bytes before the exit banner when exit races restore", async () => {
    const pending = deferred<typeof base>();
    transport.invoke.mockImplementation((name) =>
      name === "attach_pty_stream" ? pending.promise : Promise.resolve()
    );
    const connection = start();
    await settle();
    output([90], 0);
    listeners
      .find((entry) => entry.name.startsWith("pty-exit"))!
      .callback({ payload: undefined });
    pending.resolve(base);
    await connection.promise;
    const text = connection.terminalRef.current.write.mock.calls
      .map(([value]) => value)
      .join("");
    expect(text.indexOf("Z")).toBeLessThan(text.indexOf("Session ended"));
    expect(text).toContain("Session ended");
    expect(paneMap.has(sessionId)).toBe(false);
  });
});
