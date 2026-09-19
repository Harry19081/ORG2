import { useAtom, useAtomValue } from "jotai";
import React, { useRef, useState } from "react";

import { FileHeaderMoreMenu } from "@src/features/FileHeader/FileHeaderMoreMenu";
import { openFindTargetNear } from "@src/scaffold/GlobalSpotlight/FindCard/findCoordinator";
import {
  activeStatusBarCallbacksAtom,
  editorHighlightActiveLineAtom,
  editorLineNumbersAtom,
  editorSplitDiffCenteredLineNumbersAtom,
  editorWordWrapAtom,
} from "@src/store/ui";
import { diffViewModeAtom } from "@src/store/workstation/codeEditor";

const noop = () => {};

/** Aggregate diffs expose review search, refresh and shared editor preferences without single-file actions. */
export function SourceControlDiffSettingsMenu({
  onRefresh,
  refreshSpinClass,
}: {
  onRefresh: () => void;
  refreshSpinClass?: string;
}) {
  const viewMode = useAtomValue(diffViewModeAtom);
  const [menuVisible, setMenuVisible] = useState(false);
  const [lineNumbers, setLineNumbers] = useAtom(editorLineNumbersAtom);
  const [wordWrap, setWordWrap] = useAtom(editorWordWrapAtom);
  const [splitCenteredLineNumbers, setSplitCenteredLineNumbers] = useAtom(
    editorSplitDiffCenteredLineNumbersAtom
  );
  const [highlightActiveLine, setHighlightActiveLine] = useAtom(
    editorHighlightActiveLineAtom
  );
  const { onOpenSettings } = useAtomValue(activeStatusBarCallbacksAtom);
  // The header sits outside the diff list; the anchor finds this pane's review search.
  const anchorRef = useRef<HTMLSpanElement>(null);
  return (
    <span ref={anchorRef} className="contents">
      <FileHeaderMoreMenu
        showReloadButton
        showSearchAction
        showGoToLineAction={false}
        showSaveAction={false}
        showDiscardAction={false}
        showCopyRelativePathAction={false}
        showRevealInFileManagerAction={false}
        showLineNumbersToggle
        showSplitCenteredLineNumbersToggle={viewMode === "split"}
        showWordWrapToggle
        showMinimapToggle={false}
        showHighlightActiveLineToggle
        showGitBlameToggle={false}
        showMoreSettingsAction={!!onOpenSettings}
        showSidebarSettings
        lineNumbersEnabled={lineNumbers !== "off"}
        splitCenteredLineNumbersEnabled={splitCenteredLineNumbers}
        wordWrapEnabled={wordWrap}
        wordWrapLocked={viewMode === "split"}
        minimapEnabled={false}
        highlightActiveLineEnabled={highlightActiveLine}
        gitBlameEnabled={false}
        loading={false}
        hasUnsavedChanges={false}
        reloadSpinClass={refreshSpinClass}
        reloadMenuCoolingDown={false}
        menuVisible={menuVisible}
        setMenuVisible={setMenuVisible}
        onSaveClick={noop}
        onDiscardClick={noop}
        onSearchClick={() => {
          setMenuVisible(false);
          openFindTargetNear(anchorRef.current, "file");
        }}
        onGoToLineClick={noop}
        onCopyRelativePathClick={noop}
        onRevealInFileManagerClick={noop}
        onReloadClick={() => {
          setMenuVisible(false);
          onRefresh();
        }}
        onLineNumbersChange={(enabled) =>
          setLineNumbers(enabled ? "on" : "off")
        }
        onSplitCenteredLineNumbersChange={setSplitCenteredLineNumbers}
        onWordWrapChange={setWordWrap}
        onMinimapChange={noop}
        onHighlightActiveLineChange={setHighlightActiveLine}
        onGitBlameChange={noop}
        onMoreSettingsClick={() => {
          onOpenSettings?.();
          setMenuVisible(false);
        }}
      />
    </span>
  );
}
