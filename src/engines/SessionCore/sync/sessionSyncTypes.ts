import type { MutableRefObject } from "react";

import type { SessionAdapter, SessionEventHandler } from "./types";

export interface SessionSyncRefs {
  adapterRef: MutableRefObject<SessionAdapter | null>;
  handlerRef: MutableRefObject<SessionEventHandler | null>;
  prevSessionIdRef: MutableRefObject<string | null>;
  prevReloadEpochRef: MutableRefObject<number>;
  liveSessionIdRef: MutableRefObject<string | null>;
}
