import { cn } from "@/lib/utils";

export type DeliveryStatus = "delivered" | "read" | "none";

export interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  /** Optional typing indicator when content is empty and loading */
  loading?: boolean;
  /** iMessage-style delivery receipt shown below the last user bubble */
  deliveryStatus?: DeliveryStatus;
  className?: string;
}

/**
 * Single message bubble: user right, AI left. iMessage-style corners.
 */
export function MessageBubble({ role, content, loading, deliveryStatus, className }: MessageBubbleProps) {
  const isUser = role === "user";
  return (
    <div
      className={cn(
        "flex flex-col max-w-[78%]",
        isUser ? "ml-auto items-end" : "items-start",
        className
      )}
    >
      <div
        className={cn(
          "px-4 py-2.5 text-[15px] leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground rounded-[20px] rounded-br-[5px]"
            : "bg-secondary text-foreground rounded-[20px] rounded-bl-[5px]"
        )}
      >
        {loading && !content ? (
          <div className="flex items-center gap-1.5 py-1 px-0.5 h-5">
            <span className="typing-dot text-muted-foreground" />
            <span className="typing-dot text-muted-foreground" />
            <span className="typing-dot text-muted-foreground" />
          </div>
        ) : (
          <span className="whitespace-pre-wrap break-words">{content}</span>
        )}
      </div>

      {/* iMessage-style delivery receipt */}
      {isUser && deliveryStatus && deliveryStatus !== "none" && (
        <p className="text-[11px] text-muted-foreground mt-1 pr-0.5 animate-fade-in">
          {deliveryStatus === "read" ? "Read" : "Delivered"}
        </p>
      )}
    </div>
  );
}
