import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import type { ClaudeProviderProfile } from "@src/api/tauri/rpc/schemas/agentOrgs";
import Button from "@src/components/Button";
import Input from "@src/components/Input";
import ModelIcon from "@src/components/ModelIcon";
import Select from "@src/components/Select";
import {
  SECTION_ACTION_GAP_CLASSES,
  SECTION_CONTROL_STYLE,
  SECTION_DESCRIPTION_CLASSES,
  SectionRow,
} from "@src/components/layout/Section";

import ClaudeModelMappings from "./ClaudeModelMappings";
import {
  newClaudeProfile,
  useClaudeProfileEditor,
} from "./useClaudeProfileEditor";

export default function ClaudeProfileEditor({
  target,
  profileId,
  onDirtyChange,
  onDraftCopied,
  onDiscarded,
}: {
  target: ClaudeProviderProfile["target"];
  /** The saved connection to edit, or null for an unsaved new one. */
  profileId: string | null;
  onDirtyChange?: (dirty: boolean) => void;
  /** A copy becomes a new unsaved connection; the parent moves its selection. */
  onDraftCopied?: () => void;
  /**
   * Discarding an unsaved *new* connection leaves nothing to edit — without
   * this the editor would just build another blank draft and never close.
   */
  onDiscarded?: () => void;
}) {
  const { t } = useTranslation("settings");
  const {
    view,
    loading,
    error,
    draft,
    edit,
    busy,
    message,
    receipt,
    models,
    dirty,
    saved,
    act,
    cancel,
  } = useClaudeProfileEditor(target);
  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);
  const profile = profileId
    ? (view?.profiles?.find((item) => item.id === profileId) ?? null)
    : null;
  useEffect(() => {
    // The list above owns the selection; mirror it into the draft. A new
    // connection starts from the first usable vault key.
    if (profile) {
      // Never clobber unsaved work — a copy replaces the draft in place and
      // must survive until the list moves to the new connection.
      if (draft?.id !== profile.id && !dirty) edit(profile);
      return;
    }
    // Wait for the view: a draft built before the vault keys arrive would keep
    // an empty credential and model set that nothing rebuilds.
    if (!profileId && !draft && view)
      edit(newClaudeProfile(target, t("claudeProfiles.newName"), view));
  }, [dirty, draft, edit, profile, profileId, t, target, view]);
  const active = view?.appliedProfile;
  const disabled = busy !== null || loading;
  const choice = view?.choices.find((c) => c.keyId === draft?.keyId);
  const blocked =
    disabled ||
    !view?.installed ||
    !view.config.supported ||
    Boolean(
      view.config.conflict || view.configurationIssue || choice?.reason
    ) ||
    !choice;
  const valid = Boolean(
    draft?.name.trim() &&
    draft.keyId &&
    draft.endpoint &&
    Object.values(draft.models.roles).every((m) => m.model.trim())
  );
  return (
    <>
      {profileId && (
        <SectionRow
          label={t("harnessConnections.connection")}
          description={t(
            target === "claude_desktop"
              ? "harnessConnections.desktopScope"
              : "harnessConnections.scope"
          )}
        >
          <div className={`${SECTION_ACTION_GAP_CLASSES} flex-wrap`}>
            <Button
              disabled={
                disabled ||
                // An unsaved *new* connection has nothing to lose: copying just
                // replaces it. Unsaved edits to a saved one still block.
                (dirty && Boolean(saved)) ||
                view?.config.mode === "default" ||
                !view?.config.selectedKeyId ||
                view.config.conflict
              }
              onClick={() => {
                edit(
                  newClaudeProfile(
                    target,
                    t("claudeProfiles.copyName"),
                    view,
                    true
                  )
                );
                onDraftCopied?.();
              }}
            >
              {t("claudeProfiles.copy")}
            </Button>
          </div>
        </SectionRow>
      )}
      {(error ||
        view?.configurationIssue ||
        view?.config.message ||
        view?.config.conflict ||
        (view && !view.installed)) && (
        <SectionRow showHeader={false}>
          <p role="alert" className="text-sm text-warning-6">
            {error ??
              view?.configurationIssue ??
              view?.config.message ??
              t(
                view?.config.conflict
                  ? "harnessConnections.conflict"
                  : "harnessConnections.notInstalled"
              )}
          </p>
        </SectionRow>
      )}
      {draft && (
        <>
          {!loading && !choice && (
            <SectionRow showHeader={false}>
              <p role="alert" className="text-sm text-warning-6">
                {t("harnessConnections.missingKey")}
              </p>
            </SectionRow>
          )}
          <SectionRow label={t("claudeProfiles.name")}>
            <Input
              aria-label={t("claudeProfiles.name")}
              value={draft.name}
              maxLength={120}
              disabled={disabled}
              style={SECTION_CONTROL_STYLE}
              onChange={(name) => edit({ ...draft, name })}
            />
          </SectionRow>
          <SectionRow label={t("claudeProfiles.credential")}>
            <Select
              ariaLabel={t("claudeProfiles.credential")}
              value={draft.keyId || undefined}
              disabled={disabled}
              style={SECTION_CONTROL_STYLE}
              options={(view?.choices ?? []).map((c) => ({
                value: c.keyId,
                label: c.name,
                // Brand the key the way every other provider list does; the
                // first model it serves identifies the provider best.
                icon: (
                  <ModelIcon modelName={c.models[0] ?? c.name} size="small" />
                ),
                disabled: Boolean(c.reason),
              }))}
              onChange={(value) => {
                const choice = view?.choices.find((c) => c.keyId === value);
                edit({
                  ...draft,
                  keyId: String(value),
                  endpoint: draft.endpoint || choice?.endpoint || "",
                });
              }}
            />
          </SectionRow>
          {choice?.reason && (
            <SectionRow showHeader={false}>
              <p role="alert" className="text-sm text-warning-6">
                {choice.reason}
              </p>
            </SectionRow>
          )}
          <SectionRow label={t("harnessConnections.endpoint")}>
            <Input
              aria-label={t("harnessConnections.endpoint")}
              value={draft.endpoint}
              disabled={disabled}
              style={SECTION_CONTROL_STYLE}
              placeholder="https://gateway.example/anthropic"
              onChange={(endpoint) => edit({ ...draft, endpoint })}
            />
          </SectionRow>
          <SectionRow label={t("harnessConnections.authentication")}>
            <Select
              ariaLabel={t("harnessConnections.authentication")}
              value={draft.authScheme}
              disabled={disabled}
              style={SECTION_CONTROL_STYLE}
              options={[
                { value: "bearer", label: "Authorization: Bearer" },
                { value: "x-api-key", label: "x-api-key" },
              ]}
              onChange={(value) =>
                edit({
                  ...draft,
                  authScheme: value === "x-api-key" ? "x-api-key" : "bearer",
                })
              }
            />
          </SectionRow>
          <ClaudeModelMappings
            profile={draft}
            disabled={disabled}
            models={models}
            onChange={edit}
            onFetch={() => void act("fetch")}
          />
          {/* Footer: the state of the draft on the left, its actions on the
              right, fenced off from the fields above. */}
          <SectionRow showHeader={false}>
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              {dirty ? (
                <p role="status" className={SECTION_DESCRIPTION_CLASSES}>
                  {t("claudeProfiles.unsaved")}
                </p>
              ) : (
                <span />
              )}
              <div className="flex flex-wrap items-center gap-2">
                {/* Testing, applying and deleting need something saved to
                    act on, so a new connection shows none of them. */}
                {saved && (
                  <>
                    <Button
                      disabled={blocked || dirty || !valid}
                      loading={busy === "test"}
                      onClick={() => void act("test")}
                    >
                      {t("claudeProfiles.test")}
                    </Button>
                    <Button
                      disabled={blocked || dirty || !valid || !receipt}
                      loading={busy === "apply"}
                      onClick={() => void act("apply")}
                    >
                      {t("harnessConnections.apply")}
                    </Button>
                  </>
                )}
                {saved && active?.id !== draft.id && (
                  <Button
                    disabled={disabled || dirty}
                    onClick={() => void act("delete")}
                  >
                    {t("claudeProfiles.delete")}
                  </Button>
                )}
                {dirty && (
                  <Button
                    disabled={disabled}
                    onClick={() => {
                      edit(saved ?? null);
                      if (!saved) onDiscarded?.();
                    }}
                  >
                    {t("claudeProfiles.discard")}
                  </Button>
                )}
                <Button
                  variant="primary"
                  disabled={disabled || !dirty || !valid}
                  onClick={() => void act("save")}
                >
                  {t("claudeProfiles.save")}
                </Button>
              </div>
            </div>
          </SectionRow>
        </>
      )}
      {(busy === "test" || busy === "fetch") && (
        <SectionRow showHeader={false}>
          <Button onClick={cancel}>{t("harnessConnections.cancel")}</Button>
        </SectionRow>
      )}
      {message && (
        <SectionRow showHeader={false}>
          <p
            role="status"
            aria-live="polite"
            className={SECTION_DESCRIPTION_CLASSES}
          >
            {message}
          </p>
        </SectionRow>
      )}
    </>
  );
}
