/**
 * ChatBubble Primitives
 *
 * Reusable layout and styling for chat-style message bubbles.
 * Used by Simulator Messages and Inbox feed.
 *
 * - ChatBubbleLayout: avatar + header + content column
 * - ChatBubbleAvatar: circular icon container
 * - ChatBubbleHeader: sender name + timestamp + optional extras
 * - ChatBubbleBody: rounded card with variant-based background
 */
import React from "react";

export const CHAT_BUBBLE_WIDTH_TOKENS = {
  row: "flex gap-3 mx-auto w-full max-w-[900px] min-w-0 overflow-hidden",
  content: "w-full min-w-0 max-w-full overflow-hidden",
  body: "inline-block min-w-0 max-w-full overflow-hidden",
  userBody: "inline-block min-w-0 max-w-full overflow-hidden",
} as const;

// ============================================
// Avatar — circular icon container
// ============================================

interface ChatBubbleAvatarProps {
  icon: React.ReactNode;
  bgColor?: string;
  className?: string;
}

export const ChatBubbleAvatar: React.FC<ChatBubbleAvatarProps> = ({
  icon,
  bgColor,
  className = "h-8 w-8",
}) => (
  <div
    className={`flex shrink-0 items-center justify-center rounded-full ${className}`}
    style={bgColor ? { backgroundColor: bgColor } : undefined}
  >
    {icon}
  </div>
);

// ============================================
// Header — sender name + timestamp + extras
// ============================================

interface ChatBubbleHeaderProps {
  senderName: string;
  timestamp: string;
  extra?: React.ReactNode;
  align?: "left" | "right";
}

export const ChatBubbleHeader: React.FC<ChatBubbleHeaderProps> = ({
  senderName,
  timestamp,
  extra,
  align = "left",
}) => (
  // For right-aligned bubbles we reverse the row so the sender name
  // ends up adjacent to the avatar (which sits on the right via
  // `flex-row-reverse` on the layout). Reading order becomes
  // `[extra] timestamp · senderName | avatar`, matching every modern
  // chat UI (iMessage, Feishu, Slack DM threads).
  <div
    className={`mb-1 flex items-center gap-2 ${align === "right" ? "flex-row-reverse justify-start" : ""}`}
  >
    <span className="text-[13px] font-medium text-text-1">{senderName}</span>
    <span className="text-[11px] text-text-3">{timestamp}</span>
    {extra}
  </div>
);

// ============================================
// Body — rounded card with background
// ============================================

const BODY_VARIANTS = {
  agent: "rounded-lg bg-primary-1 p-3 text-text-1",
  user: "rounded-lg bg-primary-6 p-3 text-white",
  neutral: "rounded-lg bg-fill-2 p-3 text-text-1",
} as const;

type BubbleVariant = keyof typeof BODY_VARIANTS;

interface ChatBubbleBodyProps {
  variant: BubbleVariant;
  className?: string;
  children: React.ReactNode;
}

export const ChatBubbleBody: React.FC<ChatBubbleBodyProps> = ({
  variant,
  className = "",
  children,
}) => (
  <div
    className={`${CHAT_BUBBLE_WIDTH_TOKENS.body} text-left ${BODY_VARIANTS[variant]} ${className}`}
  >
    <div className="min-w-0 text-[13px] leading-relaxed">{children}</div>
  </div>
);

// ============================================
// Layout — full bubble row (avatar + content column)
// ============================================

interface ChatBubbleLayoutProps {
  avatar: React.ReactNode;
  align?: "left" | "right";
  onClick?: () => void;
  interactive?: boolean;
  className?: string;
  dataAttr?: Record<string, string | number | undefined>;
  children: React.ReactNode;
}

/**
 * Avatar + content column. The inner column grows to fill the remaining
 * row width (`min-w-0 flex-1`); callers cap the bubble's actual width
 * via the outer `className` (e.g. `w-max max-w-full` to shrink-wrap, or
 * `max-w-[640px]` to cap by content width). The primitive used to
 * hard-cap the inner column at `max-w-[80%]`, which made bubbles read
 * as cramped on full-width chat surfaces — the cap belongs at the call
 * site, not the primitive.
 */
export const ChatBubbleLayout: React.FC<ChatBubbleLayoutProps> = ({
  avatar,
  align = "left",
  onClick,
  interactive = Boolean(onClick),
  className = "flex gap-3",
  dataAttr,
  children,
}) => (
  <div
    className={`${className} ${align === "right" ? "flex-row-reverse" : ""} ${interactive ? "cursor-pointer transition-opacity hover:opacity-80" : ""}`}
    onClick={onClick}
    {...dataAttr}
  >
    {avatar}
    <div
      className={`${CHAT_BUBBLE_WIDTH_TOKENS.content} flex-1 ${align === "right" ? "text-right" : ""}`}
    >
      {children}
    </div>
  </div>
);
