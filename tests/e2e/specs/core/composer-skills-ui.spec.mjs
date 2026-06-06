import {
  invokeE2E,
  unwrap,
  waitForApp,
} from "../../support/core/session/agentQueuedFollowupDriver.mjs";

const WORKSTATION_CODE_PATH = "/orgii/workstation/code";

const INPUT_SELECTOR = '[data-testid="chat-input"] [contenteditable="true"]';
const PREFIX = `ORGII_SKILL_PREFIX_${Date.now()}`;

async function execJS(script) {
  return browser.executeScript(script, []);
}

const js = {
  type: (selector, text) => `
    const editor = document.querySelector(${JSON.stringify(selector)});
    if (!editor) return "missing";
    editor.focus();
    const ok = document.execCommand("insertText", false, ${JSON.stringify(text)});
    return ok ? "typed" : "insert-failed";
  `,
  text: (selector) => `
    const editor = document.querySelector(${JSON.stringify(selector)});
    return editor ? (editor.textContent || "") : null;
  `,
  click: (selector) => `
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return "missing";
    element.click();
    return "clicked";
  `,
  setSlashSearch: (query) => `
    const input = document.querySelector('[data-slash-search-input="true"]');
    if (!input) return "missing";
    input.focus();
    input.value = ${JSON.stringify(query)};
    input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: ${JSON.stringify(query)} }));
    return "typed";
  `,
  clickSkill: (name) => `
    const row = document.querySelector(
      '[data-testid="slash-command-item"][data-slash-category="skill"][data-slash-name="' + CSS.escape(${JSON.stringify(name)}) + '"]'
    );
    if (!row) return "missing";
    const target = row.firstElementChild || row;
    target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
    target.click();
    return "clicked";
  `,
};

describe("Composer skills menu", () => {
  before(async () => {
    await waitForApp();
    unwrap(await invokeE2E("navigateTo", WORKSTATION_CODE_PATH), "navigateTo workstation code");
    unwrap(await invokeE2E("resetToNewSession"), "resetToNewSession");
  });

  it("preserves existing text when selecting a skill from the + menu search", async () => {
    await browser.waitUntil(async () => execJS(`return !!document.querySelector(${JSON.stringify(INPUT_SELECTOR)});`), {
      timeout: 60_000,
      timeoutMsg: "chat input never mounted",
    });

    expect(await execJS(js.type(INPUT_SELECTOR, PREFIX))).toBe("typed");
    expect(await execJS(js.click('[data-testid="composer-skills-tools-button"]'))).toBe("clicked");

    await browser.waitUntil(async () => execJS(`return !!document.querySelector('[data-slash-search-input="true"]');`), {
      timeout: 10_000,
      timeoutMsg: "slash command search input never mounted",
    });

    expect(await execJS(js.setSlashSearch("manage-skills"))).toBe("typed");

    await browser.waitUntil(
      async () =>
        execJS(
          `return !!document.querySelector('[data-testid="slash-command-item"][data-slash-category="skill"][data-slash-name="manage-skills"]');`
        ),
      {
        timeout: 10_000,
        timeoutMsg: "manage-skills row never appeared",
      }
    );

    expect(await execJS(js.clickSkill("manage-skills"))).toBe("clicked");

    await browser.waitUntil(
      async () => {
        const text = await execJS(js.text(INPUT_SELECTOR));
        return typeof text === "string" && text.includes(PREFIX) && text.includes("manage-skills");
      },
      {
        timeout: 10_000,
        timeoutMsg: `composer did not preserve prefix and append skill; text=${JSON.stringify(await execJS(js.text(INPUT_SELECTOR)))}`,
      }
    );
  });
});
