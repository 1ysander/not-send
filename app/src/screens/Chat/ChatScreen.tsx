import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getFlaggedContacts,
  getDeviceId,
  getUserContext,
  addSession,
  getSessionsForContact,
  deleteSessionsForContact,
  updateLocalSessionOutcome,
} from "../../lib/storage";
import { startReview, streamReviewResponse, recordOutcome } from "../../core";
import { webReviewTransport } from "../../adapters/webTransport";
import { useConversationSocketOptional } from "@/contexts/ConversationSocketContext";
import type { LocalSession } from "../../types";

interface InterventionState {
  sessionId: string;
  messageAttempted: string;
  reply: string;
  loading: boolean;
  error: string | null;
  actionLoading: boolean;
}

const CANNED_REPLY = `Hey, are you sure you're going to do this?

Sending might not give you what you're really looking for. We're here to support you — one step at a time. What do you actually need right now that isn't them? Take a breath. You've got this.`;

export function ChatScreen() {
  const { contactId } = useParams<{ contactId: string }>();
  const contacts = getFlaggedContacts();
  const contact = useMemo(
    () => (contactId ? contacts.find((c) => c.id === contactId) : null),
    [contacts, contactId]
  );

  const [sessions, setSessions] = useState<LocalSession[]>(() =>
    contactId ? getSessionsForContact(contactId) : []
  );
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [intervention, setIntervention] = useState<InterventionState | null>(
    null
  );
  const threadEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const socket = useConversationSocketOptional();
  const liveMessages = intervention ? socket?.getMessages(intervention.sessionId) : undefined;
  const liveReply =
    liveMessages?.filter((m) => m.role === "assistant").pop()?.content ?? null;

  function refreshSessions() {
    if (contactId) setSessions(getSessionsForContact(contactId));
  }

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [intervention?.reply, intervention?.loading, sessions]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending || !contactId || !contact) return;
    setError("");
    setSending(true);
    setInput("");

    let sessionId: string;
    try {
      const deviceId = getDeviceId();
      const userContext = getUserContext();
      const result = await startReview(webReviewTransport, text, {
        deviceId,
        userContext: userContext
          ? {
              breakupSummary: userContext.breakupSummary,
              partnerName: userContext.partnerName ?? contact.name,
              conversationContext: userContext.conversationContext,
            }
          : { partnerName: contact.name },
      });
      sessionId = result.sessionId;
    } catch {
      sessionId = `local_${Date.now()}`;
    }

    const localSession: LocalSession = {
      id: sessionId,
      contactId,
      timestamp: Date.now(),
      messageAttempted: text,
      outcome: "draft",
    };
    addSession(localSession);
    refreshSessions();
    setSending(false);

    const isLocal = sessionId.startsWith("local_");
    setIntervention({
      sessionId,
      messageAttempted: text,
      reply: "",
      loading: true,
      error: null,
      actionLoading: false,
    });

    if (isLocal) {
      setIntervention((prev) =>
        prev ? { ...prev, reply: CANNED_REPLY, loading: false } : null
      );
      return;
    }

    const deviceId = getDeviceId();
    const userContext = getUserContext();
    streamReviewResponse(
      webReviewTransport,
      sessionId,
      text,
      (chunk) => {
        setIntervention((prev) =>
          prev ? { ...prev, reply: prev.reply + chunk } : null
        );
      },
      {
        deviceId,
        userContext: userContext
          ? {
              breakupSummary: userContext.breakupSummary,
              partnerName: userContext.partnerName ?? contact.name,
              conversationContext: userContext.conversationContext,
            }
          : undefined,
      }
    )
      .then(() => {
        setIntervention((prev) => (prev ? { ...prev, loading: false } : null));
      })
      .catch((err) => {
        setIntervention((prev) =>
          prev
            ? {
                ...prev,
                loading: false,
                error:
                  err instanceof Error ? err.message : "Something went wrong",
                reply: prev.reply || CANNED_REPLY,
              }
            : null
        );
      });
  }

  async function handleOutcome(outcome: "intercepted" | "sent") {
    if (!intervention || intervention.actionLoading) return;
    setIntervention((prev) => (prev ? { ...prev, actionLoading: true } : null));
    const { sessionId } = intervention;
    try {
      if (!sessionId.startsWith("local_")) {
        await recordOutcome(webReviewTransport, sessionId, outcome);
      }
      updateLocalSessionOutcome(sessionId, outcome);
    } catch {
      updateLocalSessionOutcome(sessionId, outcome);
    }
    setIntervention(null);
    refreshSessions();
  }

  function handleDeleteChat() {
    if (!contactId) return;
    deleteSessionsForContact(contactId);
    setShowDeleteConfirm(false);
    navigate("/", { replace: true });
  }

  if (!contactId || !contact) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6">
        <p className="text-muted-foreground">Contact not found.</p>
        <Button variant="link" className="mt-2" onClick={() => navigate("/")}>
          Back to Messages
        </Button>
      </div>
    );
  }

  const threadMessages = sessions
    .filter((s) => s.messageAttempted)
    .map((s) => ({
      id: s.id,
      text: s.messageAttempted,
      outcome: s.outcome,
      timestamp: s.timestamp,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Thread header */}
      <header className="flex flex-shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-4 py-3">
        <span className="min-w-0 truncate text-base font-semibold">
          {contact.name}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-destructive"
          onClick={() => setShowDeleteConfirm(true)}
          title="Delete conversation"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </header>

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-sm rounded-xl shadow-card">
            <CardContent className="p-6 pt-6">
              <p className="text-sm text-muted-foreground">
                Delete this conversation? Messages will be removed from this
                thread only.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDeleteChat}>
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Message thread */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-content p-6 space-y-4">
          {threadMessages.map((m) => (
            <div
              key={m.id}
              className={cn("max-w-md", m.outcome === "sent" && "ml-auto")}
            >
              <div
                className={cn(
                  "rounded-xl border border-border bg-card p-3 shadow-card",
                  m.outcome === "sent" &&
                    "bg-primary border-primary text-primary-foreground"
                )}
              >
                <span className="block text-sm">{m.text}</span>
                <span className="mt-1 flex items-center gap-1.5 text-xs opacity-85">
                  {m.outcome !== "sent" && (
                    <span className="italic">Not sent</span>
                  )}
                  <span>
                    {new Date(m.timestamp).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </span>
              </div>
            </div>
          ))}

          {/* In-thread review (intervention) */}
          {intervention && (
            <Card className="w-full max-w-md rounded-xl border border-border shadow-card overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  You were about to send
                </p>
                <p className="text-sm font-medium">"{intervention.messageAttempted}"</p>
                <div className="rounded-xl bg-muted/60 p-3 min-h-[2rem]">
                  {intervention.loading && !intervention.reply && !liveReply && (
                    <p className="text-sm text-muted-foreground italic">
                      NOTSENT is thinking…
                    </p>
                  )}
                  {(intervention.reply || liveReply) && (
                    <p className="text-sm whitespace-pre-wrap text-foreground">
                      {liveReply ?? intervention.reply}
                    </p>
                  )}
                  {intervention.error && (
                    <p className="text-sm text-destructive mt-1">
                      {intervention.error}
                    </p>
                  )}
                  <div ref={threadEndRef} />
                </div>
                {!intervention.loading && (
                  <div className="flex gap-2 pt-1">
                    <Button
                      onClick={() => handleOutcome("intercepted")}
                      disabled={intervention.actionLoading}
                      className="flex-1 rounded-xl"
                    >
                      I won't send it
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleOutcome("sent")}
                      disabled={intervention.actionLoading}
                      className="flex-1 rounded-xl"
                    >
                      Send anyway
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
        {!intervention && <div ref={threadEndRef} />}
      </div>

      {/* Compose */}
      <form
        onSubmit={handleSend}
        className="flex flex-shrink-0 flex-col gap-2 border-t border-border bg-card/80 px-4 py-3 backdrop-blur"
      >
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        <div className="flex items-end gap-2">
          <Input
            placeholder="Message"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={sending}
            className="flex-1 min-h-11 rounded-2xl border-border bg-muted/50 focus-visible:ring-2"
          />
          <Button
            type="submit"
            size="icon"
            disabled={sending || !input.trim()}
            className="h-11 w-11 flex-shrink-0 rounded-full"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
