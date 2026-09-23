/**
 * PrFlowHeader
 *
 * GitHub-style flow title for the PR Conversation tab: the large PR title with
 * its muted #number, then a status pill followed by the merge-flow sentence
 * ("{author} wants to merge {n} commits into {base} from {head}") with the
 * branch names as code pills, a copy-branch action, and the +/− diff stat.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { type PrFile, listPRBaseBranchesLocal } from "@src/api/tauri/github";
import Button from "@src/components/Button";
import Dropdown from "@src/components/Dropdown";
import Input from "@src/components/Input";
import Message from "@src/components/Message";
import PrStatusBadge from "@src/components/PrStatusBadge";
import Textarea from "@src/components/Textarea";
import GitHubFlowHeader from "@src/features/GitHubWork/GitHubFlowHeader";
import { Copy01Icon, HugeiconsIcon, Pen01Icon } from "@src/icons";
import type { PrIdentity } from "@src/store/workstation/codeEditor/workstationSelectedPrAtom";
import { copyText } from "@src/util/data/clipboard";

interface PrFlowActor {
  login: string;
  avatarUrl: string;
}

function readNumber(
  detail: Record<string, unknown> | null,
  key: string
): number | null {
  const value = detail?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readActor(
  detail: Record<string, unknown> | null,
  key: string
): PrFlowActor | null {
  const value = detail?.[key];
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.login !== "string" || !record.login) return null;
  return {
    login: record.login,
    avatarUrl: typeof record.avatar_url === "string" ? record.avatar_url : "",
  };
}

function BranchPill({ name }: { name: string }): React.ReactNode {
  return (
    <code
      className="inline-block max-w-[220px] truncate rounded-md bg-primary-1 px-1.5 py-0.5 align-bottom font-mono text-[11px] leading-4 text-primary-6"
      title={name}
    >
      {name}
    </code>
  );
}

interface PrFlowHeaderProps {
  identity: PrIdentity;
  detail: Record<string, unknown> | null;
  baseBranch: string;
  /** Fallback commit count when the PR detail payload has none. */
  commitCount: number;
  /** Fallback source for the +/− diff stat when the detail payload has none. */
  files: PrFile[];
  repoFullName?: string | null;
  pending?: boolean;
  onUpdate?: (changes: {
    title?: string;
    body?: string;
    base?: string;
  }) => Promise<void>;
}

