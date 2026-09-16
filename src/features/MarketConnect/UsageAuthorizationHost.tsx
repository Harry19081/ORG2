import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";
import Modal from "@src/scaffold/ModalSystem";
import Button from "@src/components/Button";
import Input from "@src/components/Input";
import Checkbox from "@src/components/Checkbox";
import {
  USAGE_AUTHORIZATION_EVENT,
  type UsagePrompt,
} from "./usageAuthorization";
import { MARKET_PROFILES_CHANGED_EVENT } from "./events";
import { marketConsoleUrl } from "./urlPolicy";

export default function UsageAuthorizationHost() {
  const { t } = useTranslation("settings"),
    [prompt, setPrompt] = useState<UsagePrompt | null>(null),
    [budget, setBudget] = useState("10"),
    [accepted, setAccepted] = useState(false);
  const pending = useRef<UsagePrompt | null>(null);
  useEffect(() => {
    const cancel = () => {
      pending.current?.resolve(null);
      pending.current = null;
      setPrompt(null);
    };
    const show = (event: Event) => {
      const next = (event as CustomEvent<UsagePrompt>).detail;
      if (pending.current) {
        next.resolve(null);
        return;
      }
      pending.current = next;
      setBudget(
        String((next.service.access?.budget_usd6 ?? 10_000_000) / 1_000_000),
      );
      setAccepted(false);
      setPrompt(next);
    };
    window.addEventListener(USAGE_AUTHORIZATION_EVENT, show);
    window.addEventListener(MARKET_PROFILES_CHANGED_EVENT, cancel);
    return () => {
      window.removeEventListener(USAGE_AUTHORIZATION_EVENT, show);
      window.removeEventListener(MARKET_PROFILES_CHANGED_EVENT, cancel);
      cancel();
    };
  }, []);
  if (!prompt) return null;
  const close = (amount: number | null) => {
    const current = pending.current;
    pending.current = null;
    setPrompt(null);
    current?.resolve(amount);
  };
  const valid = Number(budget) > 0 && Number(budget) <= 5000;
  const price = (rates: Record<string, unknown>, key: string) =>
    typeof rates[key] === "number"
      ? `$${((rates[key] as number) / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 6 })}`
      : "—";
  return (
    <Modal
      visible
      title={prompt.service.title}
      onClose={() => close(null)}
      width={500}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={() => close(null)}>
            {t("managedUsage.cancel", "Cancel")}
          </Button>
          <Button
            variant="primary"
            disabled={!valid || !accepted}
            onClick={() => close(Math.round(Number(budget) * 1_000_000))}
          >
            {t("managedUsage.authorize", "Enable package")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-text-2">
          {t(
            "managedUsage.included",
            "All models in this package are included and share one usage limit.",
          )}
        </p>
        <div className="max-h-64 space-y-3 overflow-y-auto">
          {prompt.service.models.map((model) => (
            <div key={model.model} className="space-y-1">
              <p className="font-medium">{model.model}</p>
              <p className="text-sm text-text-2">
                {t("managedUsage.rates", "Input / output per million tokens")}:{" "}
                {price(model.pricing, "input_per_mtok_usd6")} /{" "}
                {price(model.pricing, "output_per_mtok_usd6")}
              </p>
              <details className="text-xs">
                <summary>
                  {t("managedUsage.allRates", "All billing dimensions")}
                </summary>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap">
                  {JSON.stringify(model.pricing, null, 2)}
                </pre>
              </details>
            </div>
          ))}
        </div>
        <label className="block text-sm">
          {t("managedUsage.limit", "Shared package usage limit (USD)")}
          <Input
            value={budget}
            type="number"
            onChange={setBudget}
            min="0.01"
            max="5000"
          />
        </label>
        <p className="text-sm text-text-3">
          {t(
            "managedUsage.description",
            "Enable all models in this package at the displayed rates. Actual usage is charged from your wallet within one shared limit. Higher prices or added models require confirmation for the whole package.",
          )}
        </p>
        <Checkbox checked={accepted} onCheckedChange={setAccepted}>
          {t(
            "managedUsage.accept",
            "I authorize all models in this package at these rates, within one shared limit.",
          )}
        </Checkbox>
        <Button
          onClick={() => void openUrl(marketConsoleUrl("/buyer/billing"))}
        >
          {t("managedUsage.wallet", "Open wallet")}
        </Button>
      </div>
    </Modal>
  );
}
