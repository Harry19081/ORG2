/**
 * GitDiffActionsMenu
 *
 * Dropdown content shown when the composer file-changes pill
 * (`composer-section-files` / `composer-section-git-artifacts`) is clicked.
 * Built from the shared Dropdown building blocks (`DropdownPanel`,
 * `DropdownItemGroup`, `DropdownItem`) so it matches the composer
 * MODE/SKILLS menu and `ModePill` visually and for a11y.
 *
 * Two groups:
 * - Git Actions: commit / commit & push (agent-driven) and push (direct git)
 * - Review: open the diff in My Station or Agent Station
 */
import { ArrowUp, Bot, GitCommit, LayoutPanelLeft, Upload } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";

import {
  DropdownItem,
  DropdownItemGroup,
  DropdownPanel,
} from "@src/components/Dropdown/exports";
import {
  DROPDOWN_CLASSES,
  DROPDOWN_ITEM,
  DROPDOWN_WIDTHS,
} from "@src/components/Dropdown/tokens";

export interface GitDiffActionsMenuProps {
  onCommit: () => void;
  onCommitPush: () => void;
  onPush: () => void;
  onViewMyStation: () => void;
  onViewAgentStation: () => void;
  /** Disables the agent-driven git actions (commit / commit & push / push) while the session is running. */
  gitActionsDisabled?: boolean;
  /** Injected by the Dropdown host so each action also closes the menu. */
  onClose?: () => void;
}

const ICON_SIZE = DROPDOWN_ITEM.iconSize;

const GitDiffActionsMenu: React.FC<GitDiffActionsMenuProps> = ({
  onCommit,
  onCommitPush,
  onPush,
  onViewMyStation,
  onViewAgentStation,
  gitActionsDisabled = false,
  onClose,
}) => {
  const { t } = useTranslation("sessions");

  const run = (action: () => void) => () => {
    action();
    onClose?.();
  };

  return (
    <DropdownPanel className={DROPDOWN_WIDTHS.menuClass}>
      <div className={DROPDOWN_CLASSES.itemsColumnPadded}>
        <DropdownItemGroup
          label={t("creator.diffMenu.gitActions", {
            defaultValue: "Git Actions",
          })}
        >
          <DropdownItem
            icon={<GitCommit size={ICON_SIZE} strokeWidth={1.75} />}
            disabled={gitActionsDisabled}
            onClick={run(onCommit)}
            dataTestId="git-diff-action-commit"
          >
            {t("creator.diffMenu.commit", { defaultValue: "commit" })}
          </DropdownItem>
          <DropdownItem
            icon={<Upload size={ICON_SIZE} strokeWidth={1.75} />}
            disabled={gitActionsDisabled}
            onClick={run(onCommitPush)}
            dataTestId="git-diff-action-commit-push"
          >
            {t("creator.diffMenu.commitPush", {
              defaultValue: "commit & push",
            })}
          </DropdownItem>
          <DropdownItem
            icon={<ArrowUp size={ICON_SIZE} strokeWidth={1.75} />}
            disabled={gitActionsDisabled}
            onClick={run(onPush)}
            dataTestId="git-diff-action-push"
          >
            {t("creator.diffMenu.push", { defaultValue: "push" })}
          </DropdownItem>
        </DropdownItemGroup>

        <div className={DROPDOWN_CLASSES.menuSeparatorInset} />

        <DropdownItemGroup
          label={t("creator.diffMenu.review", { defaultValue: "Review" })}
        >
          <DropdownItem
            icon={<LayoutPanelLeft size={ICON_SIZE} strokeWidth={1.75} />}
            onClick={run(onViewMyStation)}
            dataTestId="git-diff-action-view-my-station"
          >
            {t("creator.diffMenu.viewMyStation", {
              defaultValue: "View in my station",
            })}
          </DropdownItem>
          <DropdownItem
            icon={<Bot size={ICON_SIZE} strokeWidth={1.75} />}
            onClick={run(onViewAgentStation)}
            dataTestId="git-diff-action-view-agent-station"
          >
            {t("creator.diffMenu.viewAgentStation", {
              defaultValue: "View in Agent station",
            })}
          </DropdownItem>
        </DropdownItemGroup>
      </div>
    </DropdownPanel>
  );
};

GitDiffActionsMenu.displayName = "GitDiffActionsMenu";

export default GitDiffActionsMenu;
