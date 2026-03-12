import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  children: ReactNode;
  className?: string;
}

/**
 * Left sidebar for chat history / nav. ~280px width, scrollable content.
 */
export function Sidebar({ children, className }: SidebarProps) {
  return (
    <aside
      className={cn(
        "hidden md:flex w-[280px] flex-shrink-0 flex-col border-r border-border bg-background",
        className
      )}
    >
      {children}
    </aside>
  );
}
