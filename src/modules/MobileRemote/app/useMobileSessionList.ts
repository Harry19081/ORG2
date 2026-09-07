import { type RefObject, useCallback, useRef, useState } from "react";

import type { MobileRpcClient } from "../connection/mobileRpcClient";
import type { MobileSessionRow } from "../connection/types";

/** Owns roster pagination and invalidation, not the transport lifetime. */
export function useMobileSessionList(
  clientRef: RefObject<MobileRpcClient | null>
) {
  const [sessions, setSessions] = useState<MobileSessionRow[]>([]);
  const [sessionsHasMore, setSessionsHasMore] = useState(false);
  const sessionNextOffsetRef = useRef(0);
  const sessionListGenerationRef = useRef(0);
  const requestSessionList = useCallback(
    async (client: MobileRpcClient, append = false) => {
      const requestGeneration = ++sessionListGenerationRef.current;
      const targetOffset = append
        ? sessionNextOffsetRef.current + 50
        : Math.max(50, sessionNextOffsetRef.current);
      let offset = append ? sessionNextOffsetRef.current : 0;
      let list: {
        sessions?: MobileSessionRow[];
        nextOffset?: number;
        hasMore?: boolean;
      } = {};
      const rows: MobileSessionRow[] = [];
      do {
        list = await client.call<typeof list>("session/list", { offset });
        if (
          requestGeneration !== sessionListGenerationRef.current ||
          clientRef.current !== client
        )
          return;
        rows.push(...(list.sessions ?? []));
        const next = list.nextOffset;
        if (!Number.isSafeInteger(next) || next! <= offset) {
          list.hasMore = false;
          break;
        }
        offset = next!;
      } while (list.hasMore && offset < targetOffset);
      if (
        requestGeneration !== sessionListGenerationRef.current ||
        clientRef.current !== client
      ) {
        return;
      }
      sessionNextOffsetRef.current = offset;
      setSessionsHasMore(
        list.hasMore === true &&
          Number.isSafeInteger(list.nextOffset) &&
          offset < 1000
      );
      setSessions((previous) =>
        append
          ? [
              ...new Map(
                [...previous, ...rows].map((row) => [row.id, row])
              ).values(),
            ]
          : rows
      );
    },
    [clientRef]
  );

  const resetSessions = useCallback((rows: MobileSessionRow[] = []) => {
    sessionListGenerationRef.current += 1;
    sessionNextOffsetRef.current = 0;
    setSessionsHasMore(false);
    setSessions(rows);
  }, []);
  return { sessions, sessionsHasMore, requestSessionList, resetSessions };
}
