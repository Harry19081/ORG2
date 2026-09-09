import { formatClockTime } from "@src/util/time/formatClockTime";

export interface TurnTimingLabels {
  duration: string;
  startClock: string;
  endClock: string;
  showRange: boolean;
}

/**
 * Compact spoken duration: `5m 5s`, `5m`, or `42s`. Missing/zero durations
 * (e.g. imported transcripts that carry no timestamps) read as `<1min`
 * rather than a broken-looking `0s`.
 */
export function formatTurnDuration(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return "<1min";
  const totalSeconds = Math.round(durationMs / 1000);
  if (totalSeconds === 0) return "<1min";
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
}

export function getTurnTimingLabels(
  durationMs: number,
  startMs: number | null,
  endMs: number | null
): TurnTimingLabels {
  const startClock = startMs !== null ? formatClockTime(startMs) : "";
  const endClock = endMs !== null ? formatClockTime(endMs) : "";
  return {
    duration: formatTurnDuration(durationMs),
    startClock,
    endClock,
    showRange:
      startClock !== "" &&
      endClock !== "" &&
      startMs !== null &&
      endMs !== null &&
      endMs - startMs >= 1000,
  };
}
