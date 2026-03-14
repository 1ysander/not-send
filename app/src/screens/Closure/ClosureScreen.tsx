/**
 * Closure chat — AI fully simulates the ex's voice using uploaded conversation data.
 * Goal is not to pretend they're back, but to give the user the conversation they need.
 * Uses buildClosureSystemPrompt on the backend via /chat/closure.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { InputBar } from "@/components/chat/InputBar";
import { MessageBubble } from "@/components/chat/MessageBubble";
import type { DeliveryStatus } from "@/components/chat/MessageBubble";
import { ContactAvatar } from "@/components/ContactAvatar";
import {
  getFlaggedContacts,
  getDeviceId,
  getUserContext,
  getContactProfile,
} from "@/lib/storage";
import { streamClosureChat } from "@/api";
import type { AIChatMessage, RelationshipMemory } from "@/types";

const CLOSURE_STARTERS = [
  "I just wanted to say goodbye properly",
  "Why did you stop trying?",
  "I miss who we were",
  "I need to understand what happened",
];

function computeUiDelayMs(mem: RelationshipMemory | undefined): number {
  if (!mem) return 1200;
  const jitter = () => Math.random() * 600 - 300;
  switch (mem.responseDelayProfile) {
    case "instant":       return Math.max(400, 800 + jitter());
    case "quick":         return Math.max(800, 2200 + jitter());
    case "slow":          return Math.max(2000, 5000 + jitter() * 2);
    case "unpredictable": return 800 + Math.random() * 6000;
    default:              return 1500;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function ClosureScreen() {
  const { contactId } = useParams<{ contactId: string }>();
  const navigate = useNavigate();

  const contact = contactId
    ? getFlaggedContacts().find((c) => c.id === contactId) ?? null
    : null;

  const profile = contactId ? getContactProfile(contactId) : null;

  const partnerContext = contact
    ? {
        partnerName: contact.name,
        sampleMessages: profile?.sampleMessages,
        relationshipMemory: profile?.relationshipMemory,
      }
    : null;

  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "typing">("idle");
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>("none");
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || status !== "idle" || !partnerContext) return;
      setInput("");
      setError(null);

      const userMsg: AIChatMessage = { role: "user", content: text };
      const nextMessages = [...messages, userMsg];
      setMessages(nextMessages);

      const deviceId = getDeviceId();
      const userContext = getUserContext();

      // Phase 1: Delivered
      setDeliveryStatus("delivered");

      // Phase 2: Read — short human-feeling delay
      const readDelay = 800 + Math.random() * 1700;
      await sleep(readDelay);
      setDeliveryStatus("read");

      // Phase 3: Typing — realistic delay before response
      const typingDelay = computeUiDelayMs(profile?.relationshipMemory);
      await sleep(typingDelay);

      setStatus("typing");
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      try {
        let fullReply = "";
        await streamClosureChat(
          nextMessages.map((m) => ({ role: m.role, content: m.content })),
          partnerContext,
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
    [messages, status, partnerContext, profile]
  );

  if (!contact || !partnerContext) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6">
        <p className="text-[14px] text-muted-foreground">Contact not found.</p>
      </div>
    );
  }

  const isEmpty = messages.length === 0;
  const loading = status !== "idle";

  const lastUserMsgIdx = messages.reduce<number>(
    (acc, m, i) => (m.role === "user" ? i : acc),
    -1
  );

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <header className="flex-shrink-0 flex items-center h-14 border-b border-border px-3 gap-2">
        <button
          type="button"
          onClick={() => navigate(`/chat/${contactId}`)}
          className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-secondary transition-colors text-[#bf5af2]"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
        </button>
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <ContactAvatar contact={contact} size="md" />
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-foreground leading-none truncate">
              {contact.name}
            </p>
            <p className="text-[12px] text-muted-foreground mt-0.5 h-4">
              {status === "typing" ? "typing…" : "closure conversation"}
            </p>
          </div>
        </div>

        {/* Safe space pill */}
        <span className="flex-shrink-0 text-[11px] font-medium text-muted-foreground bg-secondary px-2.5 py-1 rounded-full">
          safe space
        </span>
      </header>

      <ChatWindow>
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <ContactAvatar contact={contact} size="2xl" className="mb-5" />
            <p className="text-xl font-semibold text-foreground mb-2">
              {contact.name}
            </p>
            <p className="text-[14px] text-muted-foreground max-w-[280px] leading-relaxed mb-2">
              This is a safe space. The AI will respond as {contact.name} — not to get back together, but to help you say what you need to say.
            </p>
            <p className="text-[12px] text-muted-foreground/60 max-w-[240px] leading-relaxed mb-8">
              Nothing you say here will be sent.
            </p>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              {CLOSURE_STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-xl border border-border bg-background px-4 py-3 text-[14px] text-left text-foreground hover:bg-secondary transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((m, i) => (
              <MessageBubble
                key={i}
                role={m.role}
                content={m.content}
                loading={m.role === "assistant" && !m.content && loading}
                deliveryStatus={
                  m.role === "user" && i === lastUserMsgIdx && deliveryStatus !== "none"
                    ? deliveryStatus
                    : undefined
                }
              />
            ))}
          </>
        )}
        {error && (
          <p className="text-[13px] text-destructive text-center px-4">{error}</p>
        )}
        <div ref={endRef} />
      </ChatWindow>

      <InputBar
        value={input}
        onChange={setInput}
        onSubmit={() => send(input.trim())}
        placeholder={`Say something to ${contact.name}…`}
        disabled={loading}
      />
    </div>
  );
}
