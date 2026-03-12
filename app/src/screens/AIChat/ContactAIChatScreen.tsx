import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Sparkles, Trash2 } from "lucide-react";
import {
  getFlaggedContacts,
  getDeviceId,
  getUserContext,
  getContactAIChatHistory,
  setContactAIChatHistory,
  clearContactAIChatHistory,
} from "@/lib/storage";
import { streamSupportChat } from "@/api";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { InputBar } from "@/components/chat/InputBar";
import type { AIChatMessage } from "@/types";

const STARTERS = [
  "Why do I still miss them?",
  "I keep wanting to reach out",
  "Help me understand what happened",
  "How do I move on?",
];

export function ContactAIChatScreen() {
  const { contactId } = useParams<{ contactId: string }>();
  const navigate = useNavigate();

  const contact = contactId
    ? getFlaggedContacts().find((c) => c.id === contactId) ?? null
    : null;

  const [messages, setMessages] = useState<AIChatMessage[]>(() =>
    contactId ? getContactAIChatHistory(contactId) : []
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showClear, setShowClear] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Persist history whenever messages change
  useEffect(() => {
    if (contactId) setContactAIChatHistory(contactId, messages);
  }, [messages, contactId]);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || loading || !contactId) return;
      setInput("");
      setError(null);

      const userMsg: AIChatMessage = { role: "user", content: text };
      const nextMessages = [...messages, userMsg];
      setMessages(nextMessages);
      setLoading(true);

      const deviceId = getDeviceId();
      const stored = getUserContext();
      // Merge contact name into userContext so the AI knows who this is about
      const userContext = {
        ...stored,
        partnerName: stored?.partnerName ?? contact?.name,
      };

      try {
        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
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
          { deviceId, userContext }
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant" as const,
            content:
              "Sorry, I couldn't connect. Check that the backend is running and try again.",
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [messages, loading, contactId, contact]
  );

  function handleClear() {
    if (!contactId) return;
    clearContactAIChatHistory(contactId);
    setMessages([]);
    setShowClear(false);
  }

  if (!contact || !contactId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6">
        <p className="text-[14px] text-muted-foreground">Contact not found.</p>
      </div>
    );
  }

  const isEmpty = messages.length === 0;

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
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground flex-shrink-0">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-foreground leading-none truncate">
              AI Support — {contact.name}
            </p>
            <p className="text-[12px] text-muted-foreground mt-0.5">Private & confidential</p>
          </div>
        </div>

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

      {/* Clear confirmation */}
      {showClear && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-card border border-border p-5 shadow-xl">
            <p className="text-[15px] font-semibold text-foreground mb-1">Clear this chat?</p>
            <p className="text-[14px] text-muted-foreground">
              This removes your AI chat history with {contact.name}.
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
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-secondary mb-6">
              <Sparkles className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-xl font-semibold text-foreground mb-1.5">
              Talk about {contact.name}
            </p>
            <p className="text-[14px] text-muted-foreground max-w-[260px] leading-relaxed mb-8">
              This is a safe space to process your feelings. Nothing leaves your device.
            </p>
            <div className="flex flex-col gap-2 w-full max-w-sm">
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
              />
            ))}
          </>
        )}
        {error && (
          <p className="text-[13px] text-destructive text-center">{error}</p>
        )}
        <div ref={endRef} />
      </ChatWindow>

      <InputBar
        value={input}
        onChange={setInput}
        onSubmit={() => send(input.trim())}
        placeholder={`Talk about ${contact.name}…`}
        disabled={loading}
      />
    </div>
  );
}
