import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ChatWindowProps {
  children: ReactNode;
  className?: string;
}

/**
 * Scrollable message area for the main chat column. Use with MessageBubble list.
 */
export function ChatWindow({ children, className }: ChatWindowProps) {
  return (
    <div
      className={cn(
        "flex-1 overflow-y-auto px-4 py-6",
        className
      )}
    >
      <div className="mx-auto max-w-xl space-y-6">
        {children}
      </div>
    </div>
  );
}
