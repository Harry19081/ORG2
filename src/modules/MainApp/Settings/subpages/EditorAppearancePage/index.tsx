/** Shared editor appearance sections rendered by the Appearance tab. */
import {
  SECTION_CONTROL_STYLE,
  SectionContainer,
  SectionRow,
} from "@/src/components/layout/Section";
import { useAtom } from "jotai";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import Input from "@src/components/Input";
import NumberInput from "@src/components/NumberInput";
import SegmentedTextPill from "@src/components/SegmentedTextPill";
import Select from "@src/components/Select";
import Switch from "@src/components/Switch";
import {
  CODE_FONT_FAMILIES,
  type CodeFontFamily,
  type EditorFontSize,
  type EditorLineHeight,
  type EditorLineNumbers,
  type EditorTabSize,
  codeFontFamilyAtom,
  customCodeFontFamilyAtom,
  editorAutoSaveAtom,
  editorFontSizeAtom,
  editorHighlightActiveLineAtom,
  editorLineHeightAtom,
  editorLineNumbersAtom,
  editorShowBlameAtom,
  editorShowMinimapAtom,
  editorShowTreeIndentGuidesAtom,
  editorSplitDiffCenteredLineNumbersAtom,
  editorTabSizeAtom,
  editorWordWrapAtom,
  gitSourceControlColorFileNamesAtom,
} from "@src/store/ui/editorSettingsAtom";
import { terminalFontSizeAtom } from "@src/store/ui/uiAtom";
import { diffViewModeAtom } from "@src/store/workstation/codeEditor/diffViewModeAtom";
import type { DiffViewMode } from "@src/types/git/types";

const CUSTOM_FONT_DEBOUNCE_MS = 3000;

// ============================================
// Theme & Typography Section
// ============================================

export const TypographySection: React.FC<{ showTitle?: boolean }> = ({
  showTitle = true,
}) => {
  const { t } = useTranslation("settings");
  const { t: tCommon } = useTranslation("common");

  const [codeFontFamily, setCodeFontFamily] = useAtom(codeFontFamilyAtom);
  const [customFontFamily, setCustomFontFamily] = useAtom(
    customCodeFontFamilyAtom
  );
  const [fontSize, setFontSize] = useAtom(editorFontSizeAtom);
  const [tabSize, setTabSize] = useAtom(editorTabSizeAtom);
  const [lineHeight, setLineHeight] = useAtom(editorLineHeightAtom);
  // Local state for custom font name with debounce
  const [localCustomFont, setLocalCustomFont] = useState(customFontFamily);
  const customFontDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  useEffect(() => {
    setLocalCustomFont(customFontFamily);
  }, [customFontFamily]);

  useEffect(() => {
    if (localCustomFont === customFontFamily) return;

    if (customFontDebounceRef.current) {
      clearTimeout(customFontDebounceRef.current);
    }

    customFontDebounceRef.current = setTimeout(() => {
      setCustomFontFamily(localCustomFont);
    }, CUSTOM_FONT_DEBOUNCE_MS);

    return () => {
      if (customFontDebounceRef.current) {
        clearTimeout(customFontDebounceRef.current);
      }
    };
  }, [localCustomFont, customFontFamily, setCustomFontFamily]);

  const handleFontFamilyChange = useCallback(
    (value: string | number | (string | number)[]) => {
      const fontValue = typeof value === "string" ? value : String(value);
      setCodeFontFamily(fontValue as CodeFontFamily);
    },
    [setCodeFontFamily]
  );

  return (
    <SectionContainer
      title={showTitle ? t("editor.themeTypography") : undefined}
    >
      <SectionRow
        settingsSearchKeys="editor.fontFamily"
        label={t("editor.fontFamily")}
      >
        <Select
          value={codeFontFamily}
          onChange={handleFontFamilyChange}
          options={CODE_FONT_FAMILIES.map((f) => {
            if (f.value === "system") {
              return { value: f.value, label: t("editor.fontFamilySystem") };
            }
            if (f.value === "custom") {
              return { value: f.value, label: t("editor.fontFamilyCustom") };
            }
            return f;
          })}
          showSearch
          style={SECTION_CONTROL_STYLE}
        />
      </SectionRow>

      {codeFontFamily === "custom" && (
        <SectionRow
          settingsSearchKeys="editor.customFontFamily"
          label={t("editor.customFontName")}
          indent
        >
          <Input
            value={localCustomFont}
            onChange={setLocalCustomFont}
            placeholder="Fira Code"
            style={SECTION_CONTROL_STYLE}
          />
        </SectionRow>
      )}

      <SectionRow
        settingsSearchKeys="editor.fontSize"
        label={t("editor.fontSize")}
      >
        <NumberInput
          value={fontSize}
          min={10}
          max={24}
          step={1}
          suffix={tCommon("common.px")}
          controlsPosition="sides"
          onValueChange={(value) =>
            setFontSize((value ?? 13) as EditorFontSize)
          }
          style={SECTION_CONTROL_STYLE}
        />
      </SectionRow>

      <SectionRow
        settingsSearchKeys="editor.lineHeight"
        label={t("editor.lineHeight")}
      >
        <NumberInput
          value={lineHeight}
          min={1.2}
          max={2.0}
          step={0.1}
          suffix={tCommon("common.multiplier")}
          controlsPosition="sides"
          onValueChange={(value) =>
            setLineHeight((value ?? 1.5) as EditorLineHeight)
          }
          style={SECTION_CONTROL_STYLE}
        />
      </SectionRow>

      <SectionRow
        settingsSearchKeys="editor.tabSize"
        label={t("editor.tabSize")}
      >
        <NumberInput
          value={tabSize}
          min={2}
          max={8}
          step={2}
          suffix={tCommon("common.spaces")}
          controlsPosition="sides"
          onValueChange={(value) => setTabSize((value ?? 2) as EditorTabSize)}
          style={SECTION_CONTROL_STYLE}
        />
      </SectionRow>
    </SectionContainer>
  );
};