export function PrFlowHeader({
  identity,
  detail,
  baseBranch,
  commitCount,
  files,
  repoFullName,
  pending = false,
  onUpdate,
}: PrFlowHeaderProps): React.ReactNode {
  const { t } = useTranslation("common");
  const [branches, setBranches] = useState<string[]>([]);
  const [branchLoading, setBranchLoading] = useState(false);
  const [branchOpen, setBranchOpen] = useState(false);
  const [branchSearch, setBranchSearch] = useState("");
  const branchRequestRef = useRef(0);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [saving, setSaving] = useState(false);
  const title =
    typeof detail?.title === "string" ? detail.title : identity.title;
  const body = typeof detail?.body === "string" ? detail.body : "";

  useEffect(() => {
    branchRequestRef.current += 1;
    setBranchOpen(false);
    setBranchSearch("");
    setBranches([]);
    setBranchLoading(false);
    return () => {
      branchRequestRef.current += 1;
    };
  }, [repoFullName, identity.number]);
  const author = readActor(detail, "user");
  const merged = identity.status === "merged";
  // Merged PRs credit the merger, matching GitHub's flow sentence.
  const actor = (merged ? readActor(detail, "merged_by") : null) ?? author;
  const commits = readNumber(detail, "commits") ?? commitCount;
  const additions =
    readNumber(detail, "additions") ??
    files.reduce((total, file) => total + file.additions, 0);
  const deletions =
    readNumber(detail, "deletions") ??
    files.reduce((total, file) => total + file.deletions, 0);

  const copyHeadBranch = useCallback(async () => {
    try {
      await copyText(identity.headBranch);
      Message.success(t("git.pr.flow.branchCopied"));
    } catch (error) {
      Message.error(error instanceof Error ? error.message : String(error));
    }
  }, [identity.headBranch, t]);

  const verbPhrase = merged
    ? t("git.pr.flow.mergedCommitsInto", {
        count: commits,
        defaultValue_other: "merged {{count}} commits into",
      })
    : t("git.pr.flow.wantsToMergeCommitsInto", {
        count: commits,
        defaultValue_other: "wants to merge {{count}} commits into",
      });

  const openBranches = useCallback(
    (visible: boolean) => {
      setBranchOpen(visible);
      if (!visible || !repoFullName) {
        branchRequestRef.current += 1;
        setBranchSearch("");
        setBranchLoading(false);
        return;
      }
      const request = ++branchRequestRef.current;
      setBranches([]);
      setBranchSearch("");
      setBranchLoading(true);
      void listPRBaseBranchesLocal(repoFullName)
        .then((items) => {
          if (branchRequestRef.current === request) setBranches(items);
        })
        .catch((error: unknown) => {
          if (branchRequestRef.current === request)
            Message.error(
              error instanceof Error ? error.message : String(error)
            );
        })
        .finally(() => {
          if (branchRequestRef.current === request) setBranchLoading(false);
        });
    },
    [repoFullName]
  );

  const changeBase = useCallback(
    async (base: string) => {
      if (!onUpdate || base === baseBranch) return;
      try {
        await onUpdate({ base });
        setBranchOpen(false);
      } catch (error) {
        Message.error(error instanceof Error ? error.message : String(error));
      }
    },
    [onUpdate, baseBranch]
  );

  const saveDescription = useCallback(async () => {
    if (!onUpdate || !editTitle.trim()) return;
    setSaving(true);
    try {
      await onUpdate({ title: editTitle.trim(), body: editBody });
      setEditing(false);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }, [onUpdate, editTitle, editBody]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-w-0 items-start gap-2">
        <div className="min-w-0 flex-1">
          <GitHubFlowHeader
            testIdPrefix="pr-flow"
            ariaLabel={t("git.pr.summary.label")}
            title={title}
            number={identity.number}
            status={
              <PrStatusBadge status={identity.status} size="sm" showIcon />
            }
            actor={actor}
            unknownActorLabel={t("git.pr.unknownAuthor")}
          >
            <span>{verbPhrase}</span>
            {identity.status === "open" && onUpdate && repoFullName ? (
              <Dropdown
                popupVisible={branchOpen}
                onVisibleChange={openBranches}
                position="bottom-start"
                getPopupContainer={() => document.body}
                avoidViewportOverflow
                options={[
                  ...branches.map((branch) => ({
                    label: branch,
                    value: branch,
                  })),
                  ...(branchSearch.trim() &&
                  !branches.some((branch) => branch === branchSearch.trim())
                    ? [
                        {
                          label: t("git.pr.flow.useBranch", {
                            branch: branchSearch.trim(),
                          }),
                          value: branchSearch.trim(),
                        },
                      ]
                    : []),
                ]}
                value={baseBranch}
                showSearch
                onSearch={setBranchSearch}
                loading={branchLoading}
                searchPlaceholder={t("git.pr.flow.findBranch")}
                emptyContent={t("git.pr.flow.noBranches")}
                onSelect={(value) => {
                  if (typeof value === "string") void changeBase(value);
                }}
              >
                <Button
                  size="inline"
                  variant="tertiary"
                  disabled={pending || saving}
                  aria-label={t("git.pr.flow.changeBase")}
                  aria-expanded={branchOpen}
                  data-testid="pr-flow-base-branch"
                >
                  <BranchPill name={baseBranch} /> ▾
                </Button>
              </Dropdown>
            ) : (
              <BranchPill name={baseBranch} />
            )}
            <span>{t("git.pr.flow.from")}</span>
            <BranchPill name={identity.headBranch} />
            <Button
              size="sidebar"
              aria-label={t("git.pr.flow.copyHeadBranch")}
              title={t("git.pr.flow.copyHeadBranch")}
              className="text-text-3 hover:text-text-1"
              onClick={() => void copyHeadBranch()}
              data-testid="pr-flow-copy-branch"
              variant="tertiary"
              iconOnly
              icon={
                <HugeiconsIcon
                  icon={Copy01Icon}
                  data-icon="copy"
                  size={12}
                  strokeWidth={1.75}
                  aria-hidden
                />
              }
            />
            <span className="inline-flex items-center gap-1 tabular-nums">
              <span className="text-success-6">
                +{additions.toLocaleString("en-US")}
              </span>
              <span className="text-danger-6">
                -{deletions.toLocaleString("en-US")}
              </span>
            </span>
          </GitHubFlowHeader>
        </div>
        {onUpdate && repoFullName && !editing ? (
          <Button
            size="mini"
            variant="tertiary"
            iconOnly
            icon={
              <HugeiconsIcon
                icon={Pen01Icon}
                data-icon="pencil"
                size={14}
                strokeWidth={1.75}
                aria-hidden
              />
            }
            aria-label={t("git.pr.flow.editTitleDescription")}
            title={t("git.pr.flow.editTitleDescription")}
            disabled={pending}
            onClick={() => {
              setEditTitle(title);
              setEditBody(body);
              setEditing(true);
            }}
            data-testid="pr-flow-edit"
          />
        ) : null}
      </div>
      {onUpdate && repoFullName ? (
        editing ? (
          <div className="flex flex-col gap-2 rounded-lg border border-border-1 bg-fill-1 p-3">
            <label htmlFor="pr-edit-title">{t("git.pr.flow.title")}</label>
            <Input
              id="pr-edit-title"
              value={editTitle}
              onChange={setEditTitle}
              disabled={saving}
            />
            <label htmlFor="pr-edit-body">{t("git.pr.flow.description")}</label>
            <Textarea
              id="pr-edit-body"
              value={editBody}
              onChange={setEditBody}
              disabled={saving}
              rows={8}
            />
            <div className="flex gap-2">
              <Button
                size="small"
                variant="primary"
                loading={saving}
                disabled={!editTitle.trim() || pending}
                onClick={() => void saveDescription()}
                data-testid="pr-flow-save"
              >
                {t("git.pr.flow.save")}
              </Button>
              <Button
                size="small"
                variant="tertiary"
                disabled={saving}
                onClick={() => setEditing(false)}
              >
                {t("git.pr.flow.cancel")}
              </Button>
            </div>
          </div>
        ) : null
      ) : null}
    </div>
  );
}
