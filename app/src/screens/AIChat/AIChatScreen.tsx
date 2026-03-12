import { useState, useRef, useEffect } from "react";
import { getDeviceId, getUserContext } from "@/lib/storage";
import { streamSupportChat } from "@/api";
import { Sparkles, SquarePen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { InputBar } from "@/components/chat/InputBar";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const STARTERS = [
  "I miss them so much right now",
  "I keep checking their profile",
  "Why do I keep wanting to reach out?",
  "I need help processing my feelings",
];

export function AIChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNewConfirm, setShowNewConfirm] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    setInput("");
    setError(null);
    const userMessage: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    const deviceId = getDeviceId();
    const userContext = getUserContext();
    const conversation: ChatMessage[] = [...messages, userMessage];

    try {
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
      let fullReply = "";
      await streamSupportChat(
        conversation.map((m) => ({ role: m.role, content: m.content })),
        (chunk) => {
          fullReply += chunk;
          setMessages((prev) => {
            const rest = prev.slice(0, -1);
            return [...rest, { role: "assistant", content: fullReply }];
          });
        },
        { deviceId, userContext }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I couldn't connect. Check that the backend is running and try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="flex-shrink-0 flex items-center h-14 border-b border-border px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[15px] font-semibold text-foreground leading-none">AI Support</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">Private & confidential</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => setShowNewConfirm(true)}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-full hover:bg-secondary transition-colors text-muted-foreground"
            aria-label="New conversation"
          >
            <SquarePen className="h-4 w-4" />
          </button>
        )}
      </header>

      {showNewConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-card border border-border p-5 shadow-xl animate-scale-in">
            <p className="text-[15px] font-semibold text-foreground mb-1">Start a new conversation?</p>
            <p className="text-[14px] text-muted-foreground">This will clear the current chat.</p>
            <div className="mt-5 flex gap-2.5">
              <Button variant="secondary" className="flex-1" onClick={() => setShowNewConfirm(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={() => { setMessages([]); setError(null); setShowNewConfirm(false); }}>
                New chat
              </Button>
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
            <p className="text-xl font-semibold text-foreground mb-1.5">How are you feeling?</p>
            <p className="text-[14px] text-muted-foreground max-w-[260px] leading-relaxed mb-8">
              This is a safe space. Talk openly — nothing leaves your device.
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
        placeholder="Message"
        disabled={loading}
      />
    </div>
  );
}
