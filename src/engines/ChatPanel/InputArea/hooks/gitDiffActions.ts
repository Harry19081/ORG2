/**
 * gitDiffActions
 *
 * Pure (React-free) logic backing `useGitDiffActions`. Kept separate so the
 * orchestration — re-entrancy guard, busy/no-session skipping, and the
 * agent-prompt dispatch sequence — is unit-testable without rendering hooks.
 */

const SYSTEM_GENERATED_GIT_ACTION_LANGUAGE_INSTRUCTION =
  " This is a system-generated Git action request. Continue using the user's language from the earlier conversation rounds.";

/** Prompt sent to the agent for a plain "commit" action. */
export const GIT_DIFF_COMMIT_PROMPT =
  "Commit all current changes." +
  SYSTEM_GENERATED_GIT_ACTION_LANGUAGE_INSTRUCTION;

/** Prompt sent to the agent for a "commit & push" action. */
export const GIT_DIFF_COMMIT_PUSH_PROMPT =
  "Commit all current changes and push to the remote." +
  SYSTEM_GENERATED_GIT_ACTION_LANGUAGE_INSTRUCTION;

/** Prompt sent to the agent for a plain "push" action. */
export const GIT_DIFF_PUSH_PROMPT =
  "Push the latest commits to the remote." +
  SYSTEM_GENERATED_GIT_ACTION_LANGUAGE_INSTRUCTION;

/** Prompt sent to the agent for a "create PR" action. */
export const GIT_DIFF_CREATE_PR_PROMPT =
  "Create a pull request for the current branch. Unless the user specifies otherwise, include only the files you have worked on." +
  SYSTEM_GENERATED_GIT_ACTION_LANGUAGE_INSTRUCTION;

/** A mutable single-slot guard, structurally compatible with a React ref. */
export interface MutableGuard {
  current: boolean;
}

/**
 * The agent-driven git actions (commit / commit & push / push) require an
 * idle session to run, so they are disabled while a turn is in flight or when
 * there is no session.
 */
export function computeGitActionsDisabled(opts: {
  isSessionActive: boolean;
  sessionId?: string | null;
}): boolean {
  return opts.isSessionActive || !opts.sessionId;
}

export interface RunAgentGitActionDeps {
  sessionId?: string | null;
  isSessionActive: boolean;
  /** Re-entrancy guard shared across invocations (a React ref in the hook). */
  guard: MutableGuard;
  prompt: string;
  mintTurnIntentId: () => string;
  addUserMessage: (
    content: string,
    imageDataUrls: string[] | undefined,
    turnIntentId: string
  ) => Promise<void>;
  dispatchMessage: (
    sessionId: string,
    prompt: string,
    turnIntentId: string
  ) => Promise<void>;
  setRunning: (sessionId: string) => void;
  onError?: (err: unknown) => void;
}

/**
 * Sends an agent prompt that performs a git action.
 *
 * Returns `true` when the prompt was dispatched, `false` when skipped
 * (no session, session busy, or a prior action still pending).
 */
export async function runAgentGitAction(
  deps: RunAgentGitActionDeps
): Promise<boolean> {
  const { sessionId, isSessionActive, guard, prompt } = deps;
  if (!sessionId || isSessionActive || guard.current) return false;

  guard.current = true;
  deps.setRunning(sessionId);
  try {
    const turnIntentId = deps.mintTurnIntentId();
    await deps.addUserMessage(prompt, undefined, turnIntentId);
    await deps.dispatchMessage(sessionId, prompt, turnIntentId);
    return true;
  } catch (err) {
    deps.onError?.(err);
    return false;
  } finally {
    guard.current = false;
  }
}
