import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { MessageCircle, Bot, Inbox, Users, BarChart3, Settings, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Layout } from "@/components/layout/Layout";
import { Sidebar } from "@/components/ui/Sidebar";
import { getFlaggedContacts, getSessionsForContact } from "@/lib/storage";
import { useConversationSocketOptional } from "@/contexts/ConversationSocketContext";

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

function getInitial(name: string): string {
  return name.trim() ? name.trim()[0].toUpperCase() : "?";
}

function formatTime(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });
}

const AVATAR_COLORS: Record<string, string> = {
  A: "bg-neutral-200 text-neutral-700",
  B: "bg-neutral-200 text-neutral-700",
  C: "bg-neutral-200 text-neutral-700",
  D: "bg-neutral-200 text-neutral-700",
  E: "bg-neutral-200 text-neutral-700",
  F: "bg-neutral-200 text-neutral-700",
};
function avatarColor(name: string): string {
  const c = AVATAR_COLORS[name.trim()[0]?.toUpperCase()];
  return c ?? "bg-secondary text-foreground";
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
        <span className="text-[15px] font-semibold tracking-tight text-foreground">
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
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] transition-colors",
                active
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
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
            className="flex flex-1 items-center gap-2 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-[13px] font-medium hover:opacity-90"
            aria-label="Add contact"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            New chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
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
                      <div
                        className={cn(
                          "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                          avatarColor(contact.name)
                        )}
                      >
                        {getInitial(contact.name)}
                      </div>
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
        </div>
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
          "flex md:hidden flex-shrink-0 items-end justify-around border-t border-border bg-background px-1 pt-2 pb-safe"
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
              className="flex flex-col items-center gap-1 min-w-[48px] py-2 px-2"
            >
              <Icon
                className={cn(
                  "h-6 w-6",
                  active ? "text-foreground" : "text-muted-foreground"
                )}
                strokeWidth={active ? 2.2 : 1.7}
              />
              <span
                className={cn(
                  "text-[10px] leading-none",
                  active ? "text-foreground font-medium" : "text-muted-foreground"
                )}
              >
                {label}
              </span>
            </button>
          );
        })}
      </nav>
    </Layout>
  );
}
