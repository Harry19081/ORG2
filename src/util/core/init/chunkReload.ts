/**
 * Chunk-reload circuit-breaker
 *
 * A failed lazy chunk (corrupt asset, broken cache, offline) used to trigger an
 * UNBOUNDED `window.location.reload()`. If the chunk kept failing the app
 * reloaded forever, resetting every splash timer and stranding the user on the
 * logo screen. This module bounds those reloads with a sessionStorage counter.
 *
 * After RELOAD_CAP attempts we stop reloading and surface the inline
 * startup-error panel (exposed by public/index.html as
 * `window.__ORGII_SHOW_STARTUP_ERROR__`) instead of looping silently.
 *
 * `resetChunkReloadCount()` is called once React commits its first paint
 * (see useFirstPaintSignal) so a later transient chunk failure still gets a
 * full set of retries.
 */

const RELOAD_COUNT_KEY = "orgii:chunk-reload-count";
const RELOAD_CAP = 2;

type StartupErrorFn = () => void;

/**
 * Reload the page to recover from a failed chunk, but never more than
 * RELOAD_CAP times in a row. On giving up, render an actionable panel.
 *
 * @param onGiveUp Fallback to show when the reload budget is exhausted and the
 *                 inline `window.__ORGII_SHOW_STARTUP_ERROR__` panel is absent.
 */
export function reloadForChunkError(onGiveUp?: StartupErrorFn): void {
  let count = 0;
  try {
    count = parseInt(sessionStorage.getItem(RELOAD_COUNT_KEY) || "0", 10) || 0;
  } catch {
    count = 0;
  }

  if (count >= RELOAD_CAP) {
    const showStartupError = (
      window as unknown as { __ORGII_SHOW_STARTUP_ERROR__?: StartupErrorFn }
    ).__ORGII_SHOW_STARTUP_ERROR__;
    if (typeof showStartupError === "function") {
      showStartupError();
    } else if (onGiveUp) {
      onGiveUp();
    }
    return;
  }

  try {
    sessionStorage.setItem(RELOAD_COUNT_KEY, String(count + 1));
  } catch {
    // sessionStorage unavailable — fall through and still attempt one reload
  }
  window.location.reload();
}

/**
 * Reset the reload retry budget. Called once the app is confirmed alive so
 * future transient chunk failures get a fresh set of retries.
 */
export function resetChunkReloadCount(): void {
  try {
    sessionStorage.removeItem(RELOAD_COUNT_KEY);
  } catch {
    // ignore
  }
}
