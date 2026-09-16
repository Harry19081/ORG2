import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";

import {
  type BranchSnapshot,
  type SwitchScope,
  branchSwitchApi,
} from "@src/api/http/git/branchSwitch";
import Button from "@src/components/Button";
import Modal from "@src/scaffold/ModalSystem";

export function SavedChangesDialog({
  scope,
  onClose,
}: {
  scope: SwitchScope;
  onClose: () => void;
}) {
  const { t } = useTranslation("common");
  const [snapshots, setSnapshots] = useState<BranchSnapshot[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState("");
  const alive = useRef(true);
  const { repoId, repoPath } = scope;
  const load = useCallback(
    async (next?: string) => {
      setBusy(true);
      try {
        const page = await branchSwitchApi.saved({ repoId, repoPath }, next);
        if (alive.current) {
          setSnapshots(page.snapshots);
          setCursor(page.next_cursor);
        }
      } catch (e) {
        if (alive.current) setMessage(String(e));
      } finally {
        if (alive.current) setBusy(false);
      }
    },
    [repoId, repoPath]
  );
  useEffect(() => {
    alive.current = true;
    void load().catch((error: unknown) => {
      if (alive.current) setMessage(String(error));
    });
    return () => {
      alive.current = false;
    };
  }, [load]);
  async function inspect(snapshot: BranchSnapshot) {
    setBusy(true);
    setPreview("");
    try {
      const text = await branchSwitchApi.preview(scope, snapshot.id);
      if (alive.current) setPreview(text);
    } catch (e) {
      if (alive.current) setMessage(String(e));
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function restore(snapshot: BranchSnapshot) {
    setBusy(true);
    setMessage("");
    try {
      const { ensureSwitchWorkspaceReady } =
        await import("@src/services/git/operations/branchSwitchWorkspace");
      if (!(await ensureSwitchWorkspaceReady(scope))) return;
      const result = await branchSwitchApi.restore(scope, snapshot.id);
      window.dispatchEvent(
        new CustomEvent("orgii-branch-switch-completed", { detail: scope })
      );
      if (alive.current) {
        setMessage(result.message);
        await load();
      }
    } catch (e) {
      if (alive.current) setMessage(String(e));
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return (
    <Modal
      visible
      title={t("git.branchSwitch.savedTitle", "Saved changes")}
      size="medium"
      maskClosable={false}
      closable={!busy}
      escToExit={!busy}
      onClose={busy ? undefined : onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button disabled={busy} onClick={() => void load()}>
            {t("actions.refresh", "Refresh")}
          </Button>
          {cursor && (
            <Button disabled={busy} onClick={() => void load(cursor)}>
              {t("git.branchSwitch.nextPage", "Next page")}
            </Button>
          )}
          <Button variant="primary" disabled={busy} onClick={onClose}>
            {t("actions.close", "Close")}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {message && (
          <p
            role="status"
            className="text-sm break-words whitespace-pre-wrap text-text-2"
          >
            {message}
          </p>
        )}
        {busy && (
          <p role="status" className="text-xs text-text-3">
            {t("status.loading", "Loading…")}
          </p>
        )}
        {!busy && snapshots.length === 0 && (
          <p className="text-sm text-text-3">
            {t("git.branchSwitch.noSaved", "No saved branch changes")}
          </p>
        )}
        {snapshots.map((s) => (
          <div
            key={s.id}
            className="flex flex-col gap-2 rounded-lg border border-border-2 p-3"
          >
            <p className="text-sm font-medium break-words text-text-1">
              {s.source_branch}
            </p>
            <p className="text-xs break-all text-text-3">
              {s.worktree_path} · {new Date(s.created_at).toLocaleString()}
            </p>
            <p className="text-xs text-text-3">
              {t("git.branchSwitch.changedFiles", {
                defaultValue: "{{count}} changed files",
                count: s.files.length,
              })}
              {["brought", "restored"].includes(s.phase)
                ? ` · ${t("git.branchSwitch.applied", "Already applied · recovery copy")}`
                : ""}
            </p>
            <div className="flex gap-2">
              <Button
                size="small"
                disabled={busy || !s.oid}
                onClick={() => void inspect(s)}
              >
                {t("actions.view", "View")}
              </Button>
              <Button
                size="small"
                disabled={
                  busy ||
                  !s.oid ||
                  [
                    "brought",
                    "restored",
                    "applying",
                    "restoring",
                    "needs_resolution",
                  ].includes(s.phase)
                }
                onClick={() => void restore(s)}
              >
                {t("git.branchSwitch.restore", "Restore")}
              </Button>
            </div>
          </div>
        ))}
        {preview && (
          <pre className="max-h-64 overflow-auto rounded bg-fill-2 p-3 text-xs break-all whitespace-pre-wrap text-text-2">
            {preview}
          </pre>
        )}
      </div>
    </Modal>
  );
}
export function openSavedChanges(scope: SwitchScope): void {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  root.render(
    <SavedChangesDialog
      scope={scope}
      onClose={() => {
        queueMicrotask(() => {
          root.unmount();
          container.remove();
        });
      }}
    />
  );
}
