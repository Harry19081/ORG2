/* global describe, before, after, it, expect, browser */
import os from "node:os";
import path from "node:path";

import {
  execJS,
  invokeE2E,
  unwrap,
  waitForApp,
} from "../../support/core/session/agentQueuedFollowupDriver.mjs";

const RUN_ID = Date.now();
const SESSION_ID = `sdeagent-e2e-plan-preview-auto-open-${RUN_ID}`;
const PLAN_TITLE = `PlanPreviewAutoOpen${RUN_ID}`;
const PLAN_PATH = path.join(
  os.tmpdir(),
  `orgii-e2e-plan-preview-auto-open-${RUN_ID}.plan.md`
);

async function readPreviewUiState() {
  return execJS(`
    const previewTab = document.querySelector('[data-testid="replay-tab-preview"]');
    const previewSurface = document.querySelector('[data-testid="communication-plan-doc-surface"]');
    const planDocPanel = document.querySelector('[data-testid="plan-doc-panel"]');
    const previewToggle = document.querySelector('[data-testid="communication-plan-doc-surface"] [role="tablist"]');
    return {
      previewTabActive: previewTab?.getAttribute('aria-selected') === 'true',
      previewTabText: previewTab?.textContent || '',
      previewSurfaceVisible: !!previewSurface,
      planDocPanelVisible: !!planDocPanel,
      planDocText: planDocPanel?.textContent || '',
      previewToggleText: previewToggle?.textContent || '',
    };
  `);
}

describe("Plan ready auto-opens Preview tab", () => {
  before(async () => {
    await waitForApp();
    unwrap(
      await invokeE2E("debugSeedPendingPlanWire", {
        sessionId: SESSION_ID,
        planPath: PLAN_PATH,
        planTitle: PLAN_TITLE,
        planContent: `# ${PLAN_TITLE}\n\nAuto-open preview when ready.`,
      }),
      "seed pending plan"
    );
  });

  after(async () => {
    await invokeE2E("deleteSessionWire", SESSION_ID);
  });

  it("switches Communication to Preview as soon as the plan becomes ready", async () => {
    await browser.waitUntil(
      async () => {
        const ui = await readPreviewUiState();
        return (
          ui.previewTabActive &&
          ui.previewSurfaceVisible &&
          ui.planDocPanelVisible &&
          ui.planDocText.includes(PLAN_TITLE)
        );
      },
      {
        timeout: 15_000,
        interval: 250,
        timeoutMsg: `preview tab never auto-opened; ui=${JSON.stringify(
          await readPreviewUiState()
        )}`,
      }
    );

    const ui = await readPreviewUiState();
    expect(ui.previewTabActive).toBe(true);
    expect(ui.previewSurfaceVisible).toBe(true);
    expect(ui.planDocPanelVisible).toBe(true);
    expect(ui.planDocText).toContain(PLAN_TITLE);
    expect(ui.previewToggleText.toLowerCase()).toContain("preview");
  });
});
