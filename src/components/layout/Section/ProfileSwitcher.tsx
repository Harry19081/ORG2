/**
 * SectionProfileSwitcher
 *
 * The profile-picker container: a sidebar listing the saved profiles with
 * "add" and "refresh" entries, and the selected profile's form beside it.
 * Git profiles and harness connection profiles are the same shape — one of
 * several saved configurations, exactly one of them applied — so they share
 * this frame instead of each rebuilding the split, the active marker and the
 * refresh spin.
 *
 * The form itself stays with the caller: pass SectionRows as children.
 */
import React, { memo } from "react";

import { useRefreshSpin } from "@src/components/RefreshIcon/useRefreshSpin";
import {
  Add01Icon,
  HugeiconsIcon,
  Refresh04Icon,
  Tick01Icon,
} from "@src/icons";

import SectionContainer from "./Container";
import {
  SectionSidebarItem,
  SectionSidebarList,
  SectionSidebarSplit,
} from "./SidebarSplit";

export interface SectionProfileSwitcherItem {
  id: string;
  label: string;
  /** Glyph shown before the label (e.g. a profile avatar). */
  leading?: React.ReactNode;
  /** The profile currently in use — marked with a check. */
  active?: boolean;
  /**
   * Short status shown in place of the check, for a state the check cannot
   * express on its own (e.g. applied, but with saved edits not yet applied).
   */
  badge?: string;
  disabled?: boolean;
  dataTestId?: string;
}

export interface SectionProfileSwitcherProps {
  items: readonly SectionProfileSwitcherItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Accessible name for the check drawn on the active profile. */
  activeLabel?: string;
  add?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    dataTestId?: string;
  };
  refresh?: {
    label: string;
    onRefresh: () => void | Promise<void>;
    refreshing?: boolean;
    dataTestId?: string;
  };
  /** The selected profile's form. */
  children: React.ReactNode;
  dataTestId?: string;
  className?: string;
}

const RefreshItem: React.FC<
  NonNullable<SectionProfileSwitcherProps["refresh"]>
> = ({ label, onRefresh, refreshing = false, dataTestId }) => {
  const { spinClass, handleClick } = useRefreshSpin(onRefresh, refreshing);
  return (
    <SectionSidebarItem
      leading={
        <HugeiconsIcon
          icon={Refresh04Icon}
          data-icon="refresh-cw"
          size={14}
          className={spinClass}
        />
      }
      disabled={refreshing}
      onClick={handleClick}
      title={label}
      data-testid={dataTestId}
    >
      {label}
    </SectionSidebarItem>
  );
};

export const SectionProfileSwitcher: React.FC<SectionProfileSwitcherProps> =
  memo(
    ({
      items,
      selectedId,
      onSelect,
      activeLabel,
      add,
      refresh,
      children,
      dataTestId,
      className = "",
    }) => (
      <SectionContainer
        className={`p-0! ${className}`.trim()}
        dataTestId={dataTestId}
      >
        <SectionSidebarSplit
          sidebar={
            <SectionSidebarList>
              {items.map((item) => (
                <SectionSidebarItem
                  key={item.id}
                  selected={selectedId === item.id}
                  disabled={item.disabled}
                  leading={item.leading}
                  trailing={
                    item.badge ? (
                      <span className="text-[10px] leading-none text-primary-6">
                        {item.badge}
                      </span>
                    ) : item.active ? (
                      <HugeiconsIcon
                        icon={Tick01Icon}
                        data-icon="check"
                        size={15}
                        className="text-success-6"
                        aria-label={activeLabel}
                      />
                    ) : null
                  }
                  onClick={() => onSelect(item.id)}
                  data-testid={item.dataTestId}
                >
                  <span className="block truncate font-medium">
                    {item.label}
                  </span>
                </SectionSidebarItem>
              ))}
              {add && (
                <SectionSidebarItem
                  leading={
                    <HugeiconsIcon
                      icon={Add01Icon}
                      data-icon="plus"
                      size={14}
                    />
                  }
                  disabled={add.disabled}
                  onClick={add.onClick}
                  data-testid={add.dataTestId}
                >
                  {add.label}
                </SectionSidebarItem>
              )}
              {refresh && <RefreshItem {...refresh} />}
            </SectionSidebarList>
          }
        >
          {children}
        </SectionSidebarSplit>
      </SectionContainer>
    )
  );

SectionProfileSwitcher.displayName = "SectionProfileSwitcher";

export default SectionProfileSwitcher;
