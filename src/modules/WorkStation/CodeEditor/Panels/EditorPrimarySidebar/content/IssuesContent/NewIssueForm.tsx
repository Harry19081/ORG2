import { Loader2, X } from "lucide-react";
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { GitHubIssueLabel, GitHubIssueUser } from "@src/api/tauri/github";
import { getLabelColorStyle } from "@src/modules/WorkStation/CodeEditor/Panels/EditorPrimarySidebar/hooks/workstationIssueHelpers";

interface NewIssueFormProps {
  onSubmit: (
    title: string,
    body: string,
    labels: string[],
    assignees: string[]
  ) => Promise<void>;
  onCancel: () => void;
  repoLabels: GitHubIssueLabel[];
  collaborators: GitHubIssueUser[];
  loading: boolean;
}

export const NewIssueForm: React.FC<NewIssueFormProps> = memo(
  ({ onSubmit, onCancel, repoLabels, collaborators, loading }) => {
    const { t } = useTranslation("common");

    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
    const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);

    const titleRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
      titleRef.current?.focus();
    }, []);

    const handleLabelToggle = useCallback((name: string) => {
      setSelectedLabels((prev) =>
        prev.includes(name) ? prev.filter((l) => l !== name) : [...prev, name]
      );
    }, []);

    const handleAssigneeToggle = useCallback((login: string) => {
      setSelectedAssignees((prev) =>
        prev.includes(login)
          ? prev.filter((a) => a !== login)
          : [...prev, login]
      );
    }, []);

    const handleSubmit = useCallback(
      async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || loading) return;
        await onSubmit(
          title.trim(),
          body.trim(),
          selectedLabels,
          selectedAssignees
        );
      },
      [title, body, selectedLabels, selectedAssignees, loading, onSubmit]
    );

    return (
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="flex flex-col gap-2 border-b border-border-1 px-3 py-3"
      >
        {/* Title */}
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("git.issues.newIssueTitlePlaceholder", "Issue title")}
          required
          className="w-full rounded border border-border-2 bg-fill-1 px-2 py-1.5 text-[12px] text-text-1 placeholder:text-text-3 focus:border-primary-6 focus:outline-none"
        />

        {/* Body */}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t(
            "git.issues.newIssueBodyPlaceholder",
            "Describe the issue (optional)…"
          )}
          rows={4}
          className="w-full resize-y rounded border border-border-2 bg-fill-1 px-2 py-1.5 text-[12px] text-text-1 placeholder:text-text-3 focus:border-primary-6 focus:outline-none"
        />

        {/* Labels */}
        {repoLabels.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase text-text-3">
              Labels
            </span>
            <div className="flex flex-wrap gap-1">
              {repoLabels.map((label) => {
                const isSelected = selectedLabels.includes(label.name);
                const style = isSelected
                  ? getLabelColorStyle(label.color)
                  : undefined;
                return (
                  <button
                    key={label.id}
                    type="button"
                    onClick={() => handleLabelToggle(label.name)}
                    className={`rounded-full px-1.5 py-[1px] text-[10px] font-medium leading-tight transition-opacity ${
                      isSelected
                        ? "opacity-100"
                        : "border border-border-2 text-text-2 opacity-60 hover:opacity-100"
                    }`}
                    style={isSelected ? style : undefined}
                  >
                    {label.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Assignees */}
        {collaborators.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase text-text-3">
              Assignees
            </span>
            <div className="flex flex-wrap gap-1">
              {collaborators.slice(0, 20).map((user) => {
                const isSelected = selectedAssignees.includes(user.login);
                return (
                  <button
                    key={user.login}
                    type="button"
                    onClick={() => handleAssigneeToggle(user.login)}
                    className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] transition-colors ${
                      isSelected
                        ? "bg-primary-1 text-primary-6"
                        : "text-text-2 hover:bg-fill-2"
                    }`}
                  >
                    <img
                      src={user.avatar_url}
                      alt={user.login}
                      className="h-3.5 w-3.5 rounded-full"
                    />
                    {user.login}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex items-center gap-1 rounded px-2.5 py-1 text-[11px] text-text-2 hover:bg-fill-2 disabled:opacity-50"
          >
            <X size={11} />
            {t("actions.cancel", "Cancel")}
          </button>
          <button
            type="submit"
            disabled={!title.trim() || loading}
            className="flex items-center gap-1 rounded bg-primary-6 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-primary-7 disabled:opacity-50"
          >
            {loading && <Loader2 size={11} className="animate-spin" />}
            {t("actions.create", "Create")}
          </button>
        </div>
      </form>
    );
  }
);

NewIssueForm.displayName = "NewIssueForm";
