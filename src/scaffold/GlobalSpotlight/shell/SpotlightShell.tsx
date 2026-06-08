/**
 * SpotlightShell Component
 *
 * The ONE and ONLY visual chrome for the spotlight family. Owns:
 *  - Simple panel chrome
 *  - Portal + backdrop + viewport-centered positioning
 *  - Keyboard-hint footer below the panel
 *  - Focus refocus on background click
 *
 * Palettes are pure content: they render their search bar / list / slots
 * inside this shell via children, and may inject a right-side footer action
 * pill via ShellFooterAction.
 *
 * All palettes share the same width and portal behavior — no per-palette
 * styling. Callers cannot override these; variation lives only in palette
 * content.
 */
import React, { useCallback, useMemo, useRef } from "react";

import { SpotlightFooter, type SpotlightFooterActiveChip } from "../components";
import { SPOTLIGHT_CONFIG } from "../constants";
import { SpotlightShellChrome } from "./SpotlightShellChrome";
import {
  type FooterActionSlot,
  SpotlightFooterActionContext,
} from "./footerActionContext";

// ============ TYPES ============

export interface SpotlightShellProps {
  isOpen: boolean;
  onClose: () => void;
  /** Whether to render into a body portal (vs inline in parent tree). */
  asPortal?: boolean;
  /** Whether clicking the panel stops click propagation (for modal-inside-modal). */
  stopPropagation?: boolean;
  /** Palette-declared footer state. */
  hasActiveAction?: boolean;
  /**
   * Chip shown in the footer when {@link hasActiveAction} is true. Defaults
   * to the historical "Backspace + Back" drill-in chip; two-column palettes
   * pass `"switchColumn"`, and pinned-section palettes pass `"switchSection"`.
   */
  activeActionChip?: SpotlightFooterActiveChip;
  /** Hide the keyboard-hints footer entirely (used by pure-input palettes). */
  hideFooter?: boolean;
  children: React.ReactNode;
}

// ============ COMPONENT ============

export const SpotlightShell: React.FC<SpotlightShellProps> = ({
  isOpen,
  onClose,
  asPortal = true,
  stopPropagation = false,
  hasActiveAction = false,
  activeActionChip,
  hideFooter = false,
  children,
}) => {
  // Tiny external store so palette-level ShellFooterAction components can
  // subscribe to the host element without ref-in-render or effect dances.
  const hostRef = useRef<HTMLDivElement | null>(null);
  const listenersRef = useRef<Set<() => void>>(new Set());

  const notify = useCallback(() => {
    listenersRef.current.forEach((cb) => cb());
  }, []);

  const setHostEl = useCallback(
    (el: HTMLDivElement | null) => {
      if (hostRef.current === el) return;
      hostRef.current = el;
      notify();
    },
    [notify]
  );

  const slot = useMemo<FooterActionSlot>(
    () => ({
      subscribe: (cb) => {
        listenersRef.current.add(cb);
        return () => {
          listenersRef.current.delete(cb);
        };
      },
      getSnapshot: () => hostRef.current,
    }),
    []
  );

  const footer = hideFooter ? null : (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="flex items-center justify-center gap-3">
        <SpotlightFooter
          hasActiveAction={hasActiveAction}
          activeActionChip={activeActionChip}
        />
        <div ref={setHostEl} className="flex items-center" />
      </div>
    </div>
  );

  return (
    <SpotlightFooterActionContext.Provider value={slot}>
      <SpotlightShellChrome
        isOpen={isOpen}
        onClose={onClose}
        asPortal={asPortal}
        stopPropagation={stopPropagation}
        width={SPOTLIGHT_CONFIG.width}
        footer={footer}
      >
        {children}
      </SpotlightShellChrome>
    </SpotlightFooterActionContext.Provider>
  );
};

export default SpotlightShell;
