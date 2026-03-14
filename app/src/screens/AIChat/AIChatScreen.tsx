/**
 * General emotional support chat — no contact needed, no specific message trigger.
 * The AI is a warm non-judgmental companion. Sends userContext + partnerContext
 * (if available from the first contact) so the AI has real relationship context.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Bot } from "lucide-react";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { InputBar } from "@/components/chat/InputBar";
import { MessageBubble } from "@/components/chat/MessageBubble";
import {
  getFlaggedContacts,
  getDeviceId,
  getUserContext,
  getContactProfile,
} from "@/lib/storage";
import { streamSupportChat } from "@/api";
import type { AIChatMessage } from "@/types";

const SUPPORT_STARTERS = [
  "I'm really struggling today",
  "I keep thinking about them",
  "Why does it still hurt this much?",
  "I just need to talk to someone",
];

export function AIChatScreen() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;
      setInput("");
      setError(null);

      const userMsg: AIChatMessage = { role: "user", content: text };
      const nextMessages = [...messages, userMsg];
      setMessages(nextMessages);
      setLoading(true);

      // Pull all context from storage so the AI knows about the relationship
      const deviceId = getDeviceId();
      const userContext = getUserContext();

      // Use first contact's profile for relationship memory if available
      const contacts = getFlaggedContacts();
      const firstContact = contacts[0];
      const profile = firstContact ? getContactProfile(firstContact.id) : null;

      const partnerContext = (firstContact && (profile?.sampleMessages?.length || profile?.relationshipMemory))
        ? {
            partnerName: firstContact.name,
            sampleMessages: profile?.sampleMessages,
            relationshipMemory: profile?.relationshipMemory,
          }
        : undefined;

      // Placeholder bubble while streaming
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      try {
        let fullReply = "";
        await streamSupportChat(
          nextMessages.map((m) => ({ role: m.role, content: m.content })),
          (chunk) => {
            fullReply += chunk;
            setMessages((prev) => {
              const rest = prev.slice(0, -1);
              return [...rest, { role: "assistant" as const, content: fullReply }];
            });
          },
          { userContext, deviceId, partnerContext }
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
        setLoading(false);
      }
    },
    [messages, loading]
  );

  const isEmpty = messages.length === 0;

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
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 flex-shrink-0">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-foreground leading-none">Support</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {loading ? "typing…" : "here for you"}
            </p>
          </div>
        </div>
      </header>

      <ChatWindow>
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-5">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <p className="text-xl font-semibold text-foreground mb-2">
              I'm here
            </p>
            <p className="text-[14px] text-muted-foreground max-w-[260px] leading-relaxed mb-8">
              Talk through whatever you're feeling. No judgment, no advice you didn't ask for.
            </p>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              {SUPPORT_STARTERS.map((s) => (
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
        placeholder="How are you feeling…"
        disabled={loading}
      />
    </div>
  );
}
