/**
 * CollapsedInlineRow
 *
 * Horizontal row of pill-shaped buttons — one per active ComposerStack section
 * (queue, processes, file changes). Always visible when any section has data.
 * Clicking a pill expands that section's card above.
 *
 * Also renders the follow-agent action pill immediately after the section pills.
 *
 * Each pill shows icon + numeric count only. gap-1 between pills.
 */
import React, { memo } from "react";

import Button from "@src/components/Button";
import { KeyboardShortcutTooltipContent } from "@src/components/KeyboardShortcut";
import Tooltip from "@src/components/Tooltip";

import type { ScrollNavState } from "../../ChatHistory";

export interface InlineSection {
  key: string;
  icon: React.ReactNode;
  count: number;
  active: boolean;
  onExpand: () => void;
  /** When set, renders this text instead of the numeric count. */
  label?: string;
  /** "primary" renders in primary-6 — used for question/permission/modeswitch pills */
  variant?: "default" | "primary";
  /** When true, only the icon is shown (no count or label). */
  iconOnly?: boolean;
  /** Optional custom content rendered after the leading icon. */
  content?: React.ReactNode;
  /** Stable selector for rendered UI E2E coverage. */
  testId?: string;
}

export interface CollapsedInlineRowProps {
  sections: InlineSection[];
  scrollNav?: ScrollNavState | null;
}

function renderSectionContent(section: InlineSection) {
  if (section.iconOnly) return null;
  if (section.content) return section.content;
  return section.label ?? section.count;
}

function getButtonClassName(section: InlineSection) {
  const activeClassName = section.active ? "!bg-fill-1 !text-primary-6" : "";
  const primaryClassName =
    section.variant === "primary" ? "!border-primary-5 !text-primary-6" : "";
  return `${activeClassName} ${primaryClassName}`.trim();
}

const CollapsedInlineRow: React.FC<CollapsedInlineRowProps> = memo(
  ({ sections, scrollNav }) => {
    const showFollowAgent = scrollNav?.showFollowAgent ?? false;

    if (sections.length === 0 && !showFollowAgent) return null;

    return (
      <div className="flex items-center gap-1 px-0.5">
        {sections.map((section) => (
          <Button
            key={section.key}
            variant="secondary"
            appearance="outline"
            size="small"
            shape="round"
            icon={section.icon}
            iconOnly={section.iconOnly}
            onClick={section.onExpand}
            data-testid={section.testId}
            className={getButtonClassName(section)}
          >
            {renderSectionContent(section)}
          </Button>
        ))}

        {showFollowAgent && (
          <Tooltip
            content={
              <KeyboardShortcutTooltipContent
                label={scrollNav!.followAgentTooltipLabel}
                shortcut={scrollNav!.followAgentShortcut || undefined}
              />
            }
            position="top"
            mouseEnterDelay={250}
            framedPanel
          >
            <span className="inline-flex">
              <Button
                variant="secondary"
                appearance="outline"
                size="small"
                shape="round"
                onClick={scrollNav!.onFollowAgent}
                aria-label={scrollNav!.followAgentTooltipLabel}
              >
                {scrollNav!.followAgentLabel}
              </Button>
            </span>
          </Tooltip>
        )}
      </div>
    );
  }
);

CollapsedInlineRow.displayName = "CollapsedInlineRow";

export default CollapsedInlineRow;
