//! Live PTY session handle: I/O endpoints, flow-control counters, and the
//! shell-termination guarantees enforced on drop.

use chrono::{DateTime, Utc};
use portable_pty::{Child, PtyPair};
use std::sync::{
    atomic::{AtomicBool, AtomicU32, AtomicU64, AtomicUsize},
    Arc, Mutex,
};
use tauri::async_runtime::Mutex as AsyncMutex;
use tauri::ipc::{Channel, InvokeResponseBody};
use tokio::sync::{broadcast, Notify};

use crate::pty_commands::shells::ShellKind;

// ============================================
// Session State
// ============================================

/// Represents an active PTY session with its I/O handles.
///
/// Each session owns:
/// - The PTY master/slave pair
/// - A writer for sending input to the shell
/// - A buffered reader for receiving output from the shell
pub struct PtySession {
    /// The PTY master/slave pair (platform-specific implementation)
    pub pty_pair: Arc<AsyncMutex<PtyPair>>,
    /// Writer handle for sending input to the PTY (keystrokes, commands)
    pub writer: Arc<AsyncMutex<crate::pty_io::PtyWriter>>,
    /// Buffered reader for receiving output from the PTY
    pub reader: Arc<AsyncMutex<crate::pty_io::PtyReader>>,
    /// Process ID of the shell (derived from session ID for display purposes)
    pub pid: Option<u32>,
    pub io_stop: Arc<crate::pty_io::IoStop>,
    /// Shell's `start_time` (seconds since boot, sysinfo convention). Captured
    /// once at spawn and used by the app-exit sweep to tell our shell apart
    /// from a later PID-reuse holder. Meaningful on Unix; 0 and unused on
    /// Windows (whose sweep tree is shell+conhost only).
    pub start_time: u64,
    /// Owning handle to the spawned shell process. Held so `close_session`
    /// and `Drop` can kill it explicitly — dropping the PTY master alone does
    /// NOT reliably terminate the child on Windows ConPTY
    /// (`ClosePseudoConsole` only signals), which orphaned `conhost.exe` and
    /// the shell across app restarts. It is atomically `take()`n by either
    /// the reaper after a natural exit or `Drop`; the latter terminates and
    /// reaps it.
    pub child: Arc<Mutex<Option<Box<dyn Child + Send>>>>,
    /// Shell executable being used (e.g., "/bin/zsh", "powershell.exe")
    pub shell: String,
    /// Detected shell kind for profile display
    pub shell_kind: ShellKind,
    /// Working directory the shell was started in
    pub cwd: Option<String>,
    /// User-assigned display name (e.g., "Dev Server")
    pub name: Option<String>,
    /// Optional broadcast channel for tapping raw PTY output bytes (used by OS agent).
    /// When present, the reader task sends output here in addition to byte-stream Tauri events.
    /// Callers decode UTF-8 lazily only when they need text.
    pub output_tap: Option<broadcast::Sender<Arc<[u8]>>>,
    /// Bytes emitted to the frontend but not yet acknowledged.
    /// Used for backpressure: reader pauses when this exceeds HIGH_WATERMARK.
    pub unacked_bytes: Arc<AtomicUsize>,
    /// Notifier woken by ack_pty_data so the reader task can resume immediately
    /// without busy-sleeping. Replaces the fixed BACKPRESSURE_SLEEP_MS polling loop.
    pub ack_notify: Arc<Notify>,
    /// Latest render time reported by the frontend ACK (milliseconds, rounded).
    /// The reader uses this to emit smaller PTY chunks when the renderer is slow.
    pub frontend_render_ms: Arc<AtomicU32>,
    /// UTC timestamp when the PTY session was created.
    pub created_at: DateTime<Utc>,
    /// UTC timestamp of the latest PTY output chunk observed by the reader task.
    pub last_output_at: Arc<Mutex<Option<DateTime<Utc>>>>,
    /// Bounded redacted text snapshot of recent PTY output for agent inspection.
    pub redacted_output: Arc<Mutex<String>>,
    /// True while no webview listener is attached. The reader skips event
    /// emission and does not grow `unacked_bytes`; output still accrues in
    /// `redacted_output` for the next attach.
    pub detached: Arc<AtomicBool>,
    /// Total PTY bytes represented in `redacted_output` (stream offset of its
    /// end). Read/written only while holding the `redacted_output` lock so
    /// snapshot text and offset stay consistent.
    pub covers_seq: Arc<AtomicU64>,
    /// Bytes read while detached since the last attach; tells the frontend
    /// whether its client-side buffer missed output.
    pub missed_while_detached: Arc<AtomicUsize>,
    /// Binary sink for the attached webview's terminal output, installed by
    /// `attach_pty_output_channel` and cleared by `detach_pty_stream`.
    ///
    /// When present the reader task sends `[8-byte big-endian stream
    /// offset][raw PTY bytes]` frames here instead of emitting a
    /// `pty-output-{id}` event. The event transport has to base64 the payload,
    /// serialize it into JSON, and splice the result into a JavaScript source
    /// string that the webview then parses before it can run — several passes
    /// over every byte of terminal output. A channel frame above Tauri's raw
    /// direct-execute threshold is handed to the webview as an ArrayBuffer
    /// with no such encoding.
    pub output_channel: Arc<Mutex<Option<Channel<InvokeResponseBody>>>>,
}

