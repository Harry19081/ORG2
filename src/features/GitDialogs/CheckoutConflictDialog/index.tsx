import React, { useState } from "react";
import { type Root, createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";

import type {
  BranchSwitchResult,
  SwitchPreparation,
  SwitchScope,
  SwitchStrategy,
} from "@src/api/http/git/branchSwitch";
import Button from "@src/components/Button";
import Modal from "@src/scaffold/ModalSystem";
import SelectionGrid from "@src/scaffold/WizardSystem/primitives/SelectionGrid";

import { openSavedChanges } from "../SavedChangesDialog";

export type CheckoutConflictResult = SwitchStrategy | "cancel";
interface ViewProps {
  scope: SwitchScope;
  preparation?: SwitchPreparation;
  busy: boolean;
  result?: BranchSwitchResult;
  error?: string;
  onChoice: (choice: CheckoutConflictResult) => void;
  onClose: () => void;
}
export function BranchSwitchDialogView({
  scope,
  preparation,
  busy,
  result,
  error,
  onChoice,
  onClose,
}: ViewProps) {
  const { t } = useTranslation("common");
  const [choice, setChoice] = useState<SwitchStrategy>(
    preparation?.default_strategy ?? "leave"
  );
  const terminal = Boolean(result || error);
  const title =
    result?.outcome === "switched_with_conflicts"
      ? t("git.branchSwitch.conflictsTitle", "Changes need attention")
      : error ||
          result?.outcome === "blocked" ||
          result?.outcome === "recovery_required"
        ? t("git.branchSwitch.blockedTitle", "Branch switch needs attention")
        : t("git.branchSwitch.title", "Switch branch");
  return (
    <Modal
      visible
      title={title}
      size="small"
      maskClosable={false}
      closable={!busy}
      escToExit={!busy}
      onClose={busy ? undefined : onClose}
      onCancel={busy ? undefined : onClose}
      onOk={terminal ? onClose : () => onChoice(choice)}
      okText={
        terminal
          ? t("actions.close", "Close")
          : busy
            ? t("git.branchSwitch.working", "Saving and switching…")
            : t("git.branchSwitch.title", "Switch branch")
      }
      okButtonProps={{ loading: busy, disabled: busy }}
      cancelButtonProps={{ disabled: busy }}
      cancelText={t("actions.cancel", "Cancel")}
      footer={
        terminal ? (
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                onClose();
                void openSavedChanges(scope);
              }}
            >
              {t("git.branchSwitch.viewSaved", "View saved changes")}
            </Button>
            <Button variant="primary" onClick={onClose}>
              {t("actions.close", "Close")}
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="flex min-w-0 flex-col gap-4">
        {scope.repoPath && (
          <p className="text-xs break-all text-text-3">{scope.repoPath}</p>
        )}
        {preparation && (
          <p className="text-sm break-words text-text-1">
            {preparation.current_branch} → {preparation.target_branch}
          </p>
        )}
        {terminal ? (
          <div role="status" className="flex flex-col gap-2">
            {result && (
              <p className="text-sm break-words text-text-1">
                {t("git.branchSwitch.current", {
                  defaultValue: "Current branch: {{branch}}",
                  branch: result.current_branch,
                })}
              </p>
            )}
            <p className="text-sm break-words whitespace-pre-wrap text-text-2">
              {error || result?.message}
            </p>
            {result?.conflicts.length ? (
              <ul className="list-inside list-disc text-xs text-text-2">
                {result.conflicts.map((file) => (
                  <li key={file} className="break-all">
                    {file}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : preparation ? (
          <>
            <details className="text-xs text-text-3">
              <summary>
                {t("git.branchSwitch.changedFiles", {
                  defaultValue: "{{count}} changed files",
                  count: preparation.changed_files.length,
                })}
              </summary>
              <ul className="mt-2 max-h-48 overflow-auto">
                {preparation.changed_files.map((file) => (
                  <li key={file} className="break-all">
                    {file}
                  </li>
                ))}
              </ul>
            </details>
            <fieldset disabled={busy} className="min-w-0">
              <legend className="mb-3 text-sm text-text-1">
                {t(
                  "git.branchSwitch.question",
                  "What would you like to do with your changes?"
                )}
              </legend>
              <SelectionGrid
                vertical
                showRadio
                options={[
                  {
                    key: "leave",
                    label: t("git.branchSwitch.leave", {
                      defaultValue: "Leave changes on {{branch}}",
                      branch: preparation.current_branch,
                    }),
                    description: t(
                      "git.branchSwitch.leaveDescription",
                      "Save your work for later and switch with a clean working tree"
                    ),
                    disabled: busy,
                  },
                  {
                    key: "bring",
                    label: t("git.branchSwitch.bring", {
                      defaultValue: "Bring changes to {{branch}}",
                      branch: preparation.target_branch,
                    }),
                    description: t(
                      "git.branchSwitch.bringDescription",
                      "Move your uncommitted changes to the destination branch"
                    ),
                    disabled: busy,
                  },
                ]}
                selected={choice}
                onSelect={setChoice}
              />
            </fieldset>
          </>
        ) : (
          <p role="status" className="text-sm text-text-2">
            {t("git.branchSwitch.working", "Saving and switching…")}
          </p>
        )}
      </div>
    </Modal>
  );
}

/** Per-operation controller; no retained singleton state or detached modal roots. */
export function createBranchSwitchDialog(scope: SwitchScope) {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;
  let preparation: SwitchPreparation | undefined;
  let resolveChoice: ((choice: CheckoutConflictResult) => void) | undefined;
  let busy = false;
  const dispose = () => {
    resolveChoice?.("cancel");
    resolveChoice = undefined;
    const oldRoot = root;
    const oldContainer = container;
    root = undefined;
    container = undefined;
    queueMicrotask(() => {
      oldRoot?.unmount();
      oldContainer?.remove();
    });
  };
  const render = (result?: BranchSwitchResult, error?: string) => {
    if (!root) {
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
    }
    root.render(
      <BranchSwitchDialogView
        scope={scope}
        preparation={preparation}
        busy={busy}
        result={result}
        error={error}
        onClose={dispose}
        onChoice={(choice) => {
          const resolve = resolveChoice;
          resolveChoice = undefined;
          if (choice === "cancel") dispose();
          else {
            busy = true;
            render();
          }
          resolve?.(choice);
        }}
      />
    );
  };
  return {
    choose: (value: SwitchPreparation) =>
      new Promise<CheckoutConflictResult>((resolve) => {
        preparation = value;
        resolveChoice = resolve;
        render();
      }),
    executing: () => {
      busy = true;
      render();
    },
    complete: async (value: BranchSwitchResult) => {
      busy = false;
      if (value.outcome === "switched") dispose();
      else render(value);
    },
    blocked: async (message: string, currentBranch?: string) => {
      busy = false;
      if (currentBranch)
        render({
          outcome: "blocked",
          current_branch: currentBranch,
          message,
          snapshot_id: null,
          conflicts: [],
        });
      else render(undefined, message);
    },
    dispose,
  };
}
