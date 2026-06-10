import { useAtomValue, useSetAtom } from "jotai";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  DraftingCompass,
  Loader2,
  MessageCircle,
  XCircle,
} from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { sessionLaunch } from "@src/api/tauri/agent/session";
import { DISPATCH_CATEGORY } from "@src/api/tauri/session";
import Message from "@src/components/Message";
import { chatEventsForSessionAtomFamily } from "@src/engines/SessionCore/derived/sessionScopedChatEvents";
import type { AdvancedConfig } from "@src/features/SessionCreator/types";
import { useValidatedLastPair } from "@src/hooks/models/useValidatedLastPair";
import type { SpotlightItem } from "@src/scaffold/GlobalSpotlight/types";
import { collectIdeContext } from "@src/services/context/collectors";
import {
  creatorDefaultModelSelectionAtom,
  extractModelPair,
} from "@src/store/session/creatorDefaultModelAtom";
import { modelSelectorAtom } from "@src/store/ui/modelSelectorAtom";
import { guiControlEnabledAtom } from "@src/store/ui/uiAtom";
import { invokeTauri } from "@src/util/platform/tauri";
import { BUILTIN_ADE_MANAGER_DEF_ID } from "@src/util/session/sessionDispatch";

import { useSelectorKernel } from "../core";
import {
  GUI_CONTROL_MODE,
  GUI_CONTROL_SESSION_NAME,
  GUI_CONTROL_SUBMIT_EVENT,
  GUI_CONTROL_TOGGLE_SHORTCUT_ID,
} from "./constants";
import type {
  GuiControlActivityItem,
  GuiControlMode,
  GuiControlRunStatus,
  GuiControlSubmitDetail,
} from "./types";
import {
  EMPTY_GUI_CONTROL_EVENTS_ATOM,
  buildControlPrompt,
  resolveControlModel,
  resolveControlModelLabel,
  toGuiControlActivityItem,
  upsertGuiControlSession,
} from "./utils";

function useGuiControlActivity(
  sessionId: string | null
): GuiControlActivityItem[] {
  const eventsAtom = sessionId
    ? chatEventsForSessionAtomFamily(sessionId)
    : EMPTY_GUI_CONTROL_EVENTS_ATOM;
  const events = useAtomValue(eventsAtom);

  return useMemo(() => {
    if (!sessionId) return [];
    return events
      .map(toGuiControlActivityItem)
      .filter((item): item is GuiControlActivityItem => item !== null)
      .slice(-3)
      .reverse();
  }, [events, sessionId]);
}