impl Drop for PtySession {
    fn drop(&mut self) {
        self.io_stop.cancel();
        // Kill the spawned shell so it (and, on Windows, its ConPTY conhost
        // host) cannot outlive the session. `close_session` and the reader's
        // natural-exit path take() the child first; if either already did,
        // this is a no-op. Dropping the PTY master alone does NOT reliably
        // kill the child on Windows ConPTY — `ClosePseudoConsole` only
        // signals — so an explicit kill is required to avoid orphaned
        // conhost/shell processes accumulating across app restarts.
        let child = self
            .child
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .take();

        if let Some(mut child) = child {
            // Drop can run after an async future is cancelled. Explicit close
            // and app shutdown call terminate_child_sync on their blocking
            // owner first; this fallback must not block an async worker.
            std::thread::spawn(move || {
                let _ = child.kill();
                let _ = child.wait();
            });
        }
    }
}

impl PtySession {
    /// Finite shell termination, called only on a blocking/shutdown owner.
    /// Reaping runs after PTY handles can drop (macOS tty exit may need that).
    pub(crate) fn terminate_child_sync(&self) {
        self.io_stop.cancel();
        if let Some(mut child) = self.child.lock().unwrap_or_else(|p| p.into_inner()).take() {
            let _ = child.kill();
            std::thread::spawn(move || {
                let _ = child.wait();
            });
        }
    }

    /// Terminate a PTY child and wait until it has been reaped.
    ///
    /// Callers must invoke this outside the session-map lock. It may briefly
    /// block on Unix while portable-pty escalates from SIGHUP to SIGKILL.
    pub(crate) fn terminate_and_reap(mut child: Box<dyn Child + Send>) {
        let _ = child.kill();
        let _ = child.wait();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn session() -> PtySession {
        let pair = portable_pty::native_pty_system()
            .openpty(portable_pty::PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .unwrap();
        let reader = pair.master.try_clone_reader().unwrap();
        let writer = pair.master.take_writer().unwrap();
        let (reader, writer, io_stop) =
            crate::pty_io::wrap(pair.master.as_ref(), reader, writer).unwrap();
        PtySession {
            pty_pair: Arc::new(AsyncMutex::new(pair)),
            writer: Arc::new(AsyncMutex::new(writer)),
            reader: Arc::new(AsyncMutex::new(reader)),
            pid: None,
            start_time: 0,
            io_stop,
            redacted_output: Arc::new(Mutex::new(String::new())),
            child: Arc::new(Mutex::new(None)),
            shell: "test".into(),
            shell_kind: ShellKind::from_shell_path("/bin/sh"),
            cwd: None,
            name: None,
            output_tap: None,
            unacked_bytes: Arc::new(AtomicUsize::new(0)),
            ack_notify: Arc::new(Notify::new()),
            frontend_render_ms: Arc::new(AtomicU32::new(0)),
            created_at: Utc::now(),
            last_output_at: Arc::new(Mutex::new(None)),
            detached: Arc::new(AtomicBool::new(false)),
            covers_seq: Arc::new(AtomicU64::new(0)),
            missed_while_detached: Arc::new(AtomicUsize::new(0)),
            output_channel: Arc::new(Mutex::new(None)),
        }
    }
    #[tokio::test]
    async fn dropping_session_cancels_its_io_owner() {
        let session = session();
        let stop = session.io_stop.clone();
        drop(session);
        assert!(stop.is_cancelled());
    }
}
