import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Trash2, Heart, ShieldAlert } from "lucide-react";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { InputBar } from "@/components/chat/InputBar";
import { MessageBubble } from "@/components/chat/MessageBubble";
import type { DeliveryStatus } from "@/components/chat/MessageBubble";
import { ContactAvatar } from "@/components/ContactAvatar";
import {
  getFlaggedContacts,
  getDeviceId,
  getContactProfile,
  getUserContext,
  getContactAIChatHistory,
  setContactAIChatHistory,
  clearContactAIChatHistory,
  getContactAIChatHistoryRemote,
  appendContactAIChatMessageRemote,
  clearContactAIChatHistoryRemote,
  supabaseEnabled,
} from "../../lib/storage";
import { streamContactChatAPI } from "../../api";
import type { AIChatMessage, RelationshipMemory } from "../../types";

type ChatStatus = "idle" | "typing";

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

const STARTERS = [
  "Hey",
  "I've been thinking about you",
  "Can we talk?",
  "I miss you",
];

export function ChatScreen() {
  const { contactId } = useParams<{ contactId: string }>();
  const navigate = useNavigate();

  const contact = contactId
    ? getFlaggedContacts().find((c) => c.id === contactId) ?? null
    : null;

  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>("none");
  const [error, setError] = useState<string | null>(null);
  const [showClear, setShowClear] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load chat history on mount — remote if Supabase enabled, local otherwise
  useEffect(() => {
    if (!contactId) return;
    if (supabaseEnabled) {
      getContactAIChatHistoryRemote(contactId)
        .then((msgs) => {
          setMessages(msgs);
          setContactAIChatHistory(contactId, msgs); // update local cache
        })
        .catch(() => setMessages(getContactAIChatHistory(contactId)));
    } else {
      setMessages(getContactAIChatHistory(contactId));
    }
  }, [contactId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || status !== "idle" || !contactId || !contact) return;
      setInput("");
      setError(null);

      const userMsg: AIChatMessage = { role: "user", content: text };
      const nextMessages = [...messages, userMsg];
      setMessages(nextMessages);

      const deviceId = getDeviceId();
      const stored = getUserContext();
      const profile = getContactProfile(contactId);

      const userContext = {
        ...stored,
        partnerName: stored?.partnerName ?? contact.name,
        breakupSummary: stored?.breakupSummary ?? profile?.breakupSummary,
        noContactDays: stored?.noContactDays ?? profile?.noContactDays,
      };

      const partnerContext = {
        partnerName: contact.name,
        sampleMessages: profile?.sampleMessages,
        relationshipMemory: profile?.relationshipMemory,
      };

      // Phase 1: Delivered — message sent, awaiting read receipt
      setDeliveryStatus("delivered");

      // Phase 2: Read — after a short human-feeling delay (0.8–2.5s)
      const readDelay = 800 + Math.random() * 1700;
      await sleep(readDelay);
      setDeliveryStatus("read");

      // Phase 3: Typing — realistic delay before they respond
      const typingDelay = computeUiDelayMs(profile?.relationshipMemory);
      await sleep(typingDelay);

      setStatus("typing");
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      try {
        let fullReply = "";
        await streamContactChatAPI(
          nextMessages.map((m) => ({ role: m.role, content: m.content })),
          partnerContext,
          (chunk) => {
            fullReply += chunk;
            setMessages((prev) => {
              const rest = prev.slice(0, -1);
              return [...rest, { role: "assistant" as const, content: fullReply }];
            });
          },
          { deviceId, userContext, conversationId: contactId }
        );
        // Persist completed turn
        const assistantMsg: AIChatMessage = { role: "assistant" as const, content: fullReply };
        if (supabaseEnabled) {
          try {
            await appendContactAIChatMessageRemote(contactId, userMsg);
            await appendContactAIChatMessageRemote(contactId, assistantMsg);
          } catch {
            // fallback: local cache already kept by next line
          }
        }
        setContactAIChatHistory(contactId, [...nextMessages, assistantMsg]);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Something went wrong");
        setMessages((prev) => [
          ...prev.slice(0, -1),
          {
            role: "assistant" as const,
            content: "couldn't connect. make sure the backend is running.",
          },
        ]);
      } finally {
        setStatus("idle");
        setDeliveryStatus("none");
      }
    },
    [messages, status, contactId, contact]
  );

  function handleClear() {
    if (!contactId) return;
    clearContactAIChatHistory(contactId);
    if (supabaseEnabled) {
      clearContactAIChatHistoryRemote(contactId).catch(() => {});
    }
    setMessages([]);
    setShowClear(false);
    setDeliveryStatus("none");
  }

  if (!contact || !contactId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6">
        <p className="text-[14px] text-muted-foreground">Contact not found.</p>
      </div>
    );
  }

  const isEmpty = messages.length === 0;
  const loading = status !== "idle";

  // Index of the last user message (to attach the receipt to)
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
          onClick={() => navigate("/")}
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
              {status === "typing" ? "typing…" : ""}
            </p>
          </div>
        </div>

        {/* Closure shortcut */}
        <button
          type="button"
          onClick={() => navigate(`/closure/${contactId}`)}
          className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-secondary transition-colors text-muted-foreground hover:text-[#bf5af2]"
          aria-label="Closure conversation"
          title="Talk for closure"
        >
          <Heart className="h-4 w-4" />
        </button>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => setShowClear(true)}
            className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-secondary transition-colors text-muted-foreground hover:text-destructive"
            aria-label="Clear chat"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </header>

      {/* Clear confirmation modal */}
      {showClear && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-card border border-border p-5 shadow-xl">
            <p className="text-[15px] font-semibold text-foreground mb-1">Clear this chat?</p>
            <p className="text-[14px] text-muted-foreground">
              This removes your conversation history with {contact.name}.
            </p>
            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                onClick={() => setShowClear(false)}
                className="flex-1 rounded-lg border border-border py-2.5 text-[14px] font-medium text-foreground hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="flex-1 rounded-lg bg-destructive py-2.5 text-[14px] font-medium text-destructive-foreground hover:opacity-90 transition-opacity"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      <ChatWindow>
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ContactAvatar contact={contact} size="2xl" className="mb-6" />
            <p className="text-xl font-semibold text-foreground mb-1.5">
              {contact.name}
            </p>
            <p className="text-[14px] text-muted-foreground max-w-[240px] leading-relaxed mb-8">
              Say something. The AI will respond as {contact.name} based on your uploaded conversation.
            </p>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              {STARTERS.map((s) => (
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

      {/* Intercept strip — visible when user has typed something */}
      {input.trim().length > 0 && !loading && (
        <div className="flex-shrink-0 border-t border-border/60 bg-background/95 px-4 pt-2 pb-1">
          <button
            type="button"
            onClick={() => {
              const draft = input.trim();
              if (!draft) return;
              setInput("");
              navigate("/intervention", { state: { messageAttempted: draft, contactId } });
            }}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#bf5af2]/10 border border-[#bf5af2]/25 py-2.5 text-[13px] font-medium text-[#bf5af2] hover:bg-[#bf5af2]/15 transition-colors active:scale-95"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            Intercept this message before sending
          </button>
        </div>
      )}
      <InputBar
        value={input}
        onChange={setInput}
        onSubmit={() => send(input.trim())}
        placeholder={`Message ${contact.name}…`}
        disabled={loading}
      />
    </div>
  );
}
