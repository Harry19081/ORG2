/**
 * WorkstationRailSubmenu — the second-level panel a rail section's "load
 * more" row opens (Subagents, Sources): its open/close state, geometry, and
 * portaled panel shell.
 *
 * The panel is portaled to `document.body`, so it escapes both the wide
 * trail's scroll container and the compact menu's overflow clipping. Unlike
 * the shared right-preferring submenu geometry, it opens on the LEFT of its
 * list and reuses that list's width: the trail lives on the pane's right
 * edge, where every other trail popup (tooltips, the branch switcher) already
 * opens leftward. Vertical fitting still goes through `clampSubmenuTop`. The
 * compact menu keeps itself open while the pointer is inside this panel via
 * the Dropdown `additionalInsideRefs` contract.
 */
import type React from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { DropdownPanel } from "@src/components/Dropdown/exports";
import { subscribeToDropdownOutsideMouseDown } from "@src/components/Dropdown/outsideClick";
import {
  type SubmenuAnchor,
  clampSubmenuTop,
} from "@src/components/Dropdown/submenuLayout";
import {
  DROPDOWN_CLASSES,
  DROPDOWN_PANEL,
  DROPDOWN_WIDTHS,
} from "@src/components/Dropdown/tokens";

/**
 * Marks the container whose outer edge the submenu aligns to. Falls back to
 * the trigger row's own rect when no marked ancestor exists (the wide rail).
 */
export const WORKSTATION_SUBMENU_BOUNDS_ATTRIBUTE =
  "data-workstation-submenu-bounds";

interface SubmenuState {
  anchor: SubmenuAnchor;
  /** Panel width — the parent list's own width, so both levels read as one. */
  width: number;
  triggerElement: HTMLElement;
}

/**
 * Open/close state and geometry for the submenu. The trigger row calls
 * `toggle` with itself; outside mousedowns close the panel, except on the
 * trigger row, whose own click handles the toggle.
 */
export function useWorkstationRailSubmenu() {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<SubmenuState | null>(null);

  const close = useCallback(() => setState(null), []);

  const toggle = useCallback((trigger: HTMLElement) => {
    setState((current) => {
      if (current) return null;
      const triggerRect = trigger.getBoundingClientRect();
      const boundsRect =
        trigger
          .closest(`[${WORKSTATION_SUBMENU_BOUNDS_ATTRIBUTE}]`)
          ?.getBoundingClientRect() ?? null;
      const horizontalBounds = boundsRect ?? triggerRect;
      const width = horizontalBounds.width || DROPDOWN_WIDTHS.panelWidth;
      // Left of the list, mirroring every other popup on the pane's right
      // edge; only a list flush against the window's left edge flips right.
      const leftSideLeft =
        horizontalBounds.left - width - DROPDOWN_PANEL.submenuGap;
      const left =
        leftSideLeft < DROPDOWN_PANEL.viewportPadding
          ? horizontalBounds.right + DROPDOWN_PANEL.submenuGap
          : leftSideLeft;
      return {
        anchor: {
          left,
          opensUpward: false,
          parentTop: boundsRect?.top ?? DROPDOWN_PANEL.viewportPadding,
          parentBottom:
            boundsRect?.bottom ??
            window.innerHeight - DROPDOWN_PANEL.viewportPadding,
          // Pull up by the panel padding so the first submenu row lines up
          // with the row that opened it.
          top: Math.max(
            DROPDOWN_PANEL.viewportPadding,
            triggerRect.top - DROPDOWN_PANEL.padding
          ),
        },
        width,
        triggerElement: trigger,
      };
    });
  }, []);

  // The panel's real height is only known once it has rendered, so the
  // anchor's preferred top is corrected here rather than on open.
  useLayoutEffect(() => {
    if (!state || !panelRef.current) return;
    const { height: submenuHeight } = panelRef.current.getBoundingClientRect();
    const clampedTop = clampSubmenuTop({
      anchor: state.anchor,
      submenuHeight,
      viewportHeight: window.innerHeight,
    });
    if (clampedTop === state.anchor.top) return;
    setState((current) =>
      current
        ? { ...current, anchor: { ...current.anchor, top: clampedTop } }
        : current
    );
  }, [state]);

  useEffect(() => {
    if (!state) return;
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target)) return;
      if (state.triggerElement.contains(target)) return;
      close();
    };
    return subscribeToDropdownOutsideMouseDown(document, handleMouseDown);
  }, [close, state]);

  return {
    anchor: state?.anchor ?? null,
    close,
    panelRef,
    toggle,
    width: state?.width ?? DROPDOWN_WIDTHS.panelWidth,
  };
}

export function WorkstationRailSubmenuPanel({
  anchor,
  ariaLabel,
  children,
  panelRef,
  testId,
  width,
}: {
  anchor: SubmenuAnchor;
  ariaLabel: string;
  children: React.ReactNode;
  panelRef: React.RefObject<HTMLDivElement | null>;
  testId: string;
  /** Same width as the list the panel opened from. */
  width: number;
}) {
  return createPortal(
    <DropdownPanel
      ref={panelRef}
      className="fixed"
      width={width}
      style={{ top: anchor.top, left: anchor.left }}
      role="menu"
      aria-label={ariaLabel}
      data-testid={testId}
    >
      <div className={DROPDOWN_CLASSES.itemsColumnPadded}>{children}</div>
    </DropdownPanel>,
    document.body
  );
}
