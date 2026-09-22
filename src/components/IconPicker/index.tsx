/**
 * IconPicker Component
 *
 * An icon-only trigger that opens a searchable grid of glyphs. Built for
 * any surface that stores an icon *id* and needs the user to pick one from
 * a curated palette — custom presence statuses, labels, categories, folders.
 *
 * The trigger shows the current glyph and nothing else, so the control fits
 * a settings row beside a name input without stealing width from it. The
 * panel pairs `DropdownSearch` with a roving-focus grid: arrow keys move
 * between cells, Enter or Space commits, Escape closes (owned by Dropdown).
 *
 * The palette is caller-owned. This component never imports glyphs itself —
 * that keeps every icon out of the chunk that imports the picker.
 *
 * @example
 * ```tsx
 * <IconPicker
 *   value={iconId}
 *   options={CUSTOM_ROLE_ICON_OPTIONS}
 *   onChange={setIconId}
 *   ariaLabel={t("myRoles.custom.iconLabel")}
 * />
 * ```
 */
import React, { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import AnyIcon, { type RenderableIcon } from "@src/components/AnyIcon";
import Button from "@src/components/Button";
import Dropdown from "@src/components/Dropdown";
import {
  DROPDOWN_CLASSES,
  DropdownPanel,
  DropdownSearch,
} from "@src/components/Dropdown/exports";

export interface IconPickerOption {
  /** Stable id persisted by the caller. */
  id: string;
  /** Glyph to render. Anything `AnyIcon` accepts. */
  icon: RenderableIcon;
  /**
   * Human-readable name, used as the cell's accessible name and as search
   * text. Defaults to `id`, which is why palette ids read as words.
   */
  label?: string;
  /** Extra search terms, e.g. synonyms the label does not contain. */
  keywords?: string;
}

export interface IconPickerProps {
  /** Currently selected option id. */
  value: string;
  options: readonly IconPickerOption[];
  onChange: (id: string) => void;
  /** Accessible name for the trigger button. */
  ariaLabel: string;
  /** Search field placeholder. Defaults to the shared "Search" string. */
  searchPlaceholder?: string;
  /** Message when the query matches nothing. Defaults to "No results found". */
  emptyText?: string;
  /** Grid columns. @default 8 */
  columns?: number;
  /** Glyph size inside each cell. @default 18 */
  iconSize?: number;
  disabled?: boolean;
  className?: string;
  dataTestId?: string;
}

/** Cell edge length in px. Keeps the panel width derivable from `columns`. */
const CELL_SIZE = 32;
const CELL_GAP = 4;
const GRID_PADDING = 4;

const CELL_CLASSES =
  "flex items-center justify-center rounded-md text-text-2 transition-colors hover:bg-fill-2 hover:text-text-1";
const CELL_SELECTED_CLASSES = "bg-primary-1! text-primary-6!";

function matches(option: IconPickerOption, query: string): boolean {
  if (!query) return true;
  const haystack = `${option.id} ${option.label ?? ""} ${
    option.keywords ?? ""
  }`.toLowerCase();
  return haystack.includes(query);
}

const IconPicker: React.FC<IconPickerProps> = ({
  value,
  options,
  onChange,
  ariaLabel,
  searchPlaceholder,
  emptyText,
  columns = 8,
  iconSize = 18,
  disabled = false,
  className,
  dataTestId,
}) => {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);

  const normalizedQuery = query.trim().toLowerCase();
  const visible = useMemo(
    () => options.filter((option) => matches(option, normalizedQuery)),
    [options, normalizedQuery]
  );

  const selected = options.find((option) => option.id === value);

  const handleVisibleChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (!nextOpen) return;
      setQuery("");
      const index = options.findIndex((option) => option.id === value);
      setActiveIndex(index >= 0 ? index : 0);
    },
    [options, value]
  );

  const commit = useCallback(
    (id: string) => {
      onChange(id);
      setOpen(false);
    },
    [onChange]
  );

  const focusCell = useCallback((index: number) => {
    const cell = gridRef.current?.querySelector<HTMLElement>(
      `[data-icon-index="${index}"]`
    );
    cell?.focus();
  }, []);

  const moveActive = useCallback(
    (delta: number) => {
      if (visible.length === 0) return;
      setActiveIndex((current) => {
        const next = Math.min(Math.max(current + delta, 0), visible.length - 1);
        focusCell(next);
        return next;
      });
    },
    [focusCell, visible.length]
  );

  const handleGridKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      switch (event.key) {
        case "ArrowRight":
          moveActive(1);
          break;
        case "ArrowLeft":
          moveActive(-1);
          break;
        case "ArrowDown":
          moveActive(columns);
          break;
        case "ArrowUp":
          moveActive(-columns);
          break;
        case "Home":
          moveActive(-visible.length);
          break;
        case "End":
          moveActive(visible.length);
          break;
        default:
          return;
      }
      event.preventDefault();
    },
    [columns, moveActive, visible.length]
  );

  // Typing in the search field re-filters, so the highlight must come back
  // inside the new result set rather than point past its end.
  const handleQueryChange = useCallback((next: string) => {
    setQuery(next);
    setActiveIndex(0);
  }, []);

  const handleSearchKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "ArrowDown" && visible.length > 0) {
        event.preventDefault();
        focusCell(activeIndex);
        return;
      }
      if (event.key === "Enter" && visible.length > 0) {
        event.preventDefault();
        commit(visible[Math.min(activeIndex, visible.length - 1)].id);
      }
    },
    [activeIndex, commit, focusCell, visible]
  );

  const gridWidth =
    columns * CELL_SIZE + (columns - 1) * CELL_GAP + GRID_PADDING * 2;

  return (
    <Dropdown
      trigger="click"
      position="bottom-start"
      disabled={disabled}
      popupVisible={open}
      onVisibleChange={handleVisibleChange}
      droplist={
        <DropdownPanel
          className={DROPDOWN_CLASSES.menuPanelWithHeaderBase}
          maxHeight="none"
          style={{ width: gridWidth }}
        >
          <DropdownSearch
            type="text"
            value={query}
            onChange={handleQueryChange}
            onKeyDown={handleSearchKeyDown}
            placeholder={searchPlaceholder}
            ariaLabel={ariaLabel}
          />
          {visible.length === 0 ? (
            <div className={DROPDOWN_CLASSES.listMessage}>
              {emptyText ?? t("common.noResults")}
            </div>
          ) : (
            <div
              ref={gridRef}
              role="listbox"
              aria-label={ariaLabel}
              onKeyDown={handleGridKeyDown}
              className="scrollbar-hide grid max-h-[240px] overflow-y-auto"
              style={{
                gridTemplateColumns: `repeat(${columns}, ${CELL_SIZE}px)`,
                gap: CELL_GAP,
                padding: GRID_PADDING,
              }}
            >
              {visible.map((option, index) => {
                const isSelected = option.id === value;
                const name = option.label ?? option.id;
                return (
                  <Button
                    key={option.id}
                    layout="custom"
                    role="option"
                    aria-selected={isSelected}
                    aria-label={name}
                    title={name}
                    data-icon-index={index}
                    tabIndex={index === activeIndex ? 0 : -1}
                    className={`${CELL_CLASSES} ${
                      isSelected ? CELL_SELECTED_CLASSES : ""
                    }`}
                    style={{ width: CELL_SIZE, height: CELL_SIZE }}
                    onFocus={() => setActiveIndex(index)}
                    onClick={() => commit(option.id)}
                  >
                    <AnyIcon icon={option.icon} size={iconSize} />
                  </Button>
                );
              })}
            </div>
          )}
        </DropdownPanel>
      }
    >
      <Button
        iconOnly
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        title={selected ? (selected.label ?? selected.id) : ariaLabel}
        disabled={disabled}
        className={className}
        data-testid={dataTestId}
        icon={
          selected ? (
            <AnyIcon icon={selected.icon} size={iconSize} />
          ) : undefined
        }
      />
    </Dropdown>
  );
};

export default IconPicker;
