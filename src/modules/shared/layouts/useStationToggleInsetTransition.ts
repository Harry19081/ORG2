import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";

import { effectiveChatPanelMaximizedAtom } from "@src/store/chatPanel/chatPanelLayoutAtoms";

import { CHROME_INSET_TRANSITION_CLASSES } from "./viewContainerTokens";

/**
 * How long the inset transition stays on after a station opens or closes: the
 * 200ms pane transition plus headroom for the frame that starts it, so the
 * class is never removed while the padding is still moving.
 */
export const STATION_TOGGLE_INSET_TRANSITION_MS = 320;

interface StationToggleState {
  stationOpen: boolean;
  /** Increments on every open or close; a timer only ends its own toggle. */
  toggle: number;
  animating: boolean;
}

/**
 * Transition classes for a header row that reserves inset under the window's
 * pinned chrome, applied only while a station (My Station or Agent Station)
 * opens or closes.
 *
 * Opening or closing a station slides the panes on the shared pane
 * transition, so the reserved inset has to travel with them. Every other
 * reservation change happens inside a station that stays open — switching
 * tabs or sessions shows or hides the pinned group — and there the inset
 * must snap, or header controls glide on each tab change.
 *
 * The class lands in the same render as the new inset (state is adjusted
 * during render) because a CSS transition takes its timing from the
 * after-change style.
 */
export function useStationToggleInsetTransition(): string {
  const stationOpen = !useAtomValue(effectiveChatPanelMaximizedAtom);
  const [state, setState] = useState<StationToggleState>(() => ({
    stationOpen,
    toggle: 0,
    animating: false,
  }));

  if (state.stationOpen !== stationOpen) {
    setState({ stationOpen, toggle: state.toggle + 1, animating: true });
  }

  const { animating, toggle } = state;
  useEffect(() => {
    if (!animating) return undefined;
    const timer = setTimeout(() => {
      setState((current) =>
        current.toggle === toggle ? { ...current, animating: false } : current
      );
    }, STATION_TOGGLE_INSET_TRANSITION_MS);
    return () => clearTimeout(timer);
  }, [animating, toggle]);

  return animating ? CHROME_INSET_TRANSITION_CLASSES : "";
}
