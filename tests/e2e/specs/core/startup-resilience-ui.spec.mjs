/**
 * startup-resilience-ui.spec.mjs
 *
 * Rendered-UI proof for the startup-hardening work (decouple the splash from
 * React first paint, and surface an actionable error panel instead of an
 * infinite logo screen).
 *
 * The friend-report bug was: the static splash (#splash in public/index.html)
 * is removed only when React commits its first paint. If the bundle hangs, a
 * lazy chunk keeps failing, or a top-level module throws, that signal never
 * arrives and the user is stranded on the logo forever — the in-bundle 5s/10s
 * fallbacks never even register. The fix adds a self-contained, pre-bundle
 * watchdog in index.html that, on timeout, replaces the splash IN PLACE with a
 * panel carrying working Reload / Clear-data controls, plus a global
 * window.__ORGII_SHOW_STARTUP_ERROR__() the in-bundle circuit-breakers reuse.
 *
 * This spec drives the REAL booted webview (webpack dev server + debug binary),
 * so it exercises the production public/index.html watchdog renderer, not a
 * mock. It deliberately does NOT re-navigate via browser.url() (that races the
 * Tauri WebView's cold-boot window handle and flakes), and it does NOT dispatch
 * synthetic ChunkLoadErrors into the live handlers (below the cap they call
 * window.location.reload() and genuinely navigate the WebView away). The
 * chunk-reload counter arithmetic is covered deterministically by the unit
 * suite in src/util/core/init/chunkReload.test.ts (9 cases); here we prove the
 * one thing only a rendered app can: the splash→panel DOM contract.
 *
 * Two user-visible contracts:
 *   1. The booted app exposes the watchdog globals (it didn't hang).
 *   2. Invoking the production renderer replaces the splash with an actionable
 *      panel whose Reload / Clear-data buttons are present and labelled.
 */

const MOUNT_TIMEOUT_MS = 60_000;
const RENDER_TIMEOUT_MS = 15_000;

async function execJS(script, args = []) {
  return browser.executeScript(script, args);
}

async function waitForApp() {
  await browser.waitUntil(
    async () => {
      try {
        return await execJS(
          "return typeof window.__ORGII_SHOW_STARTUP_ERROR__ === 'function';"
        );
      } catch {
        return false;
      }
    },
    {
      timeout: MOUNT_TIMEOUT_MS,
      timeoutMsg: "watchdog globals never appeared — app failed to boot",
    }
  );
}

async function splashState() {
  return execJS(`
    var s = document.getElementById('splash');
    return {
      exists: !!s,
      display: s ? s.style.display : null,
      hasErrorPanel: !!document.getElementById('orgii-splash-reload'),
      hasClearBtn: !!document.getElementById('orgii-splash-clear'),
      text: s ? (s.textContent || '').slice(0, 160) : null,
    };
  `);
}

describe("Startup resilience (rendered UI)", () => {
  before(async function () {
    await waitForApp();
  });

  it("Case 1 — the booted app exposes the pre-bundle watchdog globals", async () => {
    // Proves the watchdog script ran and the app reached a live state. The
    // real splash has already been removed by first paint on a healthy boot;
    // what we assert here is the contract surface the watchdog/circuit-breakers
    // depend on: the done-signal and the renderer global both exist.
    const globals = await execJS(`
      return {
        showError: typeof window.__ORGII_SHOW_STARTUP_ERROR__,
        splashDone: typeof window.__ORGII_SPLASH_DONE__,
      };
    `);
    expect(globals.showError).toBe("function");
    expect(globals.splashDone).toBe("function");
  });

  it("Case 2 — the watchdog renderer replaces a stuck splash with an actionable panel", async () => {
    // Recreate a splash element (the booted app already removed the real one),
    // then invoke the PRODUCTION renderer with force=true to bypass the
    // post-first-paint `settled` guard. This exercises the exact DOM the 20s
    // timeout path produces, deterministically and without racing a reload.
    await execJS(`
      var old = document.getElementById('splash');
      if (old) old.remove();
      var s = document.createElement('div');
      s.id = 'splash';
      s.style.display = '';
      document.body.appendChild(s);
      window.__ORGII_SHOW_STARTUP_ERROR__(true);
    `);

    await browser.waitUntil(
      async () => {
        const s = await splashState();
        return s.hasErrorPanel && s.hasClearBtn;
      },
      {
        timeout: RENDER_TIMEOUT_MS,
        timeoutMsg: "startup-error panel never rendered into the splash",
      }
    );

    const s = await splashState();
    expect(s.hasErrorPanel).toBe(true); // Reload button present
    expect(s.hasClearBtn).toBe(true); // Clear-data button present
    expect(s.text.toLowerCase()).toContain("too long"); // actionable copy

    // Clicking Reload must clear the chunk-reload budget so a manual retry
    // gets a fresh set of attempts (pairs with the unit-tested reset path).
    await execJS("sessionStorage.setItem('orgii:chunk-reload-count', '2');");
    // The button's onclick clears the counter then reloads; we only assert the
    // counter-clearing side effect to avoid navigating the WebView away.
    const onclickClears = await execJS(`
      var btn = document.getElementById('orgii-splash-reload');
      if (!btn) return false;
      // Re-bind reload to a noop so the assertion doesn't navigate.
      try {
        Object.defineProperty(window.location, 'reload', {
          configurable: true, value: function () {},
        });
      } catch (e) {}
      btn.click();
      return sessionStorage.getItem('orgii:chunk-reload-count') === null;
    `);
    expect(onclickClears).toBe(true);

    // Cleanup: drop the synthetic splash so we leave no residue.
    await execJS(`
      var s = document.getElementById('splash');
      if (s) s.remove();
    `);
  });
});
