import React, { forwardRef } from "react";
import type { Components } from "react-virtuoso";

type ChatScrollerComponent = NonNullable<Components["Scroller"]>;

const MANUAL_SCROLL_DELTA_SCALE = 0.55;
const WHEEL_LINE_HEIGHT_PX = 16;

interface ChatScrollerProps {
  virtuosoScrollerRef: React.MutableRefObject<HTMLElement | null>;
}

/**
 * Custom Virtuoso Scroller component. Hides the native scrollbar and wires
 * an external ref so scroll-pin logic can attach event listeners directly.
 */
export function createChatScroller(
  virtuosoScrollerRef: React.MutableRefObject<HTMLElement | null>
): ChatScrollerComponent {
  const Component = forwardRef<
    HTMLDivElement,
    React.ComponentProps<ChatScrollerComponent>
  >(function ChatScrollerInstance(props, forwardedRef) {
    const { context: _context, onWheel, ...restProps } = props;
    const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
      onWheel?.(event);
      if (event.defaultPrevented) return;

      const deltaY =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? event.deltaY * WHEEL_LINE_HEIGHT_PX
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? event.deltaY * event.currentTarget.clientHeight
            : event.deltaY;

      event.preventDefault();
      event.currentTarget.scrollTop += deltaY * MANUAL_SCROLL_DELTA_SCALE;
    };

    return (
      <div
        {...restProps}
        className="scrollbar-hide"
        onWheel={handleWheel}
        ref={(node) => {
          virtuosoScrollerRef.current = node;
          if (typeof forwardedRef === "function") {
            forwardedRef(node);
          } else if (forwardedRef) {
            forwardedRef.current = node;
          }
        }}
      />
    );
  });
  Component.displayName = "ChatScroller";
  return Component;
}

export type { ChatScrollerProps };
