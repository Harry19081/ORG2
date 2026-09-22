import cn from "classnames";
import React, { memo } from "react";

import Button from "@src/components/Button";

import { SECTION_ROW_SEPARATOR_CLASSES } from "./tokens";

export interface SectionSidebarSplitProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}

export const SectionSidebarSplit: React.FC<SectionSidebarSplitProps> = memo(
  ({ sidebar, children }) => (
    <div className="grid min-h-[360px] grid-cols-1 @[720px]:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="border-b border-border-1 p-2 @[720px]:border-r @[720px]:border-b-0">
        {sidebar}
      </aside>
      {/* Hosts SectionRows directly, so it carries the separator rule the
          container would otherwise provide. No top padding: the first row
          starts flush with the sidebar's first item. */}
      <div className={`min-w-0 px-4 pb-2 ${SECTION_ROW_SEPARATOR_CLASSES}`}>
        {children}
      </div>
    </div>
  )
);

SectionSidebarSplit.displayName = "SectionSidebarSplit";

export interface SectionSidebarListProps {
  children: React.ReactNode;
}

export const SectionSidebarList: React.FC<SectionSidebarListProps> = memo(
  ({ children }) => <div className="flex flex-col gap-1">{children}</div>
);

SectionSidebarList.displayName = "SectionSidebarList";

export interface SectionSidebarItemProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> {
  children: React.ReactNode;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  selected?: boolean;
}

export const SectionSidebarItem: React.FC<SectionSidebarItemProps> = memo(
  ({
    children,
    leading,
    trailing,
    selected,
    className,
    type = "button",
    ...buttonProps
  }) => (
    <Button
      layout="custom"
      {...buttonProps}
      htmlType={type}
      aria-pressed={selected}
      className={cn(
        // The selected row carries the Input's focused treatment — primary
        // border plus its 2px ring. Unselected rows stay borderless and only
        // tint on hover; the transparent border keeps the height steady.
        // Only the width is unconditional: two border-color utilities on one
        // element are ordered by Tailwind's sort, not by this string, so the
        // colour has to live in exactly one branch.
        "flex h-9 w-full min-w-0 items-center gap-2 rounded-md border px-3 text-left text-sm transition-colors",
        selected
          ? // The exact ring Input, Select and Button's own focus state draw.
            // Tailwind's `ring-*` composes through a different custom property
            // than Button's `shadow-[…]`, so reuse the declaration verbatim.
            "border-primary-6 bg-bg-2 text-text-1 shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-primary-6)_15%,transparent)]"
          : "border-transparent text-text-2 hover:bg-fill-2 hover:text-text-1",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
    >
      {leading ? (
        <span className="flex shrink-0 items-center justify-center">
          {leading}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">{children}</span>
      {trailing ? (
        <span className="flex shrink-0 items-center justify-center">
          {trailing}
        </span>
      ) : null}
    </Button>
  )
);

SectionSidebarItem.displayName = "SectionSidebarItem";
