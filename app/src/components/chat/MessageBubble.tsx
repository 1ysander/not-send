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
 * Single message bubble: user right, AI left. Claude-style rounded-xl, max-w-xl.
 */
export function MessageBubble({ role, content, loading, deliveryStatus, className }: MessageBubbleProps) {
  return (
    <div
      className={cn(
        "flex flex-col max-w-xl",
        role === "user" ? "ml-auto items-end" : "items-start",
        className
      )}
    >
      <div
        className={cn(
          "rounded-xl px-4 py-3 text-[15px] leading-relaxed",
          role === "user"
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-foreground"
        )}
      >
        {loading && !content ? (
          <div className="flex items-center gap-1.5 py-1 px-1">
            <span className="typing-dot text-muted-foreground" />
            <span className="typing-dot text-muted-foreground" />
            <span className="typing-dot text-muted-foreground" />
          </div>
        ) : (
          <span className="whitespace-pre-wrap">{content}</span>
        )}
      </div>

      {/* iMessage-style delivery receipt */}
      {role === "user" && deliveryStatus && deliveryStatus !== "none" && (
        <p className="text-[11px] text-muted-foreground mt-0.5 pr-0.5 animate-fade-in">
          {deliveryStatus === "read" ? "Read" : "Delivered"}
        </p>
      )}
    </div>
  );
}
