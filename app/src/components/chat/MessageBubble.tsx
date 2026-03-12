import { cn } from "@/lib/utils";

export interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  /** Optional typing indicator when content is empty and loading */
  loading?: boolean;
  className?: string;
}

/**
 * Single message bubble: user right, AI left. Claude-style rounded-xl, max-w-xl.
 */
export function MessageBubble({ role, content, loading, className }: MessageBubbleProps) {
  return (
    <div
      className={cn(
        "flex max-w-xl",
        role === "user" ? "ml-auto justify-end" : "justify-start",
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
          <div className="flex items-center gap-1.5 py-1">
            <span className="typing-dot text-muted-foreground" />
            <span className="typing-dot text-muted-foreground" />
            <span className="typing-dot text-muted-foreground" />
          </div>
        ) : (
          <span className="whitespace-pre-wrap">{content}</span>
        )}
      </div>
    </div>
  );
}
