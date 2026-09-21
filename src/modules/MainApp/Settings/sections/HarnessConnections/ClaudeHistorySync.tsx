import { useAtomValue } from "jotai";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import Button from "@src/components/Button";
import Select from "@src/components/Select";
import { SectionContainer, SectionRow } from "@src/components/layout/Section";
import {
  type ClaudeHistoryReport,
  inspectClaudeHistory,
} from "@src/features/MarketConnect/claudeHistory";
import {
  captureMarketOwner,
  marketConnectionMatchesOwner,
  marketOwnerKeyAtom,
} from "@src/features/MarketConnect/identity";

export default function ClaudeHistorySync({
  identityUserId,
  disabled,
}: {
  identityUserId: string;
  disabled: boolean;
}) {
  const { t } = useTranslation("settings");
  const ownerKey = useAtomValue(marketOwnerKeyAtom);
  const currentOwner = marketConnectionMatchesOwner(identityUserId, ownerKey);
  const [report, setReport] = useState<ClaudeHistoryReport | null>(null);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  const operation = useRef<ReturnType<typeof captureMarketOwner> | null>(null);
  useEffect(() => {
    mounted.current = true;
    setReport(null);
    setSelected("");
    setBusy(false);
    return () => {
      mounted.current = false;
      operation.current?.dispose();
      operation.current = null;
    };
  }, [identityUserId, ownerKey]);
  const run = async (
    session: string | null,
    mode: "list" | "inspect" | "sync"
  ) => {
    if (
      busy ||
      disabled ||
      !currentOwner ||
      (mode === "sync" &&
        !["ready", "recovery_ready"].includes(
          report?.items.find((item) => item.sessionId === session)?.status ?? ""
        ))
    )
      return;
    setBusy(true);
    let owner: ReturnType<typeof captureMarketOwner> | null = null;
    try {
      owner = captureMarketOwner(identityUserId, undefined, () => {
        if (mounted.current) {
          setReport(null);
          setSelected("");
        }
      });
      operation.current = owner;
      const next = await inspectClaudeHistory(session, mode);
      owner.assertCurrent();
      if (!mounted.current || operation.current !== owner) return;
      setReport((previous) =>
        mode === "list" || !previous
          ? next
          : {
              status: next.status,
              items: previous.items.map((item) =>
                item.sessionId === session
                  ? (next.items.find(
                      (updated) => updated.sessionId === session
                    ) ?? { ...item, status: next.status })
                  : item
              ),
            }
      );
      if (session === null) setSelected("");
    } catch {
      if (mounted.current && owner?.isCurrent())
        setReport({ status: "failed", items: [] });
    } finally {
      owner?.dispose();
      if (mounted.current && operation.current === owner) setBusy(false);
      if (operation.current === owner) operation.current = null;
    }
  };
  const result =
    report?.items.find((item) => item.sessionId === selected)?.status ??
    report?.status;
  const readyCount =
    report?.items.filter((item) =>
      ["ready", "recovery_ready"].includes(item.status)
    ).length ?? 0;
  return (
    <SectionContainer title={t("harnessConnections.claudeHistory.title")}>
      <SectionRow showHeader={false}>
        <div className="flex w-full flex-col gap-2">
          <p className="text-sm text-text-2">
            {t("harnessConnections.claudeHistory.help")}
          </p>
          <Button
            disabled={disabled || busy || !currentOwner}
            loading={busy && !selected}
            onClick={() => void run(null, "list")}
          >
            {t("harnessConnections.claudeHistory.preview")}
          </Button>
          {report && (
            <p className="text-sm text-text-2">
              {t("harnessConnections.claudeHistory.count", {
                ready: readyCount,
                total: report.items.length,
              })}
            </p>
          )}
          {Boolean(report?.items.length) && (
            <>
              <Select
                aria-label={t("harnessConnections.claudeHistory.choose")}
                placeholder={t("harnessConnections.claudeHistory.choose")}
                value={selected || undefined}
                disabled={disabled || busy || !currentOwner}
                options={report!.items.map((item) => ({
                  value: item.sessionId,
                  label: `${item.title} · ${item.sessionId.slice(0, 8)}`,
                }))}
                onChange={(value) => setSelected(String(value))}
              />
              <Button
                disabled={disabled || busy || !currentOwner || !selected}
                onClick={() => void run(selected, "inspect")}
              >
                {t("harnessConnections.claudeHistory.inspect")}
              </Button>
              <Button
                disabled={
                  disabled ||
                  busy ||
                  !currentOwner ||
                  !selected ||
                  !result ||
                  !["ready", "recovery_ready"].includes(result)
                }
                loading={busy && Boolean(selected)}
                onClick={() => void run(selected, "sync")}
              >
                {t("harnessConnections.claudeHistory.sync")}
              </Button>
            </>
          )}
          {report && (
            <p role="status" className="text-sm text-text-2">
              {report.items.length === 0 && report.status === "clean"
                ? t("harnessConnections.claudeHistory.empty")
                : t(
                    `harnessConnections.claudeHistory.status.${result ?? "failed"}`
                  )}
            </p>
          )}
        </div>
      </SectionRow>
    </SectionContainer>
  );
}
