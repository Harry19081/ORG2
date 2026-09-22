import { useCallback, useId, useMemo } from "react";
import { useTranslation } from "react-i18next";

import type {
  ClaudeProviderProfile,
  ClaudeRole,
} from "@src/api/tauri/rpc/schemas/agentOrgs";
import Button from "@src/components/Button";
import Checkbox from "@src/components/Checkbox";
import Input from "@src/components/Input";
import Select from "@src/components/Select";
import SettingsTable, {
  SETTINGS_TABLE_COL,
  type SettingsTableColumn,
} from "@src/components/SettingsTable";
import {
  SECTION_ACTION_GAP_CLASSES,
  SECTION_CONTROL_STYLE,
  SectionRow,
} from "@src/components/layout/Section";

export const MAIN_ROLES = ["sonnet", "opus", "fable", "haiku"] as const;
const LABELS: Record<ClaudeRole, string> = {
  sonnet: "Sonnet",
  opus: "Opus",
  fable: "Fable",
  haiku: "Haiku",
  subagent: "Subagent",
};

export default function ClaudeModelMappings({
  profile,
  disabled,
  models,
  onChange,
  onFetch,
}: {
  profile: ClaudeProviderProfile;
  disabled: boolean;
  models: string[];
  onChange: (profile: ClaudeProviderProfile) => void;
  onFetch: () => void;
}) {
  const { t } = useTranslation("settings");
  const listId = useId();
  const roles: ClaudeRole[] =
    profile.target === "claude_code"
      ? [...MAIN_ROLES, "subagent"]
      : [...MAIN_ROLES];
  const update = useCallback(
    (
      role: ClaudeRole,
      value: Partial<ClaudeProviderProfile["models"]["roles"]["sonnet"]>
    ) => {
      const entry = {
        model: "",
        displayName: "",
        context1m: false,
        ...profile.models.roles[role],
        ...value,
      };
      const next = { ...profile.models.roles, [role]: entry };
      if (role === "subagent" && !entry.model) delete next.subagent;
      onChange({ ...profile, models: { ...profile.models, roles: next } });
    },
    [onChange, profile]
  );
  const columns = useMemo<SettingsTableColumn<ClaudeRole>[]>(
    () => [
      {
        key: "role",
        label: t("claudeProfiles.role"),
        width: SETTINGS_TABLE_COL.valueMd,
        renderCell: (role) => (
          <span className="text-sm font-medium text-text-2">
            {LABELS[role]}
          </span>
        ),
      },
      {
        key: "displayName",
        label: t("claudeProfiles.displayName"),
        width: SETTINGS_TABLE_COL.fill,
        renderCell: (role) => (
          <Input
            aria-label={`${LABELS[role]} ${t("claudeProfiles.displayName")}`}
            value={profile.models.roles[role]?.displayName ?? ""}
            placeholder={t(
              role === "subagent"
                ? "claudeProfiles.noLabel"
                : "claudeProfiles.displayName"
            )}
            disabled={disabled || role === "subagent"}
            maxLength={120}
            size="default"
            className="w-full"
            onChange={(displayName) => update(role, { displayName })}
          />
        ),
      },
      {
        key: "model",
        label: t("claudeProfiles.requestModel"),
        width: SETTINGS_TABLE_COL.fill,
        renderCell: (role) => (
          <Input
            aria-label={`${LABELS[role]} ${t("claudeProfiles.requestModel")}`}
            value={profile.models.roles[role]?.model ?? ""}
            list={listId}
            placeholder={t(
              role === "subagent"
                ? "claudeProfiles.inherit"
                : "claudeProfiles.requestModel"
            )}
            disabled={disabled}
            maxLength={256}
            size="default"
            className="w-full"
            onChange={(model) => update(role, { model })}
          />
        ),
      },
      {
        key: "context1m",
        label: "1M",
        width: SETTINGS_TABLE_COL.hug,
        align: "center",
        // Haiku has no 1M context tier, so the cell stays empty for that role.
        renderCell: (role) =>
          role === "haiku" ? null : (
            <Checkbox
              ariaLabel={`${LABELS[role]} 1M`}
              disabled={disabled || !profile.models.roles[role]?.model}
              checked={profile.models.roles[role]?.context1m ?? false}
              onCheckedChange={(context1m) => update(role, { context1m })}
            />
          ),
      },
    ],
    [disabled, listId, profile, t, update]
  );
  return (
    <>
      <SectionRow label={t("claudeProfiles.defaultRole")}>
        <Select
          ariaLabel={t("claudeProfiles.defaultRole")}
          value={profile.models.defaultRole}
          disabled={disabled}
          style={SECTION_CONTROL_STYLE}
          options={MAIN_ROLES.map((role) => ({
            value: role,
            label: LABELS[role],
          }))}
          onChange={(value) => {
            if (MAIN_ROLES.includes(value as (typeof MAIN_ROLES)[number]))
              onChange({
                ...profile,
                models: {
                  ...profile.models,
                  defaultRole: value as (typeof MAIN_ROLES)[number],
                },
              });
          }}
        />
      </SectionRow>
      <SectionRow
        label={
          <span className="flex w-full items-center justify-between gap-2">
            {t("claudeProfiles.mapping")}
            <span className={`${SECTION_ACTION_GAP_CLASSES} flex-wrap`}>
              <Button
                disabled={
                  disabled ||
                  !profile.models.roles[profile.models.defaultRole].model
                }
                onClick={() => {
                  const entry =
                    profile.models.roles[profile.models.defaultRole];
                  const next = { ...profile.models.roles };
                  for (const role of MAIN_ROLES)
                    next[role] = {
                      ...entry,
                      context1m: role === "haiku" ? false : entry.context1m,
                    };
                  if (profile.target === "claude_code")
                    next.subagent = { ...entry, displayName: "" };
                  onChange({
                    ...profile,
                    models: { ...profile.models, roles: next },
                  });
                }}
              >
                {t("claudeProfiles.useOne")}
              </Button>
              <Button
                disabled={disabled || !profile.keyId || !profile.endpoint}
                onClick={onFetch}
              >
                {t("claudeProfiles.fetchModels")}
              </Button>
            </span>
          </span>
        }
        layout="vertical"
      >
        <datalist id={listId}>
          {models.map((model) => (
            <option key={model} value={model} />
          ))}
        </datalist>
        {/* The rule sits under the heading and its actions, fencing off the
            table itself rather than the whole block. */}
        <SettingsTable<ClaudeRole>
          columns={columns}
          rows={roles}
          getRowKey={(role) => role}
          dense
          noPx
        />
      </SectionRow>
    </>
  );
}
