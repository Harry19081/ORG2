import React from "react";

/** Pending GitHub check marker, centered in the same space as a check icon. */
export default function CiPendingDot({
  size = 15,
  className = "",
}: {
  size?: number;
  className?: string;
}): React.ReactNode {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${className}`.trim()}
      style={{ width: size, height: size }}
      aria-hidden
      data-icon="pending-dot"
    >
      <span className="h-1.5 w-1.5 animate-agent-pulse rounded-full bg-warning-6 motion-reduce:animate-none" />
    </span>
  );
}
