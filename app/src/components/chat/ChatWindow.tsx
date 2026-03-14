import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ChatWindowProps {
  children: ReactNode;
  className?: string;
}

/**
 * Scrollable message area for the main chat column. Uses shadcn ScrollArea.
 */
export function ChatWindow({ children, className }: ChatWindowProps) {
  return (
    <ScrollArea
      className={cn("flex-1", className)}
    >
      <div className="px-4 py-6 mx-auto max-w-xl space-y-2">
        {children}
      </div>
    </ScrollArea>
  );
}
