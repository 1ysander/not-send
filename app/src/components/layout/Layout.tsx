import type { ReactNode } from "react";

interface LayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
}

/**
 * Full-height Claude-style layout: sidebar (e.g. 280px) + main chat column.
 * Use with Sidebar and chat content.
 */
export function Layout({ sidebar, children }: LayoutProps) {
  return (
    <div className="flex h-screen w-full bg-background">
      {sidebar}
      <div className="flex flex-1 flex-col min-w-0">
        {children}
      </div>
    </div>
  );
}
