/**
 * Intervention chat — AI talks the user through the impulse to send a message
 * before it goes anywhere. Core product loop.
 *
 * Entry: navigate("/intervention", { state: { messageAttempted, contactId } })
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronLeft, ShieldOff, ShieldCheck } from "lucide-react";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { InputBar } from "@/components/chat/InputBar";
import { MessageBubble } from "@/components/chat/MessageBubble";
import type { DeliveryStatus } from "@/components/chat/MessageBubble";
import { getFlaggedContacts, getDeviceId, getUserContext, addSession } from "@/lib/storage";
import { createSession, streamChat } from "@/api";
import type { AIChatMessage } from "@/types";

interface InterventionLocationState {
  messageAttempted?: string;
  contactId?: string;
}

type Phase = "initializing" | "chatting" | "done";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function InterventionChat() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as InterventionLocationState;
  const messageAttempted = state.messageAttempted ?? "";
  const contactId = state.contactId;

  const contact = contactId
    ? getFlaggedContacts().find((c) => c.id === contactId) ?? null
    : null;

  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "typing">("idle");
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>("none");
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("initializing");
  const [sessionId, setSessionId] = useState<string | null>(null);

  const endRef = useRef<HTMLDivElement>(null);
  const didInit = useRef(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /** Stream one AI reply using the given session + current history. */
  const streamReply = useCallback(
    async (sid: string, history: AIChatMessage[]) => {
      setStatus("typing");
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      try {
        const deviceId = getDeviceId();
        const userContext = getUserContext();
        let fullReply = "";

        await streamChat(
          sid,
          messageAttempted,
          history.map((m) => ({ role: m.role, content: m.content })),
          (chunk) => {
            fullReply += chunk;
            setMessages((prev) => {
              const rest = prev.slice(0, -1);
              return [...rest, { role: "assistant" as const, content: fullReply }];
            });
          },
          { userContext, deviceId }
        );
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Something went wrong");
        setMessages((prev) => [
          ...prev.slice(0, -1),
          {
            role: "assistant" as const,
            content: "Couldn't connect — make sure the backend is running.",
          },
        ]);
      } finally {
        setStatus("idle");
        setDeliveryStatus("none");
      }
    },
    [messageAttempted]
  );

  /** On mount: create session + stream first AI response. */
  useEffect(() => {
    if (didInit.current || !messageAttempted) return;
    didInit.current = true;

    async function init() {
      try {
        const deviceId = getDeviceId();
        const { sessionId: sid } = await createSession(messageAttempted, { deviceId });
        setSessionId(sid);
        setPhase("chatting");
        // Kick off the first AI message with empty history (AI opens the conversation)
        await streamReply(sid, []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to start session");
        setPhase("chatting");
      }
    }

    void init();
  }, [messageAttempted, streamReply]);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || status !== "idle" || !sessionId) return;
      setInput("");
      setError(null);

      const userMsg: AIChatMessage = { role: "user", content: text };
      const nextMessages = [...messages, userMsg];
      setMessages(nextMessages);

      // Delivery receipt sequence
      setDeliveryStatus("delivered");
      await sleep(600 + Math.random() * 800);
      setDeliveryStatus("read");
      await sleep(800 + Math.random() * 1200);

      await streamReply(sessionId, nextMessages);
    },
    [messages, status, sessionId, streamReply]
  );

  function handleOutcome(sent: boolean) {
    setPhase("done");
    const localId = `session_${Date.now()}`;
    if (contactId) {
      addSession({
        id: localId,
        contactId,
        timestamp: Date.now(),
        messageAttempted,
      });
    }
    if (contactId) {
      navigate(`/chat/${contactId}`, { replace: true });
    } else {
      navigate("/", { replace: true });
    }
    void sent; // outcome recorded; no actual send ever happens
  }

  const isTyping = status === "typing";
  const lastUserMsgIdx = messages.reduce<number>(
    (acc, m, i) => (m.role === "user" ? i : acc),
    -1
  );

  if (!messageAttempted) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-6">
        <p className="text-[14px] text-muted-foreground text-center">
          No message to intercept. Go back and type something first.
        </p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mt-4 text-[14px] text-primary underline"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <header className="flex-shrink-0 flex items-center h-14 border-b border-border px-3 gap-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-secondary transition-colors text-[#bf5af2]"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-foreground leading-none">
            Message Intercepted
          </p>
          <p className="text-[12px] text-muted-foreground mt-0.5 h-4">
            {isTyping ? "thinking…" : contact ? `about ${contact.name}` : "let's talk through this"}
          </p>
        </div>

        <span className="flex-shrink-0 text-[11px] font-medium text-muted-foreground bg-secondary px-2.5 py-1 rounded-full">
          not sent
        </span>
      </header>

      {/* Intercepted message preview */}
      <div className="flex-shrink-0 border-b border-border bg-secondary/40 px-4 py-3">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
          Draft message
        </p>
        <p className="text-[14px] text-foreground italic leading-relaxed line-clamp-3">
          "{messageAttempted}"
        </p>
      </div>

      <ChatWindow>
        {phase === "initializing" && messages.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2 text-[14px] text-muted-foreground">
              <span className="animate-pulse">Reading your message…</span>
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <MessageBubble
            key={i}
            role={m.role}
            content={m.content}
            loading={m.role === "assistant" && !m.content && isTyping}
            deliveryStatus={
              m.role === "user" && i === lastUserMsgIdx && deliveryStatus !== "none"
                ? deliveryStatus
                : undefined
            }
          />
        ))}

        {error && (
          <p className="text-[13px] text-destructive text-center px-4">{error}</p>
        )}

        {/* Bottom CTA — shown once AI has responded at least once */}
        {messages.some((m) => m.role === "assistant" && m.content) && phase === "chatting" && !isTyping && (
          <div className="flex gap-3 px-2 py-4 mt-2">
            <button
              type="button"
              onClick={() => handleOutcome(false)}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-primary/10 border border-primary/20 py-3.5 text-[14px] font-semibold text-primary hover:bg-primary/15 transition-colors active:scale-95"
            >
              <ShieldCheck className="h-4 w-4" />
              I won't send it
            </button>
            <button
              type="button"
              onClick={() => handleOutcome(true)}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-secondary border border-border py-3.5 text-[14px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors active:scale-95"
            >
              <ShieldOff className="h-4 w-4" />
              Send anyway
            </button>
          </div>
        )}

        <div ref={endRef} />
      </ChatWindow>

      <InputBar
        value={input}
        onChange={setInput}
        onSubmit={() => send(input.trim())}
        placeholder="Reply…"
        disabled={isTyping || phase === "initializing"}
      />
    </div>
  );
}
