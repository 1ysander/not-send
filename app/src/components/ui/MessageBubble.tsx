import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  className?: string;
}

/** Single message bubble for chat threads (compose/review). */
export function MessageBubble({ role, content, timestamp, className }: MessageBubbleProps) {
  return (
    <div
      className={cn(
        "flex max-w-[85%] flex-col gap-0.5",
        role === "user" && "ml-auto"
      )}
    >
      <div
        className={cn(
          "rounded-xl px-3 py-2 text-sm shadow-soft",
          role === "user"
            ? "bg-primary text-primary-foreground"
            : "bg-muted"
        )}
      >
        <span className="whitespace-pre-wrap">{content}</span>
      </div>
      {timestamp && (
        <span
          className={cn(
            "text-xs text-muted-foreground",
            role === "user" && "text-right"
          )}
        >
          {timestamp}
        </span>
      )}
    </div>
  );
}
