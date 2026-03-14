import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getFlaggedContacts, getSessionsForContact } from "@/lib/storage";
import { useConversationSocketOptional } from "@/contexts/ConversationSocketContext";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ContactAvatar } from "@/components/ContactAvatar";
import { MessageCircle, Search, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

function formatTime(ts: number): string {
  const now  = Date.now();
  const diff = now - ts;
  if (diff < 60_000)     return "now";
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });
}

export function ConversationList() {
  const [search, setSearch]  = useState("");
  const socket               = useConversationSocketOptional();
  const updateVersion        = socket?.updateVersion ?? 0;
  const contacts             = getFlaggedContacts();
  const navigate             = useNavigate();

  const filtered = search.trim()
    ? contacts.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.phoneNumber.includes(search)
      )
    : contacts;

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex-shrink-0 px-4 pt-8 pb-3 sm:px-5">
        <div className="flex items-end justify-between mb-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-0.5">
              NOTSENT
            </p>
            <h1 className="text-[28px] font-bold tracking-tight text-foreground leading-none">
              Messages
            </h1>
          </div>
          <button
            type="button"
            onClick={() => navigate("/contacts")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background transition-transform active:scale-90 shadow-sm"
            aria-label="Add contact"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>

        {contacts.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-4 rounded-2xl bg-secondary text-[15px] text-foreground placeholder:text-muted-foreground border-0 outline-none focus:ring-2 focus:ring-[#bf5af2]/30 transition-shadow"
              aria-label="Search conversations"
            />
          </div>
        )}
      </div>

      {/* ── List ── */}
      <ScrollArea className="flex-1">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-6 text-center animate-fade-up">
            <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-secondary mb-5 shadow-sm">
              <MessageCircle className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <p className="text-[17px] font-semibold text-foreground mb-1.5">
              No conversations yet
            </p>
            <p className="text-[14px] text-muted-foreground max-w-[260px] leading-relaxed mb-6">
              Add their contact. Every time you try to text them, we step in first.
            </p>
            <Button
              size="pill"
              onClick={() => navigate("/contacts")}
              className="gap-2"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Add contact
            </Button>
          </div>
        ) : (
          <ul key={updateVersion} className="divide-y divide-border/50">
            {filtered.map((contact) => {
              const sessions = getSessionsForContact(contact.id);
              const last     = sessions.length > 0
                ? [...sessions].sort((a, b) => b.timestamp - a.timestamp)[0]
                : null;
              const preview  = last?.messageAttempted?.slice(0, 55) ?? "Tap to start";
              const truncated = (last?.messageAttempted?.length ?? 0) > 55;

              return (
                <li key={contact.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/chat/${contact.id}`)}
                    className={cn(
                      "flex w-full items-center gap-3.5 px-4 py-3.5 sm:px-5",
                      "hover:bg-secondary/50 active:bg-secondary/80 transition-colors text-left"
                    )}
                  >
                    <ContactAvatar contact={contact} size="xl" />

                    {/* Text */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-[15px] font-semibold text-foreground truncate">
                          {contact.name}
                        </p>
                        {last && (
                          <span className="flex-shrink-0 text-[12px] text-muted-foreground">
                            {formatTime(last.timestamp)}
                          </span>
                        )}
                      </div>
                      <p className="text-[14px] truncate mt-0.5 text-muted-foreground">
                        {preview}{truncated ? "…" : ""}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
}
