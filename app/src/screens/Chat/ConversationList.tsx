import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getFlaggedContacts, getSessionsForContact } from "@/lib/storage";
import { useConversationSocketOptional } from "@/contexts/ConversationSocketContext";
import { Button } from "@/components/ui/button";
import { MessageCircle, Search, UserPlus } from "lucide-react";

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

export function ConversationList() {
  const [search, setSearch] = useState("");
  const socket = useConversationSocketOptional();
  const updateVersion = socket?.updateVersion ?? 0;
  const contacts = getFlaggedContacts();
  const navigate = useNavigate();

  const filtered = search.trim()
    ? contacts.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.phoneNumber.includes(search)
      )
    : contacts;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-6 pb-3 sm:px-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Messages</h1>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => navigate("/contacts")}
          >
            <UserPlus className="h-4 w-4" />
            <span className="text-xs">Add</span>
          </Button>
        </div>
        {contacts.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-xl bg-secondary text-sm text-foreground placeholder:text-muted-foreground border-0 outline-none focus:ring-2 focus:ring-ring/30 transition-shadow"
              aria-label="Search conversations"
            />
          </div>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary mb-4">
              <MessageCircle className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No conversations yet</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Add a contact. When you type here, NOTSENT intercepts send and helps you decide.
            </p>
            <Button
              size="sm"
              className="mt-5 gap-2"
              onClick={() => navigate("/contacts")}
            >
              <UserPlus className="h-4 w-4" />
              Add contact
            </Button>
          </div>
        ) : (
          <ul key={updateVersion}>
            {filtered.map((contact) => {
              const sessions = getSessionsForContact(contact.id);
              const last = sessions.length > 0
                ? [...sessions].sort((a, b) => b.timestamp - a.timestamp)[0]
                : null;
              const preview = last?.messageAttempted?.slice(0, 55) ?? "No messages yet";
              const truncated = (last?.messageAttempted?.length ?? 0) > 55;

              return (
                <li key={contact.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/chat/${contact.id}`)}
                    className="flex w-full items-center gap-3 px-4 py-3.5 sm:px-6 hover:bg-secondary/60 active:bg-secondary transition-colors text-left"
                  >
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-foreground">
                      {getInitial(contact.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{contact.name}</p>
                      <p className="text-sm text-muted-foreground truncate mt-0.5">
                        {preview}{truncated ? "…" : ""}
                      </p>
                    </div>
                    {last && (
                      <span className="flex-shrink-0 text-xs text-muted-foreground">
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
  );
}
