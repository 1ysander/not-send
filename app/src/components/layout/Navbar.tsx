import { useNavigate, useLocation } from "react-router-dom";
import { MessageCircle, Bot, Inbox, Users, BarChart3, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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

/** Main navigation: desktop sidebar + mobile bottom bar. */
export function Navbar() {
  const navigate = useNavigate();
  const pathname = useLocation().pathname;

  const link = (path: string, end: boolean, label: string, Icon: React.ComponentType<{ className?: string }>) => {
    const active = isActive(path, end, pathname);
    return (
      <Button
        key={path}
        variant="ghost"
        size="sm"
        className={cn(
          "w-full justify-start gap-3 font-normal",
          active && "bg-accent text-accent-foreground"
        )}
        onClick={() => navigate(path)}
      >
        <Icon className="h-4 w-4" />
        {label}
      </Button>
    );
  };

  return (
    <>
      <aside className="hidden w-56 flex-shrink-0 border-r border-border bg-card md:flex md:flex-col">
        <div className="flex h-14 items-center border-b border-border px-4">
          <span className="text-lg font-semibold tracking-tight">NOTSENT</span>
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {navItems.map(({ path, end, label, icon: Icon }) => link(path, end, label, Icon))}
        </nav>
      </aside>
      <nav
        className="flex items-center justify-around border-t border-border bg-card px-2 py-2 safe-bottom md:hidden"
        role="tablist"
        aria-label="Main navigation"
      >
        {navItems.map(({ path, end, label, icon: Icon }) => {
          const active = isActive(path, end, pathname);
          return (
            <Button
              key={path}
              variant="ghost"
              size="icon"
              className={cn(
                "flex flex-col gap-0.5 rounded-lg",
                active && "bg-accent text-accent-foreground"
              )}
              onClick={() => navigate(path)}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px]">{label}</span>
            </Button>
          );
        })}
      </nav>
    </>
  );
}
