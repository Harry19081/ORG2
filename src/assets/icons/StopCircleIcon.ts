// This barrel-backed customization needs the vendor glyph AND the vendor type
// to avoid importing itself: `@src/icons` re-exports this module, so taking
// either from the barrel makes the two a cycle. The barrel re-exports
// `IconSvgElement` straight from `@hugeicons/react`, so this is the same type.
// eslint-disable-next-line no-restricted-imports
import StopCircleOutlineIcon from "@hugeicons/core-free-icons/StopCircleIcon";
// eslint-disable-next-line no-restricted-imports
import type { IconSvgElement } from "@hugeicons/react";

/** Keep the outer ring outlined and fill the central stop square app-wide. */
const StopCircleIcon: IconSvgElement = StopCircleOutlineIcon.map(
  ([element, attributes]) => [
    element,
    element === "path" ? { ...attributes, fill: "currentColor" } : attributes,
  ]
);

export default StopCircleIcon;
