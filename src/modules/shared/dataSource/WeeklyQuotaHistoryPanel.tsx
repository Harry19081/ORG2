import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CHART_AXIS_TICK, CHART_TOOLTIP } from "@src/components/Chart";
import Select from "@src/components/Select";
import { useWeeklyQuotaHistory } from "@src/hooks/keyVault/useWeeklyQuotaHistory";

import {
  RuntimeRefreshButton,
  RuntimeSectionHeader,
} from "./RuntimeSectionHeader";
import { weeklyQuotaChartPoints } from "./weeklyQuotaChartPoints";

export default function WeeklyQuotaHistoryPanel() {
  const { t, i18n } = useTranslation("sessions");
  const {
    accounts,
    loading,
    error,
    refresh,
    observedAt: now,
  } = useWeeklyQuotaHistory();
  const [selectedId, setSelectedId] = useState<string>();
  const selected =
    accounts.find((account) => account.keyId === selectedId) ?? accounts[0];
  const text = (key: string, fallback: string) =>
    t(`weeklyQuotaHistory.${key}`, { defaultValue: fallback });
  return (
    <section className="space-y-3" data-testid="weekly-quota-history">
      <RuntimeSectionHeader title={text("title", "Weekly quota history")}>
        <RuntimeRefreshButton
          label={text("refresh", "Refresh")}
          onRefresh={refresh}
          refreshing={loading}
        />
      </RuntimeSectionHeader>
      <p className="text-xs text-text-3">
        {text(
          "description",
          "Quota remaining · Last 28 days · Sampled hourly while the app is visible and online · Missing readings are gaps"
        )}
      </p>
      {error ? (
        <p role="status" className="text-xs text-text-3">
          {text(
            "error",
            "Quota history is unavailable. It will retry when you return to this window"
          )}
        </p>
      ) : null}
      {!accounts.length && !error ? (
        <p role="status" className="text-xs text-text-3">
          {loading
            ? text("loading", "Loading quota history…")
            : text(
                "empty",
                "Connect a Claude Code, Codex, or OpenCode Go account in Key Vault to start tracking"
              )}
        </p>
      ) : null}
      {accounts.length > 1 ? (
        <Select
          value={selected?.keyId}
          ariaLabel={text("account", "Account")}
          options={accounts.map((account) => ({
            value: account.keyId,
            label: `${account.name} · ${account.provider}`,
          }))}
          onChange={(value) => setSelectedId(String(value))}
          showSearch
        />
      ) : null}
      {accounts.length === 128 ? (
        <p className="text-xs text-text-3">
          {text("limit", "Showing up to 128 accounts")}
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-3">
        {(selected ? [selected] : []).map((account) => {
          const latest = account.points.at(-1);
          const formatDate = (value: number) =>
            new Date(value * 1000).toLocaleString(i18n.language, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            });
          return (
            <div
              key={account.keyId}
              className="min-w-0 space-y-2 rounded-lg border border-border-1 bg-primary-container p-3"
            >
              <div className="flex flex-wrap justify-between gap-2 text-xs text-text-1">
                <span className="font-semibold">
                  {account.name} · {account.provider}
                </span>
                {latest ? (
                  <span>
                    {latest.remainingPercent.toFixed(0)}% ·{" "}
                    {formatDate(latest.capturedAt)}
                  </span>
                ) : null}
              </div>
              {latest && now - latest.capturedAt > 2 * 3600 ? (
                <p className="text-xs text-text-3">
                  {text("stale", "Last observation is over two hours old")}
                </p>
              ) : null}
              {account.samplingEnabled === false ? (
                <p className="text-xs text-text-3">
                  {text(
                    "disabled",
                    "Sampling paused for this disabled account"
                  )}
                </p>
              ) : account.status !== "ok" || !latest ? (
                <p className="text-xs text-text-3">
                  {account.status === "unsupported"
                    ? text(
                        "unsupported",
                        "This account does not report a weekly quota"
                      )
                    : account.status === "unavailable"
                      ? text(
                          "unavailable",
                          "Latest reading unavailable; check the account connection in Key Vault"
                        )
                      : text("pending", "Waiting for the next hourly sample")}
                </p>
              ) : null}
              {latest ? (
                <div
                  className="h-40 w-full"
                  role="group"
                  aria-label={`${account.name}: ${latest.remainingPercent.toFixed(0)}%`}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={weeklyQuotaChartPoints(account.points)}
                      accessibilityLayer
                    >
                      <XAxis
                        dataKey="capturedAt"
                        type="number"
                        domain={[now - 28 * 24 * 3600, now]}
                        tickFormatter={formatDate}
                        tick={CHART_AXIS_TICK}
                        minTickGap={50}
                      />
                      <YAxis
                        domain={[0, 100]}
                        ticks={[0, 50, 100]}
                        tickFormatter={(value) => `${value}%`}
                        tick={CHART_AXIS_TICK}
                        width={40}
                      />
                      <Tooltip
                        contentStyle={CHART_TOOLTIP.content}
                        labelStyle={CHART_TOOLTIP.label}
                        itemStyle={CHART_TOOLTIP.item}
                        labelFormatter={(value) => formatDate(Number(value))}
                      />
                      <Line
                        name={text("remaining", "Remaining %")}
                        dataKey="remainingPercent"
                        type="stepAfter"
                        stroke="var(--color-primary-6)"
                        dot={{ r: 2 }}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
