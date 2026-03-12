import { useState, useRef, useEffect } from "react";
import { getDeviceId, getUserContext } from "@/lib/storage";
import { streamSupportChat } from "@/api";
import { Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const endRef                  = useRef<HTMLDivElement>(null);

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

    const deviceId    = getDeviceId();
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await send(input.trim());
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full bg-background">

      {/* ── Header ── */}
      <header className="glass sticky top-0 z-10 flex items-center h-14 border-b px-4 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gradient shadow-sm">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-[15px] font-semibold text-foreground leading-none">AI Support</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Private & confidential</p>
          </div>
        </div>
      </header>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full py-16 text-center animate-fade-up">
            <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-brand-gradient shadow-lg mb-5">
              <Sparkles className="h-7 w-7 text-white" />
            </div>
            <p className="text-[20px] font-bold text-foreground mb-1.5">
              How are you feeling?
            </p>
            <p className="text-[14px] text-muted-foreground max-w-[240px] leading-relaxed mb-8">
              This is a safe space. Talk openly — nothing leaves your device.
            </p>

            {/* Quick starters */}
            <div className="flex flex-col gap-2 w-full max-w-xs">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-xl border border-border bg-card px-4 py-3 text-[14px] text-left text-foreground hover:bg-secondary transition-colors active:scale-[0.98]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2.5 max-w-xl mx-auto">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "flex animate-fade-in",
                  m.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {m.role === "assistant" && (
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-gradient mr-2 mt-1 self-end shadow-sm">
                    <Sparkles className="h-3.5 w-3.5 text-white" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-[18px] px-3.5 py-2.5 text-[15px] leading-relaxed",
                    m.role === "user"
                      ? "bg-foreground text-background rounded-br-[4px]"
                      : "bg-secondary text-foreground rounded-bl-[4px]"
                  )}
                >
                  {m.role === "assistant" && !m.content && loading ? (
                    <div className="flex items-center gap-1.5 py-1">
                      <span className="typing-dot text-muted-foreground" />
                      <span className="typing-dot text-muted-foreground" />
                      <span className="typing-dot text-muted-foreground" />
                    </div>
                  ) : (
                    <span className="whitespace-pre-wrap">{m.content}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {error && (
          <p className="mt-2 text-[12px] text-destructive text-center">{error}</p>
        )}
        <div ref={endRef} />
      </div>

      {/* ── Input ── */}
      <form
        onSubmit={handleSubmit}
        className="glass flex-shrink-0 flex items-center gap-2 border-t px-3.5 py-2.5 pb-safe"
      >
        <input
          type="text"
          placeholder="Message"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e as unknown as React.FormEvent);
            }
          }}
          className="flex-1 h-10 rounded-full bg-secondary px-4 text-[15px] text-foreground placeholder:text-muted-foreground border-0 outline-none focus:ring-2 focus:ring-[#bf5af2]/30 transition-shadow disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Send"
          className={cn(
            "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-all duration-150 active:scale-90",
            input.trim() && !loading
              ? "bg-brand-gradient text-white shadow-sm"
              : "bg-secondary text-muted-foreground"
          )}
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
