import type { ButtonHTMLAttributes } from "react";

import Button from "@src/components/Button";
import { BUTTON_SIZE } from "@src/config/workstation/tokens";
import { HugeiconsIcon, StopIcon } from "@src/icons";

interface ProcessStopButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> {
  label: string;
  size?: keyof typeof BUTTON_SIZE;
  loading?: boolean;
}

/** Shared process termination affordance, matching the server watcher. */
export function ProcessStopButton({
  label,
  size = "md",
  loading = false,
  disabled,
  className = "",
  onClick,
  ...props
}: ProcessStopButtonProps) {
  return (
    <Button
      variant="danger"
      appearance="soft-no-drop"
      size={size === "sm" ? "sidebar" : size === "lg" ? "small" : "mini"}
      iconOnly
      icon={
        <HugeiconsIcon icon={StopIcon} data-icon="stop" size={14} aria-hidden />
      }
      {...props}
      htmlType="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      loading={loading}
      className={`shrink-0 ${className}`}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.(event);
      }}
    />
  );
}
