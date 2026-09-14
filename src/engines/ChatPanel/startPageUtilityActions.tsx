import type { TFunction } from "i18next";

import type { LaunchpadAction } from "@src/features/SessionCreator/components/LaunchpadActionGrid";
import {
  Coins01Icon,
  Download01Icon,
  HugeiconsIcon,
  ImportIcon,
  Key02Icon,
} from "@src/icons";

interface StartPageUtilityActionsOptions {
  availableUpdate: { available: boolean } | null;
  onAddApiKey: () => void;
  onInstallLatestUpdate: () => void;
  setIsImportSessionDialogOpen: (open: boolean) => void;
  setIsQuotaModalOpen: (open: boolean) => void;
  t: TFunction<["sessions", "common", "projects", "navigation"]>;
}

/** Launchpad quick actions, with the install action first when an update is available. */
export function buildStartPageUtilityActions({
  availableUpdate,
  onAddApiKey,
  onInstallLatestUpdate,
  setIsImportSessionDialogOpen,
  setIsQuotaModalOpen,
  t,
}: StartPageUtilityActionsOptions): LaunchpadAction[] {
  const importSessionAction: LaunchpadAction = {
    id: "import-session",
    title: t("navigation:cloud.share.importEntry"),
    icon: (
      <HugeiconsIcon
        icon={ImportIcon}
        data-icon="import"
        size={16}
        strokeWidth={1.8}
      />
    ),
    onClick: () => setIsImportSessionDialogOpen(true),
    tone: "neutral",
  };
  const addApiKeyAction: LaunchpadAction = {
    id: "add-api-key",
    title: t("chat.startPage.addApiKey.title"),
    icon: (
      <HugeiconsIcon
        icon={Key02Icon}
        data-icon="key-round"
        size={16}
        strokeWidth={1.8}
      />
    ),
    onClick: onAddApiKey,
    tone: "neutral",
  };
  const showQuotaAction: LaunchpadAction = {
    id: "show-quota",
    title: t("chat.startPage.showQuota.title"),
    icon: (
      <HugeiconsIcon
        icon={Coins01Icon}
        data-icon="coins"
        size={16}
        strokeWidth={1.8}
      />
    ),
    onClick: () => setIsQuotaModalOpen(true),
    tone: "neutral",
  };
  return availableUpdate?.available
    ? [
        {
          id: "install-latest-update",
          title: t("chat.startPage.installLatestUpdate.title"),
          icon: (
            <HugeiconsIcon
              icon={Download01Icon}
              data-icon="download"
              size={16}
              strokeWidth={1.8}
            />
          ),
          onClick: onInstallLatestUpdate,
          tone: "warning",
        },
        importSessionAction,
        addApiKeyAction,
        showQuotaAction,
      ]
    : [importSessionAction, addApiKeyAction, showQuotaAction];
}
