/**
 * SessionCreatorChatPanel — selection handlers.
 *
 * The category picker's open state and style, the panel handlers (screen
 * share, repository selection, category selection), the agent-picker and
 * advanced-config callbacks built on them, and the branch sync that keeps the
 * session draft aligned with the selected repository.
 */
import { useAtomValue } from "jotai";
import { useCallback } from "react";

import type { AgentSelection } from "@src/scaffold/GlobalSpotlight/palettes/DispatchCategoryPalette";
import { modelPickerStyleAtom } from "@src/store/ui/chatPanel/displayPrefsAtoms";

import type { useChatPanelAgentMode } from "./useChatPanelAgentMode";
import { useChatPanelBranchSync } from "./useChatPanelBranchSync";
import { useChatPanelCategoryPicker } from "./useChatPanelCategoryPicker";
import type { useChatPanelSessionCreator } from "./useChatPanelSessionCreator";
import { useSessionCreatorChatPanelHandlers } from "./useSessionCreatorChatPanelHandlers";

interface UseChatPanelSelectionHandlersOptions {
  mode: ReturnType<typeof useChatPanelAgentMode>;
  session: ReturnType<typeof useChatPanelSessionCreator>;
}

export function useChatPanelSelectionHandlers({
  mode,
  session,
}: UseChatPanelSelectionHandlersOptions) {
  const {
    cli: { setAgentSelectionLaunchMode },
  } = mode;
  const {
    creator: { advancedConfig, effectiveSource, setAdvancedConfig },
    currentBranch,
    currentRepo,
    forceRefreshRepos,
    loadBranchList,
    reposList,
    selectRepo,
    selectedRepoId,
    worktree: { clearWorktreeLaunchSelection },
  } = session;

  const { isCategorySelectorOpen, setIsCategorySelectorOpen, agentHeroRef } =
    useChatPanelCategoryPicker();
  const modelPickerStyle = useAtomValue(modelPickerStyleAtom);

  // ── Handlers via extracted hook ───────────────────────────────────────────

  const handlers = useSessionCreatorChatPanelHandlers({
    reposList,
    effectiveSource,
    advancedConfig,
    setAdvancedConfig,
    selectRepo,
    forceRefreshRepos,
    onRepoScopeChange: clearWorktreeLaunchSelection,
  });
  const { handleCategorySelect } = handlers;

  const handleAgentPickerSelect = useCallback(
    (selection: AgentSelection) => {
      if (selection.cliAgentType && selection.cliLaunchMode) {
        setAgentSelectionLaunchMode(selection.cliLaunchMode);
      }
      handleCategorySelect(selection);
    },
    [handleCategorySelect, setAgentSelectionLaunchMode]
  );

  const handleAdvancedConfigChange = useCallback(
    (config: typeof advancedConfig) => {
      setAdvancedConfig(config);
    },
    [setAdvancedConfig]
  );

  useChatPanelBranchSync({
    effectiveSource,
    selectedRepoId,
    currentRepoKind: currentRepo?.kind,
    currentBranch,
    loadBranchList,
  });

  return {
    agentHeroRef,
    handleAdvancedConfigChange,
    handleAgentPickerSelect,
    handlers,
    isCategorySelectorOpen,
    modelPickerStyle,
    setIsCategorySelectorOpen,
  };
}
