/**
 * SpotlightConfirmationView Component
 *
 * Renders the confirmation page for actions without modals
 * Separated from main component for better maintainability
 */
import React from "react";
import { useTranslation } from "react-i18next";

import AnyIcon from "@src/components/AnyIcon";
import Button from "@src/components/Button";
import type { IconSvgElement } from "@src/icons";

import type { UseConfirmationPageReturn } from "../hooks/core/types";

// ============================================
// Types
// ============================================

type ConfirmationParameter = {
  label: string;
  value: string;
  icon?: string | IconSvgElement | React.ComponentType<Record<string, unknown>>;
};

interface SpotlightConfirmationViewProps {
  confirmationPage: UseConfirmationPageReturn;
}

// ============================================
// Component
// ============================================

export const SpotlightConfirmationView: React.FC<
  SpotlightConfirmationViewProps
> = ({ confirmationPage }) => {
  const { t } = useTranslation();

  if (
    !confirmationPage.showConfirmation ||
    !confirmationPage.confirmationData
  ) {
    return null;
  }

  const { actionLabel, actionIcon, parameters } =
    confirmationPage.confirmationData;

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Action Header */}
      <div className="flex items-center gap-3">
        {/* Every action definition carries glyph data (or a component);
            AnyIcon renders both shapes safely. */}
        <AnyIcon icon={actionIcon} size={24} className="text-primary-6" />
        <h2 className="text-[20px] font-semibold text-text-1">{actionLabel}</h2>
      </div>

      {/* Parameters */}
      <div className="flex flex-col gap-2 rounded-lg bg-fill-1 p-4">
        {parameters.map((param: ConfirmationParameter, idx: number) => (
          <div key={idx} className="flex items-center gap-2">
            <span className="text-[14px] text-text-2">{param.label}:</span>
            <span className="text-[14px] font-medium text-text-1">
              {param.value}
            </span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="secondary"
          appearance="outline"
          size="mini"
          onClick={confirmationPage.back}
          className="gap-2 text-[14px] hover:bg-fill-1"
        >
          ← {t("actions.back")}
        </Button>
        <Button
          variant="primary"
          appearance="solid"
          size="default"
          onClick={confirmationPage.confirm}
          className="gap-2 text-[14px] text-text-white hover:bg-primary-5"
        >
          {actionLabel} →
        </Button>
      </div>
    </div>
  );
};

export default SpotlightConfirmationView;
