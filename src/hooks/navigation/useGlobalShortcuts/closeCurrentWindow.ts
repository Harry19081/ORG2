import { createLogger } from "@src/hooks/logger";

const logger = createLogger("WindowShortcuts");

/**
 * Close this document's native window. The main window's `CloseRequested`
 * handler hides it instead (every macOS build, release Windows/Linux), so the
 * app keeps running and the dock or tray brings it back; detached session and
 * station windows close for real.
 */
export async function closeCurrentWindow(): Promise<void> {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().close();
  } catch (error) {
    logger.error("failed to close window", error);
  }
}
