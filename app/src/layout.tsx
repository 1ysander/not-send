import type { ReactNode } from "react";

/**
 * Root layout: full-height viewport, background, and typography.
 * Used to wrap the app in main.tsx or by the router shell.
 */
export function RootLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground antialiased">
      {children}
    </div>
  );
}
