import type { LastModelSelection } from "@src/store/session/creatorDefaultModelAtom";

import type { GUI_CONTROL_MODE } from "./constants";

export type GuiControlMode =
  (typeof GUI_CONTROL_MODE)[keyof typeof GUI_CONTROL_MODE];

export type GuiControlRunStatus = "idle" | "sending" | "running" | "error";
export type GuiControlActivityStatus = "running" | "completed" | "failed";

export interface GuiControlSubmitDetail {
  mode: GuiControlMode;
  text: string;
  modelSelection: LastModelSelection | null;
}

export interface GuiControlActivityItem {
  id: string;
  title: string;
  detail: string;
  status: GuiControlActivityStatus;
}
