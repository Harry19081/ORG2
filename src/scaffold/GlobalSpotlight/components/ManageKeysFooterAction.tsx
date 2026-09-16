import { ACTION_ID } from "@src/ActionSystem";
import { buildIntegrationsPath } from "@src/config/mainAppPaths";

import { SpotlightNavigationFooterAction } from "./SpotlightNavigationFooterAction";

export function ManageKeysFooterAction({ onClose }: { onClose: () => void }) {
  return (
    <SpotlightNavigationFooterAction
      onClose={onClose}
      labelKey="selectors.spotlightFooter.manageKeys"
      actionId={ACTION_ID.APP_GO_TO_MODEL_KEYS}
      fallbackPath={`${buildIntegrationsPath({ category: "models" })}?modelsTab=my-accounts`}
    />
  );
}
