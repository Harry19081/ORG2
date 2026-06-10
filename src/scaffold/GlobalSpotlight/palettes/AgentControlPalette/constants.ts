import type { AgentExecMode } from "@src/features/SessionCreator/config";

export const GUI_CONTROL_TOGGLE_SHORTCUT_ID = "toggle_gui_control";
export const GUI_CONTROL_SUBMIT_EVENT = "orgii:gui-control-submit";

export const GUI_CONTROL_MODE = {
  INPUT: "input",
  SELECTION: "selection",
} as const;

export const GUI_CONTROL_AGENT_NAME = "ORGII GUI Control";
export const GUI_CONTROL_SESSION_NAME = "Agent Control";
export const GUI_CONTROL_AGENT_ICON_ID = "mouse-pointer-click";
export const GUI_CONTROL_AGENT_EXEC_MODE: AgentExecMode = "build";
