import { useAtom, useAtomValue } from "jotai";
import React, { memo, useCallback, useMemo } from "react";

import type { CommitDiffResult } from "@src/api/http/git/types";
import DiffStatsBadge from "@src/components/DiffStatsBadge";
import { FileHeader } from "@src/modules/WorkStation/shared";
import BreadcrumbFileHeader from "@src/modules/shared/components/FileHeader/BreadcrumbFileHeader";
import {
  editorHighlightActiveLineAtom,
  editorLineNumbersAtom,
  editorWordWrapAtom,
} from "@src/store/ui/editorSettingsAtom";
import { activeStatusBarCallbacksAtom } from "@src/store/ui/workStationLayout/statusBarAtoms";
import { diffViewModeAtom } from "@src/store/workstation/codeEditor";
import { formatCompactAge } from "@src/util/time/formatRelativeTime";

interface CommitTabHeaderProps {
  shortSha: string;
  commitMessage: string;
  commitDiff: CommitDiffResult | null;
  publishToWorkstationHeader: boolean;
  onClose?: () => void;
  onOpenInNewTab?: () => void;
}

/**
 * Renders the commit SHA and plain-text summary with author and stats either
 * inline as a 36px file bar or in the global Workstation tab-header strip.
 */
export const CommitTabHeader: React.FC<CommitTabHeaderProps> = memo(
  function CommitTabHeader({
    shortSha,
    commitMessage,
    commitDiff,
    publishToWorkstationHeader,
    onClose,
    onOpenInNewTab,
  }) {
    const [viewMode, setViewMode] = useAtom(diffViewModeAtom);
    const [lineNumbers, setLineNumbers] = useAtom(editorLineNumbersAtom);
    const [wordWrap, setWordWrap] = useAtom(editorWordWrapAtom);
    const [highlightActiveLine, setHighlightActiveLine] = useAtom(
      editorHighlightActiveLineAtom
    );
    const { onOpenSettings } = useAtomValue(activeStatusBarCallbacksAtom);
    const handleLineNumbersChange = useCallback(
      (enabled: boolean) => setLineNumbers(enabled ? "on" : "off"),
      [setLineNumbers]
    );
    const metadata = useMemo(
      () =>
        commitDiff?.author || commitDiff?.stats ? (
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {commitDiff?.author && (
              <span className="shrink-0 text-[12px] text-text-2">
                {commitDiff.author.name}
              </span>
            )}
            {commitDiff?.author?.date && (
              <span className="shrink-0 text-[12px] text-text-3">
                {formatCompactAge(commitDiff.author.date)}
              </span>
            )}
            {commitDiff?.stats && (
              <DiffStatsBadge
                additions={commitDiff.stats.insertions}
                deletions={commitDiff.stats.deletions}
              />
            )}
          </div>
        ) : null,
      [commitDiff]
    );

    // The loaded summary is authoritative; the caller may only have a SHA.
    const resolvedMessage = commitDiff?.summary?.trim() || commitMessage;
    const title = resolvedMessage !== shortSha ? resolvedMessage : "";

    return (
      <FileHeader
        filePath={shortSha}
        useFileTypeIcon={false}
        titleSlot={
          <BreadcrumbFileHeader
            filePath={shortSha}
            displaySegments={
              title
                ? [{ label: shortSha }, { label: title, title }]
                : [{ label: shortSha }]
            }
            disableNavigation
          />
        }
        metadata={metadata}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        lineNumbersEnabled={lineNumbers !== "off"}
        onLineNumbersChange={handleLineNumbersChange}
        wordWrapEnabled={wordWrap}
        onWordWrapChange={setWordWrap}
        highlightActiveLineEnabled={highlightActiveLine}
        onHighlightActiveLineChange={setHighlightActiveLine}
        onMoreSettings={onOpenSettings}
        onClose={onClose}
        onOpenInNewTab={onOpenInNewTab}
        publishToHost={publishToWorkstationHeader ? "code" : undefined}
      />
    );
  }
);