// ============================================
// Terminal Section
// ============================================

export const TerminalSection: React.FC = () => {
  const { t } = useTranslation("settings");
  const { t: tCommon } = useTranslation("common");
  const [terminalFontSize, setTerminalFontSize] = useAtom(terminalFontSizeAtom);

  return (
    <SectionContainer title={t("common:tabs.terminal")}>
      <SectionRow
        settingsSearchKeys="terminal.fontSize"
        label={t("editor.terminalFontSize")}
      >
        <NumberInput
          value={terminalFontSize}
          min={8}
          max={32}
          step={1}
          suffix={tCommon("common.px")}
          controlsPosition="sides"
          onValueChange={(value) => setTerminalFontSize(value ?? 13)}
          style={SECTION_CONTROL_STYLE}
        />
      </SectionRow>
    </SectionContainer>
  );
};

// ============================================
// Editor Section (tree view + editor features)
// ============================================

export const FeaturesSection: React.FC = () => {
  const { t } = useTranslation("settings");

  const [showTreeIndentGuides, setShowTreeIndentGuides] = useAtom(
    editorShowTreeIndentGuidesAtom
  );
  const [lineNumbers, setLineNumbers] = useAtom(editorLineNumbersAtom);
  const [wordWrap, setWordWrap] = useAtom(editorWordWrapAtom);
  const [autoSave, setAutoSave] = useAtom(editorAutoSaveAtom);
  const [showMinimap, setShowMinimap] = useAtom(editorShowMinimapAtom);
  const [highlightActiveLine, setHighlightActiveLine] = useAtom(
    editorHighlightActiveLineAtom
  );
  const [splitDiffCenteredLineNumbers, setSplitDiffCenteredLineNumbers] =
    useAtom(editorSplitDiffCenteredLineNumbersAtom);
  // Same atoms as the file header / Source Control quick menus, so a change
  // on either surface is reflected on the other immediately.
  const [diffViewMode, setDiffViewMode] = useAtom(diffViewModeAtom);
  const [showBlame, setShowBlame] = useAtom(editorShowBlameAtom);
  const [colorFileNames, setColorFileNames] = useAtom(
    gitSourceControlColorFileNamesAtom
  );

  const handleLineNumbersChange = useCallback(
    (value: string | number | (string | number)[]) => {
      const mode = typeof value === "string" ? value : String(value);
      setLineNumbers(mode as EditorLineNumbers);
    },
    [setLineNumbers]
  );

  const lineNumbersOptions = useMemo(
    () => [
      { value: "on", label: t("common:common.on") },
      { value: "off", label: t("common:common.off") },
      { value: "relative", label: t("editor.lineNumbersRelative") },
      { value: "interval", label: t("editor.lineNumbersInterval") },
    ],
    [t]
  );

  return (
    <SectionContainer title={t("editor.tabEditor")}>
      <SectionRow
        settingsSearchKeys="editor.showTreeIndentGuides"
        label={t("editor.treeIndentGuides")}
      >
        <Switch
          checked={showTreeIndentGuides}
          onCheckedChange={setShowTreeIndentGuides}
        />
      </SectionRow>

      <SectionRow
        settingsSearchKeys="editor.lineNumbers"
        label={t("editor.lineNumbers")}
      >
        <Select
          value={lineNumbers}
          onChange={handleLineNumbersChange}
          options={lineNumbersOptions}
          style={SECTION_CONTROL_STYLE}
        />
      </SectionRow>

      <SectionRow label={t("editor.diffViewMode")}>
        <SegmentedTextPill<DiffViewMode>
          ariaLabel={t("editor.diffViewMode")}
          value={diffViewMode}
          onChange={setDiffViewMode}
          options={[
            { value: "unified", label: t("common:workstation.unified") },
            { value: "split", label: t("common:workstation.split") },
          ]}
          size="large"
          dataTestId="diff-view-mode-select"
        />
      </SectionRow>

      <SectionRow
        settingsSearchKeys="editor.splitDiffCenteredLineNumbers"
        label={t("editor.splitDiffCenteredLineNumbers")}
        description={t("editor.splitDiffCenteredLineNumbersDesc")}
      >
        <Switch
          checked={splitDiffCenteredLineNumbers}
          onCheckedChange={setSplitDiffCenteredLineNumbers}
        />
      </SectionRow>

      <SectionRow
        settingsSearchKeys="editor.wordWrap"
        label={t("editor.wordWrap")}
      >
        <Switch checked={wordWrap} onCheckedChange={setWordWrap} />
      </SectionRow>

      <SectionRow
        settingsSearchKeys="editor.autoSave"
        label={t("editor.autoSave")}
      >
        <Switch checked={autoSave} onCheckedChange={setAutoSave} />
      </SectionRow>

      <SectionRow
        settingsSearchKeys="editor.showMinimap"
        label={t("editor.minimap")}
      >
        <Switch checked={showMinimap} onCheckedChange={setShowMinimap} />
      </SectionRow>

      <SectionRow
        settingsSearchKeys="editor.highlightActiveLine"
        label={t("editor.highlightActiveLine")}
      >
        <Switch
          checked={highlightActiveLine}
          onCheckedChange={setHighlightActiveLine}
        />
      </SectionRow>

      <SectionRow
        settingsSearchKeys="editor.showBlame"
        label={t("editor.gitBlame")}
      >
        <Switch
          checked={showBlame}
          onCheckedChange={setShowBlame}
          ariaLabel={t("editor.gitBlame")}
          dataTestId="git-blame-switch"
        />
      </SectionRow>

      <SectionRow
        settingsSearchKeys="git.sourceControl.colorFileNames"
        label={t("common:sidebarSettings.colorSourceControlFiles")}
      >
        <Switch
          checked={colorFileNames}
          onCheckedChange={(checked) => {
            setColorFileNames(checked).catch(() => undefined);
          }}
          ariaLabel={t("common:sidebarSettings.colorSourceControlFiles")}
          dataTestId="color-source-control-files-switch"
        />
      </SectionRow>
    </SectionContainer>
  );
};
