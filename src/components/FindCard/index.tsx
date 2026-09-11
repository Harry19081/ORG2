/**
 * Shared session/file Find card
 *
 * Uses Spotlight chrome and a scope selector; engines retain search ownership.
 */
import { type ReactNode, useEffect, useRef, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";

import Button from "@src/components/Button";
import { ToolbarTooltip } from "@src/components/KeyboardShortcut/ToolbarTooltip";
import SegmentedTextPill from "@src/components/SegmentedTextPill";
import { matchesShortcut } from "@src/config/keyboard/shortcutBindings";
import {
  ArrowDown02Icon,
  ArrowUp02Icon,
  Cancel01Icon,
  CaseSensitiveIcon,
  HugeiconsIcon,
  RegexIcon,
  WholeWordIcon,
} from "@src/icons";
import { BubbleChatIcon, File01Icon } from "@src/icons";
import { SpotlightSearchBar } from "@src/scaffold/GlobalSpotlight/components/SpotlightSearchBar";
import { SPOTLIGHT_CLASSES } from "@src/scaffold/GlobalSpotlight/constants";

import {
  type FindScope,
  canSelectFindScope,
  getFindRevision,
  selectFindScope,
  subscribeFind,
} from "./findCoordinator";

export interface FindCardSearch {
  query: string;
  setQuery: (query: string) => void;
  isSearching: boolean;
  resultCount: number;
  currentResultIndex: number;
  nextResult: () => void;
  prevResult: () => void;
  closeSearch: () => void;
  isSearchVisible: boolean;
  caseSensitive: boolean;
  toggleCaseSensitive: () => void;
  useRegex: boolean;
  toggleRegex: () => void;
  wholeWord: boolean;
  toggleWholeWord: () => void;
}

export interface FindCardProps {
  search: FindCardSearch;
  scope: FindScope;
  targetName?: string;
  children?: ReactNode;
  extraControls?: ReactNode;
  onReplaceShortcut?: () => void;
}

export function FindCard({
  search,
  scope,
  targetName,
  children,
  extraControls,
  onReplaceShortcut,
}: FindCardProps) {
  const { t } = useTranslation(["sessions", "common"]);
  const inputRef = useRef<HTMLInputElement>(null);
  useSyncExternalStore(subscribeFind, getFindRevision);
  const availableScopes = {
    session: canSelectFindScope("session"),
    file: canSelectFindScope("file"),
  };
  const scopeLabels = {
    session: t("common:findScope.session"),
    file: t("common:findScope.file"),
  };
  const name = targetName?.trim();
  const label = name
    ? t("common:findScope.named", { name })
    : scopeLabels[scope];

  const {
    query,
    setQuery,
    isSearching,
    resultCount,
    currentResultIndex,
    nextResult,
    prevResult,
    closeSearch,
    isSearchVisible,
    caseSensitive,
    toggleCaseSensitive,
    useRegex,
    toggleRegex,
    wholeWord,
    toggleWholeWord,
  } = search;

  useEffect(() => {
    if (!isSearchVisible) return;
    const timer = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 50);
    return () => clearTimeout(timer);
  }, [isSearchVisible]);

  useEffect(() => {
    if (!isSearchVisible) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSearch();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSearchVisible, closeSearch]);

  if (!isSearchVisible) return null;

  const controls = [
    {
      icon: ArrowUp02Icon,
      label: t("common:tooltips.previousMatchLabel"),
      onClick: prevResult,
      disabled: resultCount === 0,
    },
    {
      icon: ArrowDown02Icon,
      label: t("common:tooltips.nextMatchLabel"),
      onClick: nextResult,
      disabled: resultCount === 0,
    },
    {
      icon: CaseSensitiveIcon,
      label: t("common:tooltips.matchCaseLabel"),
      onClick: toggleCaseSensitive,
      pressed: caseSensitive,
    },
    {
      icon: WholeWordIcon,
      label: t("common:tooltips.matchWholeWordLabel"),
      onClick: toggleWholeWord,
      pressed: wholeWord,
    },
    {
      icon: RegexIcon,
      label: t("common:tooltips.useRegexLabel"),
      onClick: toggleRegex,
      pressed: useRegex,
    },
  ];

  const renderControl = ({
    icon,
    label,
    onClick,
    pressed,
    disabled,
  }: (typeof controls)[number]) => (
    <ToolbarTooltip key={label} label={label} mouseEnterDelay={1000}>
      <Button
        variant="tertiary"
        appearance={pressed === undefined ? undefined : "soft"}
        size="small"
        iconOnly
        onClick={onClick}
        aria-pressed={pressed}
        disabled={disabled}
        icon={
          <>
            <HugeiconsIcon icon={icon} size={14} />
            <span className="sr-only">{label}</span>
          </>
        }
      />
    </ToolbarTooltip>
  );

  return (
    <div
      className={`ml-auto w-full max-w-sm ${SPOTLIGHT_CLASSES.panel}`}
      data-find-card
      onKeyDown={(event) => {
        if (
          onReplaceShortcut &&
          matchesShortcut(event.nativeEvent, "find_replace")
        ) {
          event.preventDefault();
          event.stopPropagation();
          onReplaceShortcut();
        }
      }}
      role="search"
      aria-label={label}
    >
      <SpotlightSearchBar
        density="compact"
        inputRef={inputRef}
        searchQuery={query}
        onSearchQueryChange={setQuery}
        placeholder={`${label}...`}
        ariaLabel={label}
        path={[]}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.nativeEvent.isComposing) {
            event.preventDefault();
            if (event.shiftKey) prevResult();
            else nextResult();
          }
        }}
        trailingSlot={
          <Button
            variant="tertiary"
            size="small"
            iconOnly
            onClick={closeSearch}
            title={t("chat.closeEsc")}
            icon={<HugeiconsIcon icon={Cancel01Icon} size={14} />}
          />
        }
      />
      {children}
      <div className="flex flex-wrap items-center gap-px border-t border-border-2 px-2 py-1">
        {availableScopes.session && availableScopes.file && (
          <SegmentedTextPill
            ariaLabel={t("common:actions.find")}
            className="gap-px"
            value={scope}
            onChange={selectFindScope}
            options={[
              {
                value: "session",
                label: <HugeiconsIcon icon={BubbleChatIcon} size={14} />,
                ariaLabel: scopeLabels.session,
                tooltip: scopeLabels.session,
              },
              {
                value: "file",
                label: <HugeiconsIcon icon={File01Icon} size={14} />,
                ariaLabel: scopeLabels.file,
                tooltip: scopeLabels.file,
              },
            ]}
          />
        )}
        {controls.slice(2).map(renderControl)}
        {extraControls && (
          <>
            <span
              aria-hidden="true"
              className="mx-1 h-4 shrink-0 border-l border-border-2"
            />
            {extraControls}
          </>
        )}
        <span className="ml-auto text-xs text-text-3" role="status">
          {!query
            ? ""
            : isSearching
              ? "..."
              : resultCount > 0
                ? `${currentResultIndex + 1} / ${resultCount}`
                : t("chat.noResults")}
        </span>
        {controls.slice(0, 2).map(renderControl)}
      </div>
    </div>
  );
}

export default FindCard;
