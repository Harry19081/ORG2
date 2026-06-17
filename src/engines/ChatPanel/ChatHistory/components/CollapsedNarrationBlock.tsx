/**
 * CollapsedNarrationBlock
 *
 * Renders mid-turn assistant narration (the "Now let me…" / "Next I'll…" lines
 * the SDE prompt mandates between tool calls) inside a collapsible, de-emphasised
 * think-style block in the MAIN CHAT only. The block is collapsed by default and
 * shows a one-line preview in the header so the step-by-step narration doesn't
 * read as loud final prose, while the turn's actual conclusion (the last
 * assistant message, which has no following tool call) keeps full brightness.
 *
 * Mirrors the collapse chrome of the ThinkingEvent chat variant so the two read
 * as the same class of "reasoning trace" content.
 */
import React from "react";

import Markdown from "@src/components/MarkDown";
import { getEventIcon } from "@src/config/toolIcons";
import {
  EventBlockHeader,
  EventBlockHeaderIcon,
  EventBlockHeaderTitle,
  getEventBlockContainerClasses,
  getEventBlockContentClasses,
  useEventBlockHeader,
} from "@src/engines/ChatPanel/blocks/primitives";

export interface CollapsedNarrationBlockProps {
  content: string;
}

/** One-line, length-capped preview shown in the collapsed header. */
function buildPreview(content: string): string {
  const firstLine = content
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  const preview = (firstLine ?? content).trim();
  return preview.length > 120 ? `${preview.slice(0, 117)}…` : preview;
}

const CollapsedNarrationBlock: React.FC<CollapsedNarrationBlockProps> = ({
  content,
}) => {
  const {
    isCollapsed,
    isHeaderHovered,
    handleHeaderClick,
    handleHeaderMouseEnter,
    handleHeaderMouseLeave,
  } = useEventBlockHeader({
    defaultCollapsed: true,
    collapseAllValue: true,
  });

  const preview = buildPreview(content);

  return (
    <div className={getEventBlockContainerClasses(false)}>
      <EventBlockHeader
        isCollapsed={isCollapsed}
        withHover={false}
        onClick={handleHeaderClick}
        onMouseEnter={handleHeaderMouseEnter}
        onMouseLeave={handleHeaderMouseLeave}
      >
        <EventBlockHeaderIcon
          icon={getEventIcon("thinking")}
          isCollapsed={isCollapsed}
          isHeaderHovered={isHeaderHovered}
          onToggle={handleHeaderClick}
          hasContent={true}
        />
        <EventBlockHeaderTitle>
          <span className="text-text-3">{preview}</span>
        </EventBlockHeaderTitle>
      </EventBlockHeader>

      {!isCollapsed && (
        <div className="ml-[14px] border-l border-border-1 py-0.5">
          <div
            className={`pl-3 ${getEventBlockContentClasses({ padding: "p-0" })}`}
          >
            <div className="activity-thinking activity-thinking--no-style allow-select">
              <div className="activity-thinking__content allow-select">
                <Markdown textContent={content} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

CollapsedNarrationBlock.displayName = "CollapsedNarrationBlock";

export default CollapsedNarrationBlock;
