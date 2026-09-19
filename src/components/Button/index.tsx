/**
 * Button Component (Native Implementation)
 *
 * Three orthogonal axes describe a button's look:
 *
 *   variant     — importance
 *                 "primary"   = call-to-action, filled
 *                 "secondary" = regular action, outlined (default)
 *                 "tertiary"  = supporting / inline action, transparent with
 *                               a hover background
 *
 *   tone        — semantic color on top of the variant
 *                 "danger" | "warning" | "success" | "merged"
 *                 (hoverTone colors a neutral button only while hovered)
 *
 *   appearance  — visual treatment override
 *                 "solid"   = filled background
 *                 "outline" = bordered, transparent fill
 *                 "dashed"  = dashed border (typically for add/upload)
 *                 "soft"    = neutral or toned hover fill for compact actions
 *                 "soft-no-drop" = neutral hover for a transparent button layer
 *
 * A toggle is a tertiary with `aria-pressed`; the pressed state draws the
 * selected fill and primary text.
 *
 * Button's own utilities are emitted in a nested cascade layer (the `btn:`
 * variant), so any class passed through `className` overrides them.
 *
 * @example
 * ```tsx
 * import Button from "@src/components/Button";
 *
 * <Button variant="primary">Submit</Button>
 * <Button size="small">Cancel</Button>
 * <Button variant="primary" tone="danger">Delete</Button>
 * <Button variant="tertiary" tone="danger">Remove</Button>
 * <Button variant="tertiary">Inline action</Button>
 * <Button variant="tertiary" aria-pressed={on}>Aa</Button>
 * <Button variant="tertiary" appearance="soft" hoverTone="danger" iconOnly icon={<Trash />} />
 * <Button loading>Loading...</Button>
 * <Button variant="primary" icon={<Plus size={14} />}>Add</Button>
 * ```
 */
import React, { forwardRef } from "react";

import {
  type ButtonAppearance,
  type ButtonHoverTone,
  type ButtonShape,
  type ButtonSize,
  type ButtonTone,
  type ButtonVariant,
  useButtonPresentation,
} from "./presentation";

export type {
  ButtonAppearance,
  ButtonHoverTone,
  ButtonTone,
  ButtonVariant,
} from "./presentation";

export interface ButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "type"
> {
  /**
   * Preserve direct children and CSS-owned geometry for compound controls such
   * as menu rows, switch tracks, tabs and selectable cards. Ordinary actions
   * use the default layout with size, icon and iconOnly props.
   */
  layout?: "default" | "custom";
  /**
   * Importance: primary, secondary or tertiary. Color comes from `tone`.
   * @default "secondary"
   */
  variant?: ButtonVariant;

  /**
   * Semantic color on top of the variant (see {@link ButtonTone}): filled on a
   * primary, tone text on a secondary outline, tone text with a tinted hover
   * on a tertiary.
   */
  tone?: ButtonTone;

  /**
   * Visual treatment.
   * @default depends on variant — "solid" for primary,
   *          "outline" for secondary, "solid" for tertiary
   */
  appearance?: ButtonAppearance;

  /**
   * Button size; inline inherits surrounding typography without a fixed height;
   * sidebar is 20px, reserved for compact sidebar/rail rows and headers
   * @default "default"
   */
  size?: ButtonSize;

  /**
   * Button shape
   * @default "square"
   */
  shape?: ButtonShape;

  /** Loading state @default false */
  loading?: boolean;

  /**
   * When true and loading, spin the provided icon in place instead of
   * replacing it with the Loader2 spinner.
   * @default false
   */
  loadingSpinIcon?: boolean;

  /** Disabled state @default false */
  disabled?: boolean;

  /**
   * Icon element (left side by default)
   * Can be a React node or a string (icon class name like "ri-home-line")
   */
  icon?: React.ReactNode | string;

  /** Icon position @default "left" */
  iconPosition?: "left" | "right";

  /** Icon-only button (no text) @default false */
  iconOnly?: boolean;

  /**
   * Color a neutral (secondary / tertiary) button shows only while hovered,
   * pressed or keyboard-focused; it stays neutral at rest. Prefer it to
   * hand-written hover color classes. Semantic variants already carry a color
   * and ignore it.
   */
  hoverTone?: ButtonHoverTone;

  /** Display-only shortcut hint; the caller owns keyboard handling. Hidden for icon-only buttons. */
  shortcut?: string;

  /**
   * Center the label on the button's own center, taking the icon out of flow so
   * it sits beside the centered label instead of shifting it. Intended for
   * full-width buttons — on a hug-width button the icon overhangs the edge.
   * @default false
   */
  centerLabel?: boolean;

  /** Button takes full width @default false */
  long?: boolean;

  /** HTML button type @default "button" */
  htmlType?: "button" | "submit" | "reset";

  /** Button href (renders as anchor) */
  href?: string;

  /** Anchor target */
  target?: string;

  /** Anchor relationship */
  rel?: string;

  /** Children content */
  children?: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      layout = "default",
      variant = "secondary",
      tone,
      appearance,
      size = "default",
      shape = "square",
      loading = false,
      loadingSpinIcon = false,
      disabled = false,
      icon,
      iconPosition = "left",
      iconOnly = false,
      hoverTone,
      shortcut,
      centerLabel = false,
      long = false,
      htmlType = "button",
      href,
      target,
      rel,
      children,
      className = "",
      style,
      onClick,
      ...rest
    },
    ref
  ) => {
    const { isDisabled, buttonStyles, buttonContent, buttonClassName } =
      useButtonPresentation({
        layout,
        variant,
        tone,
        appearance,
        size,
        shape,
        loading,
        loadingSpinIcon,
        disabled,
        icon,
        iconPosition,
        iconOnly,
        hoverTone,
        shortcut,
        centerLabel,
        long,
        children,
        className,
        style,
      });

    if (href && !isDisabled) {
      return (
        <a
          href={href}
          target={target}
          rel={rel}
          className={buttonClassName}
          style={buttonStyles}
          onClick={
            onClick as unknown as React.MouseEventHandler<HTMLAnchorElement>
          }
          {...(rest as unknown as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        >
          {buttonContent}
        </a>
      );
    }

    return (
      <button
        {...rest}
        ref={ref}
        type={htmlType}
        disabled={isDisabled}
        className={buttonClassName}
        style={buttonStyles}
        onClick={onClick}
      >
        {buttonContent}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
