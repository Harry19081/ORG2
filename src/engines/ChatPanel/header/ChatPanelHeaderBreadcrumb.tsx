import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { DROPDOWN_ITEM } from "@src/components/Dropdown/tokens";

export interface ChatPanelHeaderBreadcrumbItem {
  key: string;
  label: ReactNode;
  subtitle?: ReactNode;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

interface ChatPanelHeaderBreadcrumbProps {
  items: readonly ChatPanelHeaderBreadcrumbItem[];
  trailing?: ReactNode;
  dataTestId?: string;
}

const SEGMENT_CLASS =
  "flex h-7 min-w-0 max-w-full cursor-default items-center gap-1.5 rounded-lg px-1.5 text-[13px] font-medium text-text-1 transition-colors hover:bg-surface-hover";

function ChatPanelHeaderBreadcrumbSegment({
  item,
}: {
  item: ChatPanelHeaderBreadcrumbItem;
}) {
  const content = (
    <span className="flex min-w-0 flex-col leading-tight">
      <span className="min-w-0 truncate">{item.label}</span>
      {item.subtitle ? (
        <span className="min-w-0 truncate text-[11px] font-normal text-text-3">
          {item.subtitle}
        </span>
      ) : null}
    </span>
  );

  if (item.onClick) {
    return (
      <button
        type="button"
        className={`${SEGMENT_CLASS} cursor-pointer`}
        onClick={item.onClick}
      >
        {content}
      </button>
    );
  }

  return <span className={SEGMENT_CLASS}>{content}</span>;
}

export function ChatPanelHeaderBreadcrumb({
  items,
  trailing,
  dataTestId = "chat-panel-header-breadcrumb",
}: ChatPanelHeaderBreadcrumbProps): React.ReactNode {
  return (
    <span
      className="flex h-9 min-w-0 shrink items-center gap-1.5"
      data-testid={dataTestId}
    >
      {items.map((item, index) => (
        <span key={item.key} className="flex min-w-0 items-center gap-1.5">
          {index > 0 ? (
            <ChevronRight
              size={DROPDOWN_ITEM.iconSize}
              strokeWidth={1.75}
              className="flex-shrink-0 text-fill-4"
            />
          ) : null}
          <ChatPanelHeaderBreadcrumbSegment item={item} />
        </span>
      ))}
      {trailing ? <span className="ml-1 shrink-0">{trailing}</span> : null}
    </span>
  );
}
