/* global describe, before, after, it, browser */
/**
 * diff-tab-content-live.spec.mjs
 *
 * LIVE-LLM coverage for the orgtrack final-diff → Diff-tab content render
 * path. The seeded spec (diff-tab-content-render.spec.mjs) proves
 * `finalDiffToSection` parses a `diff`-only record into a non-blank panel,
 * but it writes the backend record via the debug wire. This spec closes the
 * integration gap: a REAL agent turn edits a file in the repo, the orgtrack
 * extraction/backfill worker consolidates the change into a real
 * SessionFinalDiffRecord, and the Diff app must render the agent's actual
 * edited content (sentinel line) — no debug-seed anywhere.
 *
 * Per feedback_live_test_auto_behaviors: backend-authoritative data paths
 * (here: the orgtrack consolidation worker that feeds the Diff tab) need a
 * real-provider live spec, not just unit tests + seeded fixtures.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  configureScenario,
  execJS,
  filteredConfigs,
  invokeE2E,
  listAccounts,
  rustAgentConfigs,
  scenarioConfigs,
  stopActiveTurnIfNeeded,
  typeAndClickSend,
  unwrap,
  waitForApp,
  waitForChatLaunched,
} from "../../support/core/session/agentQueuedFollowupDriver.mjs";

const RUN_ID = Date.now();
const CHAT_INPUT = '[data-testid="chat-input"] [contenteditable="true"]';
const LIVE_TIMEOUT_MS = 300_000;
const DIFF_RENDER_TIMEOUT_MS = 120_000;

// Unique sentinel the agent must write; asserted in the rendered diff panel.
const SENTINEL = `DIFF_LIVE_SENTINEL_${RUN_ID}`;
const TARGET_FILE = `diff-live-${RUN_ID}.ts`;

async function diffPanelSnapshot() {
  return execJS(`
    const replay = document.querySelector('.session-replay-diff');
    return {
      hasReplayShell: !!replay,
      replayText: replay ? (replay.innerText || '') : '',
      bodyTail: (document.body.innerText || '').slice(-1500),
    };
  `);
}

describe("Diff tab content live (real agent edit → orgtrack final-diff)", () => {
  let config = null;
  let repoPath = null;

  before(async function () {
    await waitForApp();
    const accounts = await listAccounts();
    const rustConfigs = rustAgentConfigs(
      filteredConfigs(scenarioConfigs(accounts))
    );
    if (rustConfigs.length === 0) {
      this.skip();
      return;
    }
    config =
      rustConfigs.find((row) => row.label === "claude-code-rust-agent") ??
      rustConfigs[0];
    repoPath = process.env.E2E_REPO_PATH;
    if (!repoPath) throw new Error("E2E_REPO_PATH missing");
  });

  after(async () => {
    await stopActiveTurnIfNeeded("diff-tab-content-live-cleanup");
  });

  it("renders the agent's real edited content in the Diff tab", async function () {
    await configureScenario(config, { agentExecMode: "build" });

    const prompt = [
      `Create a new file named ${TARGET_FILE} in the repository root`,
      `(${repoPath}). The file must contain exactly this single line of`,
      `TypeScript: export const marker = "${SENTINEL}";`,
      `Use your edit_file / file-write tool to create it, then stop.`,
    ].join(" ");

    await typeAndClickSend(CHAT_INPUT, prompt);
    await waitForChatLaunched(prompt);

    // 1. Backend truth: the real agent turn wrote the file to disk. Only a
    //    live tool call could produce it (no seed path touches the fs).
    await browser.waitUntil(
      async () => existsSync(join(repoPath, TARGET_FILE)),
      {
        timeout: LIVE_TIMEOUT_MS,
        interval: 2_000,
        timeoutMsg: async () =>
          `agent never created ${TARGET_FILE}; tail=${JSON.stringify(
            (await diffPanelSnapshot()).bodyTail
          )}`,
      }
    );

    // 2. Open the Diff app (same atoms as the product "View in Agent
    //    station" / files-pill click path).
    await browser.waitUntil(
      async () => (await invokeE2E("openAgentStationDiff")).ok === true,
      {
        timeout: 30_000,
        interval: 1_000,
        timeoutMsg: "openAgentStationDiff never succeeded",
      }
    );

    await browser.waitUntil(
      async () => (await diffPanelSnapshot()).hasReplayShell,
      {
        timeout: 30_000,
        interval: 500,
        timeoutMsg: "Diff replay shell never mounted",
      }
    );

    // 3. The Diff tab must render the agent's REAL edited content. This is
    //    the orgtrack final-diff path: the extraction/backfill worker
    //    consolidated the live edit into a SessionFinalDiffRecord, and
    //    finalDiffToSection rendered it. Before the fix a diff-only record
    //    produced a blank panel; here the sentinel must be visible.
    await browser.waitUntil(
      async () => {
        const snap = await diffPanelSnapshot();
        return snap.replayText.includes(SENTINEL);
      },
      {
        timeout: DIFF_RENDER_TIMEOUT_MS,
        interval: 2_000,
        timeoutMsg: async () =>
          `live diff content never rendered the sentinel; snapshot=${JSON.stringify(
            await diffPanelSnapshot()
          )}`,
      }
    );
  });
});
