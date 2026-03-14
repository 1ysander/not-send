import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { MessageCircle, Users, BarChart3, Settings, Plus, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { Layout } from "@/components/layout/Layout";
import { Sidebar } from "@/components/ui/Sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ContactAvatar } from "@/components/ContactAvatar";
import { getFlaggedContacts, getSessionsForContact } from "@/lib/storage";
import { useConversationSocketOptional } from "@/contexts/ConversationSocketContext";

const navItems = [
  { path: "/", end: true, label: "Chats", icon: MessageCircle },
  { path: "/contacts", end: false, label: "Contacts", icon: Users },
  { path: "/ai-chat", end: false, label: "AI Chat", icon: Bot },
  { path: "/stats", end: false, label: "Journal", icon: BarChart3 },
  { path: "/settings", end: false, label: "Settings", icon: Settings },
] as const;

function isActive(path: string, end: boolean, current: string) {
  if (end) return current === "/" || current === "";
  return current === path || current.startsWith(path + "/");
}

function formatTime(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });
}

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const socket = useConversationSocketOptional();
  const updateVersion = socket?.updateVersion ?? 0;
  const contacts = getFlaggedContacts();

  const sidebar = (
    <Sidebar>
      <div className="flex h-14 flex-shrink-0 items-center px-4 border-b border-border">
        <span className="text-[15px] font-bold tracking-tight text-brand-gradient">
          NOTSENT
        </span>
      </div>
      <nav className="flex-shrink-0 border-b border-border px-2 py-3 space-y-0.5">
        {navItems.map(({ path, end, label, icon: Icon }) => {
          const active = isActive(path, end, pathname);
          return (
            <button
              key={path}
              type="button"
              onClick={() => navigate(path)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] transition-colors relative",
                active
                  ? "bg-secondary text-foreground font-medium"
                  : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-full bg-foreground" />
              )}
              <Icon className="h-[18px] w-[18px] flex-shrink-0" />
              {label}
            </button>
          );
        })}
      </nav>
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <button
            type="button"
            onClick={() => navigate("/contacts")}
            className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-[13px] font-medium text-foreground hover:bg-secondary/80 transition-colors"
            aria-label="Add contact"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            New chat
          </button>
        </div>
        <ScrollArea className="flex-1">
          {contacts.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <p className="text-[13px] text-muted-foreground">No conversations yet</p>
              <button
                type="button"
                onClick={() => navigate("/contacts")}
                className="mt-2 text-[13px] font-medium text-foreground hover:underline"
              >
                Add contact
              </button>
            </div>
          ) : (
            <ul key={updateVersion} className="py-2">
              {contacts.map((contact) => {
                const sessions = getSessionsForContact(contact.id);
                const last = sessions.length > 0
                  ? [...sessions].sort((a, b) => b.timestamp - a.timestamp)[0]
                  : null;
                const preview = last?.messageAttempted?.slice(0, 40) ?? "Tap to start";
                const isActiveChat = pathname === `/chat/${contact.id}`;
                return (
                  <li key={contact.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/chat/${contact.id}`)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2.5 text-left rounded-lg transition-colors",
                        isActiveChat ? "bg-secondary" : "hover:bg-secondary/70"
                      )}
                    >
                      <ContactAvatar contact={contact} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-medium text-foreground truncate">
                          {contact.name}
                        </p>
                        <p className="text-[12px] text-muted-foreground truncate">
                          {preview}{preview.length >= 40 ? "…" : ""}
                        </p>
                      </div>
                      {last && (
                        <span className="flex-shrink-0 text-[11px] text-muted-foreground">
                          {formatTime(last.timestamp)}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </div>
    </Sidebar>
  );

  return (
    <Layout sidebar={sidebar}>
      <div
        className={cn(
          "flex-1 flex flex-col min-h-0 overflow-hidden",
          (pathname.startsWith("/chat/") || pathname.startsWith("/closure/")) ? "py-0" : "overflow-y-auto"
        )}
      >
        <Outlet />
      </div>
      {/* Mobile bottom nav */}
      <nav
        className={cn(
          "flex md:hidden flex-shrink-0 items-end justify-around border-t border-border bg-background/95 backdrop-blur-sm px-1 pt-2 pb-safe"
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
              className="flex flex-col items-center gap-0.5 min-w-[52px] py-2 px-2 relative"
            >
              {active && (
                <span className="absolute top-1 left-1/2 -translate-x-1/2 h-0.5 w-5 rounded-full bg-foreground" />
              )}
              <Icon
                className={cn(
                  "h-6 w-6 mt-1",
                  active ? "text-foreground" : "text-muted-foreground"
                )}
                strokeWidth={active ? 2.2 : 1.7}
              />
              <span className={cn("text-[10px] leading-none", active ? "text-foreground font-medium" : "text-muted-foreground")}>
                {label}
              </span>
            </button>
          );
        })}
      </nav>
    </Layout>
  );
}
