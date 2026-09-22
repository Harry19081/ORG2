/**
 * My Roles → Status → Custom statuses.
 *
 * The three built-in statuses (Online / Invisible / Away) are fixed
 * records; everything below them is user-authored. A custom status is a
 * `CustomRoleDefinition` persisted in `userCustomRolesAtom` and surfaced
 * as a `role:<id>` presence mode in the status picker above, the sidebar
 * presence pill, and the ADE context payload.
 *
 * Each status renders as its own `SectionContainer`, the same shape the
 * built-in three use, so the container draws the row separators and the
 * tab stays one flat stack of cards. Each exposes the fields a built-in
 * exposes — guidance plus the four runtime-policy knobs — with the stance
 * selectable, because a custom status has no preset semantics to lock it
 * to.
 */
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import React, { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import Button from "@src/components/Button";
import DeleteIconButton from "@src/components/Button/DeleteIconButton";
import IconPicker, { type IconPickerOption } from "@src/components/IconPicker";
import Input from "@src/components/Input";
import NumberInput from "@src/components/NumberInput";
import Select, { type SelectOption } from "@src/components/Select";
import Switch from "@src/components/Switch";
import Textarea from "@src/components/Textarea";
import {
  SECTION_ACTION_GAP_CLASSES,
  SECTION_CONTROL_STYLE,
  SectionContainer,
  SectionRow,
} from "@src/components/layout/Section";
import { Add01Icon, HugeiconsIcon } from "@src/icons";
import {
  CUSTOM_ROLE_ICON_IDS,
  resolveCustomRoleIcon,
} from "@src/scaffold/NavigationSidebar/blocks/customRoleIcons";
import {
  userPresenceAtom,
  userPresenceModeAtom,
} from "@src/store/user/userPresenceAtom";
import {
  generateRoleId,
  userCustomRolesAtom,
} from "@src/store/user/userRolesAtom";
import {
  type CustomRoleDefinition,
  type CustomRoleIconId,
  PRESENCE_STANCE,
  type PresenceStance,
  USER_PRESENCE_MODE,
  buildCustomRoleMode,
} from "@src/types/userPresence";
import { confirmDestructiveAction } from "@src/util/dialogs/confirmDestructiveAction";

export const MyRolesCustomStatusesSection: React.FC = () => {
  const { t } = useTranslation(["settings", "navigation"]);
  const [customRoles, setCustomRoles] = useAtom(userCustomRolesAtom);
  const activeMode = useAtomValue(userPresenceModeAtom);
  const setPresence = useSetAtom(userPresenceAtom);

  const fallbackLabel = t("myRoles.custom.defaultLabel");

  // Ids are plain English words, so they double as the picker's search text.
  const iconOptions = useMemo<IconPickerOption[]>(
    () =>
      CUSTOM_ROLE_ICON_IDS.map((id) => ({
        id,
        icon: resolveCustomRoleIcon(id),
      })),
    []
  );

  const stanceOptions = useMemo<SelectOption[]>(
    () => [
      {
        value: PRESENCE_STANCE.INTERACTIVE,
        label: t("myRoles.custom.stanceInteractive"),
      },
      {
        value: PRESENCE_STANCE.DEFER_AND_BATCH,
        label: t("myRoles.custom.stanceDeferAndBatch"),
      },
      {
        value: PRESENCE_STANCE.AUTONOMOUS,
        label: t("myRoles.custom.stanceAutonomous"),
      },
    ],
    [t]
  );

  const handleAdd = useCallback(() => {
    const taken = new Set(customRoles.map((role) => role.id));
    const next: CustomRoleDefinition = {
      id: generateRoleId(fallbackLabel, taken),
      label: fallbackLabel,
      iconId: "sparkles",
      guidance: "",
      createdAtMs: Date.now(),
      stance: PRESENCE_STANCE.INTERACTIVE,
      questionAutoResolveSecs: 0,
      planAutoApproveSecs: 0,
      modeSwitchAutoPlan: false,
      goalMaxTurns: 0,
    };
    setCustomRoles((prev) => [...prev, next]);
  }, [customRoles, fallbackLabel, setCustomRoles]);

  const handleChange = useCallback(
    (id: string, patch: Partial<CustomRoleDefinition>) => {
      setCustomRoles((prev) =>
        prev.map((role) => (role.id === id ? { ...role, ...patch } : role))
      );
    },
    [setCustomRoles]
  );

  const handleDelete = useCallback(
    async (role: CustomRoleDefinition) => {
      const confirmed = await confirmDestructiveAction({
        title: t("myRoles.custom.deleteTitle"),
        message: t("myRoles.custom.deleteMessage", { name: role.label }),
        okLabel: t("myRoles.custom.deleteConfirm"),
        cancelLabel: t("myRoles.custom.deleteCancel"),
      });
      if (!confirmed) return;

      setCustomRoles((prev) =>
        prev.filter((existing) => existing.id !== role.id)
      );
      // A deleted status must not stay selected: the presence wire would
      // resolve `role:<id>` to nothing and the sidebar pill would render
      // "Unknown role" until the user noticed.
      if (buildCustomRoleMode(role.id) === activeMode) {
        setPresence({
          mode: USER_PRESENCE_MODE.ONLINE,
          backAtMs: undefined,
          awayDurationLabel: undefined,
        });
      }
    },
    [activeMode, setCustomRoles, setPresence, t]
  );

  return (
    <>
      <SectionContainer>
        <SectionRow
          label={t("myRoles.custom.title")}
          description={t("myRoles.custom.description")}
        >
          <Button
            icon={<HugeiconsIcon icon={Add01Icon} data-icon="plus" size={14} />}
            onClick={handleAdd}
          >
            {t("myRoles.custom.add")}
          </Button>
        </SectionRow>
      </SectionContainer>

      {customRoles.map((role) => {
        const statusLabel = role.label.trim() || fallbackLabel;
        return (
          <SectionContainer key={role.id} title={statusLabel}>
            <SectionRow label={t("myRoles.custom.nameLabel")}>
              <Input
                value={role.label}
                onChange={(value) => handleChange(role.id, { label: value })}
                style={SECTION_CONTROL_STYLE}
                placeholder={t("myRoles.custom.namePlaceholder")}
              />
            </SectionRow>

            <SectionRow label={t("myRoles.custom.iconLabel")}>
              <IconPicker
                value={role.iconId}
                options={iconOptions}
                onChange={(iconId) =>
                  handleChange(role.id, { iconId: iconId as CustomRoleIconId })
                }
                ariaLabel={t("myRoles.custom.iconLabel")}
                searchPlaceholder={t("myRoles.custom.iconSearchPlaceholder")}
              />
            </SectionRow>

            <SectionRow
              label={t("myRoles.presence.instructionForAgent")}
              layout="vertical"
            >
              <Textarea
                value={role.guidance}
                onChange={(value) => handleChange(role.id, { guidance: value })}
                rows={3}
                placeholder={t("myRoles.custom.guidancePlaceholder")}
              />
            </SectionRow>

            <SectionRow
              label={t("myRoles.custom.stanceLabel")}
              description={t("myRoles.custom.stanceDesc")}
            >
              <Select
                value={role.stance ?? PRESENCE_STANCE.INTERACTIVE}
                onChange={(value) =>
                  handleChange(role.id, {
                    stance: String(value) as PresenceStance,
                  })
                }
                options={stanceOptions}
                style={SECTION_CONTROL_STYLE}
              />
            </SectionRow>

            <SectionRow
              label={t("sdeAgent.questionAutoSkipTimeoutByStatus", {
                status: statusLabel,
              })}
              description={t("sdeAgent.questionAutoSkipTimeoutByStatusDesc")}
            >
              <NumberInput
                value={role.questionAutoResolveSecs ?? 0}
                onValueChange={(value) =>
                  value !== undefined &&
                  handleChange(role.id, { questionAutoResolveSecs: value })
                }
                min={0}
                max={300}
                step={5}
                suffix={t("common:common.s")}
                controlsPosition="sides"
                style={SECTION_CONTROL_STYLE}
              />
            </SectionRow>

            <SectionRow
              label={t("sdeAgent.planAutoApproveTimeoutByStatus", {
                status: statusLabel,
              })}
              description={t("sdeAgent.planAutoApproveTimeoutByStatusDesc")}
            >
              <NumberInput
                value={role.planAutoApproveSecs ?? 0}
                onValueChange={(value) =>
                  value !== undefined &&
                  handleChange(role.id, { planAutoApproveSecs: value })
                }
                min={0}
                max={3600}
                step={10}
                suffix={t("common:common.s")}
                controlsPosition="sides"
                style={SECTION_CONTROL_STYLE}
              />
            </SectionRow>

            <SectionRow
              label={t("sdeAgent.goalMaxTurnsByStatus", {
                status: statusLabel,
              })}
              description={t("sdeAgent.goalMaxTurnsByStatusDesc")}
            >
              <NumberInput
                value={role.goalMaxTurns ?? 0}
                onValueChange={(value) =>
                  value !== undefined &&
                  handleChange(role.id, { goalMaxTurns: value })
                }
                min={0}
                max={100}
                step={1}
                controlsPosition="sides"
                style={SECTION_CONTROL_STYLE}
              />
            </SectionRow>

            <SectionRow
              label={t("sdeAgent.modeSwitchAutoPlanByStatus", {
                status: statusLabel,
              })}
              description={t("sdeAgent.modeSwitchAutoPlanByStatusDesc")}
            >
              <Switch
                checked={role.modeSwitchAutoPlan ?? false}
                onCheckedChange={(checked) =>
                  handleChange(role.id, { modeSwitchAutoPlan: checked })
                }
                ariaLabel={t("sdeAgent.modeSwitchAutoPlanByStatus", {
                  status: statusLabel,
                })}
              />
            </SectionRow>

            <SectionRow showHeader={false} className="flex justify-end">
              <div className={`${SECTION_ACTION_GAP_CLASSES} justify-end`}>
                <DeleteIconButton
                  iconOnly={false}
                  label={t("myRoles.custom.deleteConfirm")}
                  onDelete={() => void handleDelete(role)}
                />
              </div>
            </SectionRow>
          </SectionContainer>
        );
      })}
    </>
  );
};
