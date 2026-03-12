import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { MessageCircle, Bot, Inbox, Users, BarChart3, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/", end: true, label: "Chats", icon: MessageCircle },
  { path: "/ai-chat", end: false, label: "AI Chat", icon: Bot },
  { path: "/conversations", end: false, label: "Inbox", icon: Inbox },
  { path: "/contacts", end: false, label: "Contacts", icon: Users },
  { path: "/stats", end: false, label: "Stats", icon: BarChart3 },
  { path: "/settings", end: false, label: "Settings", icon: Settings },
] as const;

function isActive(path: string, end: boolean, current: string) {
  if (end) return current === "/" || current === "";
  return current === path || current.startsWith(path + "/");
}

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;

  return (
    <div className="flex h-screen flex-col bg-background md:flex-row">
      {/* Desktop sidebar — Linear style */}
      <aside className="hidden w-52 flex-shrink-0 border-r border-border bg-background md:flex md:flex-col">
        <div className="flex h-14 items-center px-5 border-b border-border">
          <span className="text-sm font-semibold tracking-tight text-foreground">NOTSENT</span>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {navItems.map(({ path, end, label, icon: Icon }) => {
            const active = isActive(path, end, pathname);
            return (
              <button
                key={path}
                type="button"
                onClick={() => navigate(path)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-secondary text-foreground font-medium"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-hidden md:min-w-0">
        <div
          className={cn(
            "flex-1 flex flex-col min-h-0 overflow-hidden",
            pathname.startsWith("/chat/")
              ? "py-0"
              : "overflow-y-auto"
          )}
        >
          <Outlet />
        </div>

        {/* Mobile bottom nav — iOS style */}
        <nav
          className="flex items-end justify-around border-t border-border bg-background px-1 pt-2 pb-2 safe-bottom md:hidden"
          role="tablist"
          aria-label="Main navigation"
        >
          {navItems.map(({ path, end, label, icon: Icon }) => {
            const active = isActive(path, end, pathname);
            return (
              <button
                key={path}
                type="button"
                role="tab"
                aria-current={active ? "page" : undefined}
                onClick={() => navigate(path)}
                className="flex flex-col items-center gap-1 min-w-[48px] py-1 px-2"
              >
                <span
                  className={cn(
                    "flex items-center justify-center rounded-xl px-3 py-1.5 transition-colors",
                    active ? "bg-secondary" : "bg-transparent"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5 transition-colors",
                      active ? "text-foreground" : "text-muted-foreground"
                    )}
                  />
                </span>
                <span
                  className={cn(
                    "text-[10px] font-medium leading-none tracking-tight",
                    active ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </nav>
      </main>
    </div>
  );
}
