import React, { useId, useState } from "react";
import { useTranslation } from "react-i18next";

import Button from "@src/components/Button";
import { formatTurnDuration } from "@src/engines/ChatPanel/ChatHistory/utils/turnTimingFormatting";
import { CHAT_ITEM_PADDING_X } from "@src/engines/ChatPanel/blocks/primitives/config";
import { ArrowRight01Icon, HugeiconsIcon } from "@src/icons";

import type { TranscriptRoundSummary } from "../../lib/transcriptLoadState";
import type { TranscriptItem } from "../../lib/transcriptReducer";
import { normalizeMobileToolLifecycle } from "./mobileToolPresentation";

interface MobileTurnBodyProps {
  items: TranscriptItem[];
  round?: TranscriptRoundSummary;
  busy: boolean;
  onBeforeToggle: () => void;
  renderItem: (item: TranscriptItem, index: number) => React.ReactNode;
}

function roundDuration(round: TranscriptRoundSummary): number | null {
  if (
    typeof round.durationMs === "number" &&
    Number.isFinite(round.durationMs) &&
    round.durationMs >= 0
  ) {
    return round.durationMs;
  }
  const start = Date.parse(round.startedAt ?? "");
  const end = Date.parse(round.endedAt ?? "");
  return Number.isFinite(start) && Number.isFinite(end) && end >= start
    ? end - start
    : null;
}

/** One selected round; the parent keys this local reading preference by scope. */
export function MobileTurnBody({
  items,
  round,
  busy,
  onBeforeToggle,
  renderItem,
}: MobileTurnBodyProps) {
  const { t } = useTranslation("mobileRemote");
  const bodyId = useId();
  const [expandedOverride, setExpandedOverride] = useState<boolean>();
  const firstBodyIndex = items.findIndex((item) => item.kind !== "user");
  const running =
    busy ||
    items.some(
      (item) =>
        item.streaming ||
        (item.kind === "tool" &&
          normalizeMobileToolLifecycle(item.toolStatus) === "running")
    );
  const terminal = ["completed", "failed", "cancelled", "interrupted"].includes(
    round?.status ?? ""
  );
  // A legacy snapshot may contain several rounds without directory metadata.
  // Do not fold those independent prompts under one round's timing label.
  const singleRound =
    firstBodyIndex >= 0 &&
    !items.slice(firstBodyIndex).some((item) => item.kind === "user");
  if (!round || !terminal || running || !singleRound) {
    return <>{items.map(renderItem)}</>;
  }

  let finalIndex = -1;
  for (let index = items.length - 1; index >= firstBodyIndex; index -= 1) {
    if (items[index].kind === "agent") {
      finalIndex = index;
      break;
    }
  }
  // Collapse is a reading preference for all work, including failed tools.
  // Keep only the final reply outside that preference; expanding restores the
  // original ordered items and their unchanged statuses/detail actions.
  const isPinned = (index: number) => index === finalIndex;
  const collapsible = items.some(
    (_, index) => index >= firstBodyIndex && !isPinned(index)
  );
  const expanded = expandedOverride ?? round.status !== "completed";
  const duration = roundDuration(round);
  const label =
    duration === null
      ? t("transcript.workSummary")
      : t("transcript.workedFor", { duration: formatTurnDuration(duration) });

  return (
    <>
      {items.slice(0, firstBodyIndex).map(renderItem)}
      <div className={`mobile-turn-summary ${CHAT_ITEM_PADDING_X}`}>
        {collapsible ? (
          // Compound disclosure aligns its label and trailing chevron across
          // the full transcript width; shared Button owns native semantics.
          <Button
            layout="custom"
            variant="tertiary"
            appearance="ghost"
            className="mobile-turn-summary__toggle flex w-full items-center justify-between gap-2 text-left focus-visible:outline-2 focus-visible:outline-primary-6"
            aria-expanded={expanded}
            aria-controls={bodyId}
            onClick={() => {
              onBeforeToggle();
              setExpandedOverride(!expanded);
            }}
          >
            <span>{label}</span>
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              size={16}
              aria-hidden
              className={expanded ? "rotate-90" : ""}
            />
          </Button>
        ) : (
          <div className="mobile-turn-summary__toggle flex items-center text-text-2">
            {label}
          </div>
        )}
        <div className="h-px bg-border-1" aria-hidden />
      </div>
      <div id={bodyId} data-mobile-turn-body>
        {items.map((item, index) =>
          index >= firstBodyIndex && (expanded || isPinned(index))
            ? renderItem(item, index)
            : null
        )}
      </div>
    </>
  );
}
