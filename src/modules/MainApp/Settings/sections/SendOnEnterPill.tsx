import SegmentedTextPill from "@src/components/SegmentedTextPill";
import {
  CURRENT_SHORTCUT_PLATFORM,
  type ShortcutPlatform,
} from "@src/config/keyboard/shortcutBindings";
import { getShortcutKeys } from "@src/config/keyboard/shortcutDisplay";

type SendOnEnterMode = "enter" | "modifier-enter";

interface SendOnEnterPillProps {
  ariaLabel: string;
  onChange: (sendOnEnter: boolean) => void;
  sendOnEnter: boolean;
}

export function getSendOnEnterOptions(
  platform: ShortcutPlatform = CURRENT_SHORTCUT_PLATFORM
) {
  return [
    { value: "enter" as const, label: "Enter" },
    {
      value: "modifier-enter" as const,
      label: getShortcutKeys("chat_send", { platform }),
    },
  ];
}

export default function SendOnEnterPill({
  ariaLabel,
  onChange,
  sendOnEnter,
}: SendOnEnterPillProps) {
  return (
    <SegmentedTextPill<SendOnEnterMode>
      ariaLabel={ariaLabel}
      size="large"
      value={sendOnEnter ? "enter" : "modifier-enter"}
      options={getSendOnEnterOptions()}
      onChange={(value) => onChange(value === "enter")}
    />
  );
}
