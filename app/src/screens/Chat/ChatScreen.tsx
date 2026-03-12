import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Trash2, ChevronLeft, Shield, HeartCrack, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { InputBar } from "@/components/chat/InputBar";
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

const CANNED_REPLY = `Hey — before you hit send, take a breath.

Sending might not give you what you're really looking for. What do you actually need right now that isn't them? You've got this.`;

export function ChatScreen() {
  const { contactId } = useParams<{ contactId: string }>();
  const contacts      = getFlaggedContacts();
  const contact       = useMemo(
    () => (contactId ? contacts.find((c) => c.id === contactId) : null),
    [contacts, contactId]
  );

  const [sessions, setSessions]             = useState<LocalSession[]>(() =>
    contactId ? getSessionsForContact(contactId) : []
  );
  const [input, setInput]                   = useState("");
  const [sending, setSending]               = useState(false);
  const [error, setError]                   = useState("");
  const [showDeleteConfirm, setShowDelete]  = useState(false);
  const [intervention, setIntervention]     = useState<InterventionState | null>(null);
  const threadEndRef                        = useRef<HTMLDivElement>(null);
  const navigate                            = useNavigate();
  const socket                              = useConversationSocketOptional();
  const liveMessages                        = intervention ? socket?.getMessages(intervention.sessionId) : undefined;
  const liveReply                           = liveMessages?.filter((m) => m.role === "assistant").pop()?.content ?? null;

  function refreshSessions() {
    if (contactId) setSessions(getSessionsForContact(contactId));
  }

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [intervention?.reply, intervention?.loading, sessions]);

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || sending || !contactId || !contact) return;
    setError("");
    setSending(true);
    setInput("");

    let sessionId: string;
    try {
      const deviceId   = getDeviceId();
      const userContext = getUserContext();
      const result     = await startReview(webReviewTransport, text, {
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

    const deviceId    = getDeviceId();
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
    setShowDelete(false);
    navigate("/", { replace: true });
  }

  if (!contactId || !contact) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6">
        <p className="text-[14px] text-muted-foreground">Contact not found.</p>
        <Button variant="ghost" className="mt-2" onClick={() => navigate("/")}>
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

      {/* ── Header ── */}
      <header className="sticky top-0 z-10 flex flex-shrink-0 items-center h-14 gap-2 border-b border-border px-3 bg-background">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => navigate("/")}
          className="text-[#bf5af2] -ml-1"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
        </Button>

        {/* Contact avatar + name */}
        <div className="flex flex-1 items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#bf5af2]/15 text-[13px] font-semibold text-[#bf5af2]">
            {contact.name.trim()[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-foreground truncate leading-none">
              {contact.name}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Protected contact</p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setShowDelete(true)}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </header>

      {/* ── Delete modal ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-card border border-border p-5 shadow-xl animate-scale-in">
            <p className="text-[15px] font-semibold text-foreground mb-1">Delete conversation?</p>
            <p className="text-[14px] text-muted-foreground">
              This removes messages from this thread only.
            </p>
            <div className="mt-5 flex gap-2.5">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setShowDelete(false)}
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

      <ChatWindow>
        <div className="space-y-6">
          {threadMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-up">
              <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-secondary mb-4 shadow-sm">
                <Shield className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <p className="text-[16px] font-semibold text-foreground mb-1.5">Protected thread</p>
              <p className="text-[14px] text-muted-foreground max-w-[260px] leading-relaxed">
                Type what you want to send {contact.name}. We'll step in before it goes.
              </p>
              <button
                type="button"
                onClick={() => navigate(`/closure/${contact.id}`)}
                className="mt-6 flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
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
                "flex max-w-xl",
                m.outcome === "sent" ? "ml-auto justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "rounded-xl px-4 py-3 text-[15px] leading-relaxed",
                  m.outcome === "sent"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-foreground"
                )}
              >
                <p className="leading-relaxed">{m.text}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  {m.outcome !== "sent" && (
                    <span className="text-[11px] opacity-70 italic">Not sent</span>
                  )}
                  <span className="text-[11px] opacity-70">
                    {new Date(m.timestamp).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {intervention && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="h-0.5 bg-primary" />
              <div className="px-4 pt-3 pb-2 border-b border-border">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    NOTSENT
                  </p>
                </div>
                <p className="text-[13px] text-muted-foreground">You were about to send:</p>
                <p className="text-[14px] font-medium text-foreground mt-0.5">
                  "{intervention.messageAttempted}"
                </p>
              </div>
              <div className="px-4 py-3 min-h-[4rem]">
                {intervention.loading && !intervention.reply && !liveReply ? (
                  <div className="flex items-center gap-1.5">
                    <span className="typing-dot opacity-60" />
                    <span className="typing-dot opacity-60" />
                    <span className="typing-dot opacity-60" />
                  </div>
                ) : (
                  <p className="text-[15px] text-foreground whitespace-pre-wrap leading-relaxed">
                    {liveReply ?? intervention.reply}
                  </p>
                )}
                {intervention.error && (
                  <p className="text-[13px] text-destructive mt-1">{intervention.error}</p>
                )}
                <div ref={threadEndRef} />
              </div>
              {!intervention.loading && (
                <div className="flex gap-3 px-4 pb-4 pt-1">
                  <Button
                    onClick={() => handleOutcome("intercepted")}
                    disabled={intervention.actionLoading}
                    className="flex-1 rounded-lg bg-primary text-primary-foreground"
                  >
                    Won't send it
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleOutcome("sent")}
                    disabled={intervention.actionLoading}
                    className="flex-1 rounded-lg"
                  >
                    Send anyway
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
        {!intervention && <div ref={threadEndRef} />}
      </ChatWindow>

      {error && (
        <p className="px-4 py-1 text-[12px] text-destructive bg-background">{error}</p>
      )}
      <InputBar
        value={input}
        onChange={setInput}
        onSubmit={handleSend}
        placeholder={`Message ${contact.name}…`}
        disabled={sending}
      />
    </div>
  );
}
