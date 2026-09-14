/**
 * PanelSectionHeader Component
 *
 * A simple, reusable header for panel sections.
 * Follows the same styling as CollapsibleSection header but without collapse functionality.
 *
 * Used for: section headers in DevTools, Browser panels, etc.
 */
import React, { memo } from "react";

import { SidebarSectionHeader } from "@src/components/SidebarSectionHeader";

// ============================================
// Types
// ============================================

export interface PanelSectionHeaderProps {
  /** Header title */
  title: string;
  /** Action buttons for the header (shown on hover by default) */
  actions?: React.ReactNode;
  actionsAlwaysVisible?: boolean;
  /** Whether to show border at the bottom */
  showBorder?: boolean;
  /** Optional loading indicator */
  loading?: boolean;
}

// ============================================
// Main Component
// ============================================

export const PanelSectionHeader: React.FC<PanelSectionHeaderProps> = memo(
  ({
    title,
    actions,
    actionsAlwaysVisible = false,
    showBorder = true,
    loading = false,
  }) => {
    return (
      <SidebarSectionHeader
        surface="panel"
        title={title}
        loading={loading}
        actions={actions}
        actionsAlwaysVisible={actionsAlwaysVisible}
        className={showBorder ? "border-b border-border-1" : ""}
      />
    );
  }
);

PanelSectionHeader.displayName = "PanelSectionHeader";

export default PanelSectionHeader;
