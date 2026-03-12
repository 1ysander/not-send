import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { MessageCircle, Bot, Inbox, Users, BarChart3, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/",             end: true,  label: "Chats",    icon: MessageCircle },
  { path: "/ai-chat",     end: false, label: "AI Chat",  icon: Bot },
  { path: "/conversations", end: false, label: "Inbox",  icon: Inbox },
  { path: "/contacts",    end: false, label: "Contacts", icon: Users },
  { path: "/stats",       end: false, label: "Stats",    icon: BarChart3 },
  { path: "/settings",    end: false, label: "Settings", icon: Settings },
] as const;

function isActive(path: string, end: boolean, current: string) {
  if (end) return current === "/" || current === "";
  return current === path || current.startsWith(path + "/");
}

export function AppShell() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const pathname  = location.pathname;

  return (
    <div className="flex h-screen flex-col bg-background md:flex-row">

      {/* ── Desktop sidebar ── */}
      <aside className="hidden w-56 flex-shrink-0 border-r border-border/60 md:flex md:flex-col">
        {/* Wordmark */}
        <div className="flex h-16 items-center px-5">
          <span className="text-[15px] font-semibold tracking-tight text-foreground">
            NOTSENT
          </span>
        </div>

        <nav className="flex-1 px-3 pb-4 space-y-0.5">
          {navItems.map(({ path, end, label, icon: Icon }) => {
            const active = isActive(path, end, pathname);
            return (
              <button
                key={path}
                type="button"
                onClick={() => navigate(path)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition-all duration-150",
                  active
                    ? "bg-secondary text-foreground font-medium"
                    : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                )}
              >
                <Icon className={cn("h-[18px] w-[18px] flex-shrink-0 transition-colors", active ? "text-foreground" : "text-muted-foreground")} />
                {label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ── Main content ── */}
      <main className="flex flex-1 flex-col overflow-hidden md:min-w-0">
        <div
          className={cn(
            "flex-1 flex flex-col min-h-0 overflow-hidden",
            pathname.startsWith("/chat/") || pathname.startsWith("/closure/")
              ? "py-0"
              : "overflow-y-auto"
          )}
        >
          <Outlet />
        </div>

        {/* ── Mobile bottom nav — frosted glass iOS style ── */}
        <nav
          className={cn(
            "flex items-end justify-around glass border-t px-1 pt-2 pb-safe md:hidden",
            "transition-all duration-200"
          )}
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
                className="flex flex-col items-center gap-[3px] min-w-[48px] py-1 px-2 transition-transform active:scale-90"
              >
                <span
                  className={cn(
                    "flex items-center justify-center rounded-[10px] px-3 py-1.5 transition-all duration-200",
                    active ? "bg-foreground/[0.07]" : "bg-transparent"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-[22px] w-[22px] transition-colors duration-200",
                      active ? "text-foreground" : "text-muted-foreground"
                    )}
                    strokeWidth={active ? 2.2 : 1.7}
                  />
                </span>
                <span
                  className={cn(
                    "text-[10px] leading-none tracking-tight transition-colors duration-200",
                    active ? "text-foreground font-semibold" : "text-muted-foreground font-medium"
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
