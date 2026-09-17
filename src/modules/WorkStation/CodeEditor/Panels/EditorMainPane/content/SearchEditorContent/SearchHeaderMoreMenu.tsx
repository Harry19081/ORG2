import { useAtom, useAtomValue } from "jotai";
import React, { useState } from "react";

import { FileHeaderMoreMenu } from "@src/features/FileHeader/FileHeaderMoreMenu";
import {
  editorHighlightActiveLineAtom,
  editorLineNumbersAtom,
  editorWordWrapAtom,
} from "@src/store/ui/editorSettingsAtom";
import { activeStatusBarCallbacksAtom } from "@src/store/ui/workStationLayout/statusBarAtoms";

const noop = () => {};

export function SearchHeaderMoreMenu({
  onRefresh,
  loading,
}: {
  onRefresh: () => void;
  loading: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [lineNumbers, setLineNumbers] = useAtom(editorLineNumbersAtom);
  const [wordWrap, setWordWrap] = useAtom(editorWordWrapAtom);
  const [highlight, setHighlight] = useAtom(editorHighlightActiveLineAtom);
  const { onOpenSettings } = useAtomValue(activeStatusBarCallbacksAtom);

  return (
    <FileHeaderMoreMenu
      showReloadButton
      showSearchAction={false}
      showGoToLineAction={false}
      showSaveAction={false}
      showDiscardAction={false}
      showCopyRelativePathAction={false}
      showRevealInFileManagerAction={false}
      showLineNumbersToggle
      showWordWrapToggle
      showMinimapToggle={false}
      showHighlightActiveLineToggle
      showGitBlameToggle={false}
      showMoreSettingsAction={Boolean(onOpenSettings)}
      showSidebarSettings
      lineNumbersEnabled={lineNumbers !== "off"}
      wordWrapEnabled={wordWrap}
      minimapEnabled={false}
      highlightActiveLineEnabled={highlight}
      gitBlameEnabled={false}
      loading={loading}
      hasUnsavedChanges={false}
      reloadSpinClass={undefined}
      reloadMenuCoolingDown={false}
      menuVisible={visible}
      setMenuVisible={setVisible}
      onSaveClick={noop}
      onDiscardClick={noop}
      onSearchClick={noop}
      onGoToLineClick={noop}
      onCopyRelativePathClick={noop}
      onRevealInFileManagerClick={noop}
      onReloadClick={() => {
        setVisible(false);
        onRefresh();
      }}
      onLineNumbersChange={(enabled) => setLineNumbers(enabled ? "on" : "off")}
      onWordWrapChange={setWordWrap}
      onMinimapChange={noop}
      onHighlightActiveLineChange={setHighlight}
      onGitBlameChange={noop}
      onMoreSettingsClick={() => {
        setVisible(false);
        onOpenSettings?.();
      }}
    />
  );
}
