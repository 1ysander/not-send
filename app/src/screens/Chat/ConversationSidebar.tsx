import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getFlaggedContacts, getSessionsForContact } from "@/lib/storage";
import { Input } from "@/components/ui/input";
import { ContactAvatar } from "@/components/ContactAvatar";
import { Search, MessageCircle, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

/** Sidebar list of conversations for chat layout. */
export function ConversationSidebar() {
  const [search, setSearch] = useState("");
  const contacts = getFlaggedContacts();
  const { contactId } = useParams<{ contactId: string }>();
  const navigate = useNavigate();

  const filtered =
    search.trim()
      ? contacts.filter(
          (c) =>
            c.name.toLowerCase().includes(search.toLowerCase()) ||
            c.phoneNumber.includes(search)
        )
      : contacts;

  return (
    <aside className="flex w-72 flex-shrink-0 flex-col border-r border-border bg-card">
      <div className="flex-shrink-0 border-b border-border p-4">
        <h2 className="text-lg font-semibold tracking-tight">Messages</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Type here instead of texting them.
        </p>
        {contacts.length > 0 && (
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              aria-label="Search conversations"
            />
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="rounded-full bg-muted p-3">
              <MessageCircle className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mt-3 text-sm font-medium">No conversations yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add a contact to start.
            </p>
            <button
              type="button"
              onClick={() => navigate("/contacts")}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium shadow-card transition-colors hover:bg-accent/50"
            >
              <UserPlus className="h-4 w-4" />
              Add contact
            </button>
          </div>
        ) : (
          <ul className="space-y-1">
            {filtered.map((contact) => {
              const sessions = getSessionsForContact(contact.id);
              const last =
                sessions.length > 0
                  ? [...sessions].sort((a, b) => b.timestamp - a.timestamp)[0]
                  : null;
              const preview =
                last?.messageAttempted?.slice(0, 32) ?? "No messages yet";
              const unread = sessions.length;
              const time = last
                ? new Date(last.timestamp).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : "";
              const isActive = contactId === contact.id;

              return (
                <li key={contact.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/chat/${contact.id}`)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left transition-colors shadow-card",
                      "hover:bg-accent/50",
                      isActive && "bg-accent border-primary/20"
                    )}
                  >
                    <ContactAvatar contact={contact} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-sm">
                        {contact.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {preview}
                        {(last?.messageAttempted?.length ?? 0) > 32 ? "…" : ""}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 flex-col items-end gap-0.5">
                      {time && (
                        <span className="text-xs text-muted-foreground">
                          {time}
                        </span>
                      )}
                      {unread > 0 && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                          {unread > 99 ? "99+" : unread}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
