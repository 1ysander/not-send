import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Trash2, Send, ArrowLeft, ShieldCheck, HeartCrack } from "lucide-react";
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
  const [intervention, setIntervention] = useState<InterventionState | null>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const socket = useConversationSocketOptional();
  const liveMessages = intervention ? socket?.getMessages(intervention.sessionId) : undefined;
  const liveReply = liveMessages?.filter((m) => m.role === "assistant").pop()?.content ?? null;

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
                error: err instanceof Error ? err.message : "Something went wrong",
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
        <p className="text-sm text-muted-foreground">Contact not found.</p>
        <Button variant="ghost" className="mt-2 text-sm" onClick={() => navigate("/")}>
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
      {/* Header */}
      <header className="flex flex-shrink-0 items-center h-14 gap-3 border-b border-border bg-background px-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{contact.name}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={() => setShowDeleteConfirm(true)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </header>

      {/* Delete confirm modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-card border border-border p-5 shadow-lg">
            <p className="text-sm font-medium text-foreground mb-1">Delete conversation?</p>
            <p className="text-sm text-muted-foreground">
              Messages will be removed from this thread only.
            </p>
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleDeleteChat}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Thread */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-5 space-y-3 max-w-xl mx-auto">
          {threadMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary mb-3">
                <ShieldCheck className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">Protected thread</p>
              <p className="text-sm text-muted-foreground max-w-xs">
                Type what you want to send {contact.name}. NOTSENT will intercept before it goes.
              </p>
              <button
                type="button"
                onClick={() => navigate(`/closure/${contact.id}`)}
                className="mt-5 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <HeartCrack className="h-3.5 w-3.5" />
                Get closure instead
              </button>
            </div>
          )}

          {threadMessages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex",
                m.outcome === "sent" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[78%] rounded-2xl px-3.5 py-2.5",
                  m.outcome === "sent"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-secondary text-foreground rounded-tl-sm"
                )}
              >
                <p className="text-sm leading-relaxed">{m.text}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  {m.outcome !== "sent" && (
                    <span className="text-[11px] opacity-60 italic">Not sent</span>
                  )}
                  <span className="text-[11px] opacity-55">
                    {new Date(m.timestamp).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {/* Intervention card */}
          {intervention && (
            <div className="rounded-2xl border border-border bg-card overflow-hidden mt-2">
              <div className="px-4 py-3 border-b border-border bg-secondary/40">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  You were about to send
                </p>
                <p className="text-sm font-medium text-foreground mt-1">
                  "{intervention.messageAttempted}"
                </p>
              </div>
              <div className="px-4 py-3 min-h-[3.5rem]">
                {intervention.loading && !intervention.reply && !liveReply ? (
                  <p className="text-sm text-muted-foreground italic">Thinking…</p>
                ) : (
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {liveReply ?? intervention.reply}
                  </p>
                )}
                {intervention.error && (
                  <p className="text-sm text-destructive mt-1">{intervention.error}</p>
                )}
                <div ref={threadEndRef} />
              </div>
              {!intervention.loading && (
                <div className="flex gap-2 px-4 pb-4 pt-1">
                  <Button
                    onClick={() => handleOutcome("intercepted")}
                    disabled={intervention.actionLoading}
                    className="flex-1 h-10 text-sm"
                  >
                    Won't send it
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleOutcome("sent")}
                    disabled={intervention.actionLoading}
                    className="flex-1 h-10 text-sm"
                  >
                    Send anyway
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
        {!intervention && <div ref={threadEndRef} />}
      </div>

      {/* Compose */}
      <form
        onSubmit={handleSend}
        className="flex flex-shrink-0 items-end gap-2 border-t border-border bg-background px-4 py-3"
      >
        {error && <p className="text-xs text-destructive absolute">{error}</p>}
        <div className="flex flex-1 items-center gap-2">
          <input
            type="text"
            placeholder={`Message ${contact.name}…`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={sending}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(e as unknown as React.FormEvent);
              }
            }}
            className="flex-1 h-10 rounded-full bg-secondary px-4 text-sm text-foreground placeholder:text-muted-foreground border-0 outline-none focus:ring-2 focus:ring-ring/30 transition-shadow"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className={cn(
              "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-colors",
              input.trim()
                ? "bg-primary text-primary-foreground hover:bg-primary/85"
                : "bg-secondary text-muted-foreground"
            )}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
