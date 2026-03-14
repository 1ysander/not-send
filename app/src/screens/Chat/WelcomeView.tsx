import { useNavigate } from "react-router-dom";
import { Plus, MessageCircle, Bot } from "lucide-react";
import { getFlaggedContacts, getSessionsForContact } from "@/lib/storage";
import { ContactAvatar } from "@/components/ContactAvatar";

function formatTime(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000)
    return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });
}

/**
 * Main home view.
 * - Has contacts → conversation list inbox
 * - No contacts  → welcome / onboarding CTA
 */
export function WelcomeView() {
  const navigate = useNavigate();
  const contacts = getFlaggedContacts();

  if (contacts.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <div className="max-w-sm space-y-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <MessageCircle className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Welcome to NOTSENT
            </h1>
            <p className="text-[15px] text-muted-foreground leading-relaxed">
              Add a contact to start. We'll step in before you hit send.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => navigate("/contacts")}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-[15px] font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Add first contact
            </button>
            <button
              type="button"
              onClick={() => navigate("/ai-chat")}
              className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-3.5 text-[15px] font-medium text-foreground hover:bg-secondary transition-colors"
            >
              <Bot className="h-4 w-4" />
              AI Support chat
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Build conversation rows sorted by most recent activity
  const rows = contacts
    .map((contact) => {
      const sessions = getSessionsForContact(contact.id);
      const last = sessions.length > 0
        ? [...sessions].sort((a, b) => b.timestamp - a.timestamp)[0]
        : null;
      return { contact, last };
    })
    .sort((a, b) => {
      const ta = a.last?.timestamp ?? a.contact.dateAdded ?? 0;
      const tb = b.last?.timestamp ?? b.contact.dateAdded ?? 0;
      return tb - ta;
    });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3 border-b border-border">
        <h1 className="text-[17px] font-semibold tracking-tight text-foreground">
          Conversations
        </h1>
        <button
          type="button"
          onClick={() => navigate("/contacts")}
          aria-label="New conversation"
          className="flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </div>

      {/* Conversation list */}
      <ul className="overflow-y-auto divide-y divide-border/50">
        {rows.map(({ contact, last }) => {
          const preview = last?.messageAttempted?.slice(0, 50) ?? "Tap to start";
          return (
            <li key={contact.id}>
              <button
                type="button"
                onClick={() => navigate(`/chat/${contact.id}`)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-secondary/60 transition-colors active:bg-secondary"
              >
                <ContactAvatar contact={contact} size="xl" />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium text-foreground truncate leading-snug">
                    {contact.name}
                  </p>
                  <p className="text-[13px] text-muted-foreground truncate leading-snug mt-0.5">
                    {preview}{preview.length >= 50 ? "…" : ""}
                  </p>
                </div>
                {last && (
                  <span className="flex-shrink-0 text-[11px] text-muted-foreground self-start mt-1">
                    {formatTime(last.timestamp)}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {/* AI Support chat shortcut */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-border">
        <button
          type="button"
          onClick={() => navigate("/ai-chat")}
          className="flex w-full items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-[14px] font-medium text-foreground hover:bg-secondary transition-colors"
        >
          <Bot className="h-5 w-5 text-muted-foreground" />
          <span>AI Support chat</span>
        </button>
      </div>
    </div>
  );
}