export function useAgentControlPalette({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation("common");
  const creatorDefaultLastModel = useValidatedLastPair();
  const setCreatorDefaultModel = useSetAtom(creatorDefaultModelSelectionAtom);
  const setGuiControlEnabled = useSetAtom(guiControlEnabledAtom);
  const setSelectorState = useSetAtom(modelSelectorAtom);
  const controlSessionIdRef = useRef<string | null>(null);
  const sendingRef = useRef(false);
  const [mode, setMode] = useState<GuiControlMode>(GUI_CONTROL_MODE.INPUT);
  const [draftText, setDraftText] = useState("");
  const [runStatus, setRunStatus] = useState<GuiControlRunStatus>("idle");
  const [controlSessionId, setControlSessionId] = useState<string | null>(null);
  const [activityCursor, setActivityCursor] = useState(0);
  const activityItems = useGuiControlActivity(controlSessionId);

  const items = useMemo<SpotlightItem[]>(() => [], []);

  const handleSubmit = useCallback(() => {
    const text = draftText.trim();
    if (!text || sendingRef.current) return;

    setGuiControlEnabled(true);
    const prompt = buildControlPrompt(mode, text);
    const modelConfig = resolveControlModel(creatorDefaultLastModel);
    const ideContext = collectIdeContext({ expectedRepoPath: null });
    sendingRef.current = true;
    setRunStatus("sending");

    void (async () => {
      try {
        const existingSessionId = controlSessionIdRef.current;
        if (existingSessionId) {
          await invokeTauri("agent_send_message", {
            sessionId: existingSessionId,
            content: prompt,
            ...(modelConfig.model ? { model: modelConfig.model } : {}),
            ...(modelConfig.accountId
              ? { accountId: modelConfig.accountId }
              : {}),
            ideContext,
          });
        } else {
          const result = await sessionLaunch({
            category: DISPATCH_CATEGORY.RUST_AGENT,
            content: prompt,
            name: GUI_CONTROL_SESSION_NAME,
            agentDefinitionId: BUILTIN_ADE_MANAGER_DEF_ID,
            keySource: modelConfig.keySource,
            ...(modelConfig.model ? { model: modelConfig.model } : {}),
            ...(modelConfig.accountId
              ? { accountId: modelConfig.accountId }
              : {}),
            ideContext,
          });
          controlSessionIdRef.current = result.sessionId;
          setControlSessionId(result.sessionId);
          upsertGuiControlSession(result);
        }

        setRunStatus("running");

        window.dispatchEvent(
          new CustomEvent<GuiControlSubmitDetail>(GUI_CONTROL_SUBMIT_EVENT, {
            detail: { mode, text, modelSelection: creatorDefaultLastModel },
          })
        );

        setDraftText("");
      } catch (error) {
        setRunStatus("error");
        Message.error(error instanceof Error ? error.message : String(error));
      } finally {
        sendingRef.current = false;
      }
    })();
  }, [creatorDefaultLastModel, draftText, mode, setGuiControlEnabled]);

  const handleExternalKeyDown = useCallback(
    (
      event: React.KeyboardEvent<HTMLInputElement>,
      internalHandleKeyDown: (
        event: React.KeyboardEvent<HTMLInputElement>
      ) => void
    ) => {
      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        handleSubmit();
        return;
      }
      internalHandleKeyDown(event);
    },
    [handleSubmit]
  );

  const kernel = useSelectorKernel({
    isOpen,
    onClose,
    items,
    externalSearchQuery: draftText,
    externalSetSearchQuery: setDraftText,
    externalHandleKeyDown: handleExternalKeyDown,
    initialSelectedIndex: -1,
  });

  useEffect(() => {
    setActivityCursor(0);
  }, [activityItems.length]);

  const handleRefreshSession = useCallback(() => {
    controlSessionIdRef.current = null;
    setControlSessionId(null);
    setActivityCursor(0);
    setRunStatus("idle");
    kernel.focusInput();
  }, [kernel]);

  const handlePreviousActivity = useCallback(() => {
    setActivityCursor((currentCursor) =>
      Math.min(currentCursor + 1, Math.max(activityItems.length - 1, 0))
    );
  }, [activityItems.length]);

  const handleNextActivity = useCallback(() => {
    setActivityCursor((currentCursor) => Math.max(currentCursor - 1, 0));
  }, []);

  const handleLatestActivity = useCallback(() => {
    setActivityCursor(0);
  }, []);

  const handleModelConfigChange = useCallback(
    (config: AdvancedConfig) => {
      setCreatorDefaultModel(extractModelPair(config));
      setSelectorState({ isOpen: false });
      kernel.focusInput();
    },
    [kernel, setCreatorDefaultModel, setSelectorState]
  );

  const handleToggleMode = useCallback(() => {
    setMode((currentMode) =>
      currentMode === GUI_CONTROL_MODE.INPUT
        ? GUI_CONTROL_MODE.SELECTION
        : GUI_CONTROL_MODE.INPUT
    );
    kernel.focusInput();
  }, [kernel]);

  const handleCloseModelSelector = useCallback(() => {
    setSelectorState({ isOpen: false });
    kernel.focusInput();
  }, [kernel, setSelectorState]);

  const modePath = useMemo(
    () => [
      {
        type: "action" as const,
        id: "agent-control",
        label: "ADE Manager",
        icon:
          mode === GUI_CONTROL_MODE.SELECTION ? MessageCircle : DraftingCompass,
        color: "",
      },
    ],
    [mode]
  );

  const latestActivity = activityItems[activityCursor];
  const statusLabel =
    runStatus === "sending"
      ? t("status.sending")
      : runStatus === "error"
        ? t("status.error")
        : t("status.running");

  const statusIcon =
    latestActivity?.status === "running" ||
    (!latestActivity && runStatus === "sending")
      ? Loader2
      : latestActivity?.status === "failed" || runStatus === "error"
        ? XCircle
        : CheckCircle2;

  return {
    activityItems,
    creatorDefaultLastModel,
    draftText,
    handleCloseModelSelector,
    handleLatestActivity,
    handleModelConfigChange,
    handleNextActivity,
    handlePreviousActivity,
    handleRefreshSession,
    handleSubmit,
    handleToggleMode,
    hasNextActivity: activityCursor > 0,
    hasPreviousActivity: activityCursor < activityItems.length - 1,
    isModelOpen: false,
    items,
    kernel,
    mode,
    modePath,
    placeholder:
      mode === GUI_CONTROL_MODE.SELECTION
        ? t("guiControl.selectionPlaceholder")
        : t("guiControl.inputPlaceholder"),
    runStatus,
    selectModelLabel: t("guiControl.selectModel"),
    shortcutId: GUI_CONTROL_TOGGLE_SHORTCUT_ID,
    statusDetail:
      latestActivity?.detail ??
      resolveControlModelLabel(creatorDefaultLastModel),
    statusIcon,
    statusLabel: latestActivity?.title ?? statusLabel,
    statusSpinning:
      latestActivity?.status === "running" ||
      (!latestActivity && runStatus === "sending"),
    showSessionControls: Boolean(controlSessionId),
    showStatusLine: runStatus !== "idle" || Boolean(controlSessionId),
    submitDisabled: !draftText.trim(),
    toolbarActions: {
      previousIcon: ChevronLeft,
      nextIcon: ChevronRight,
      latestIcon: ChevronsRight,
    },
  };
}
