import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getFlaggedContacts, getSessionsForContact } from "@/lib/storage";
import { useConversationSocketOptional } from "@/contexts/ConversationSocketContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Container } from "@/components/Container";
import { MessageCircle, Search, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

function getInitial(name: string): string {
  const n = name.trim();
  return n ? n[0].toUpperCase() : "?";
}

/** Inbox: messaging-style list of conversations (not a form). */
export function ConversationList() {
  const [search, setSearch] = useState("");
  const socket = useConversationSocketOptional();
  const updateVersion = socket?.updateVersion ?? 0;
  const contacts = getFlaggedContacts();
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
    <Container
      contentClassName="flex flex-col h-full min-h-0"
      className="flex flex-col"
    >
      <header className="flex-shrink-0 pb-4">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Messages
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Type here instead of texting them.
        </p>
        {contacts.length > 0 && (
          <div className="mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search conversations…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 rounded-xl bg-muted/50 border-0 focus-visible:ring-2"
                aria-label="Search conversations"
              />
            </div>
          </div>
        )}
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-4">
              <MessageCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="mt-4 text-lg font-medium text-foreground">
              No conversations yet
            </h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Add a contact to start. When you type here, NOTSENT intercepts send
              and helps you decide before it goes.
            </p>
            <Button
              className="mt-6 gap-2 rounded-xl"
              onClick={() => navigate("/contacts")}
            >
              <UserPlus className="h-4 w-4" />
              Add contact
            </Button>
          </div>
        ) : (
          <ul key={updateVersion} className="divide-y divide-border">
            {filtered.map((contact) => {
              const sessions = getSessionsForContact(contact.id);
              const last =
                sessions.length > 0
                  ? [...sessions].sort(
                      (a, b) => b.timestamp - a.timestamp
                    )[0]
                  : null;
              const preview =
                last?.messageAttempted?.slice(0, 50) ?? "No messages yet";
              const time = last
                ? new Date(last.timestamp).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : "";

              return (
                <li key={contact.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/chat/${contact.id}`)}
                    className={cn(
                      "flex w-full items-center gap-3 py-3 text-left rounded-xl transition-colors",
                      "hover:bg-muted/60 active:bg-muted/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    )}
                  >
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                      {getInitial(contact.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">
                        {contact.name}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {preview}
                        {(last?.messageAttempted?.length ?? 0) > 50 ? "…" : ""}
                      </p>
                    </div>
                    {time && (
                      <span className="flex-shrink-0 text-xs text-muted-foreground">
                        {time}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Container>
  );
}
