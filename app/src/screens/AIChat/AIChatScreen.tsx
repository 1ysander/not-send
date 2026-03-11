import { useState, useRef, useEffect } from "react";
import { getDeviceId, getUserContext } from "@/lib/storage";
import { streamSupportChat } from "@/api";
import { PageLayout } from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function AIChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
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
          content:
            "Sorry, I couldn't connect. Check that the backend is running and try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <PageLayout title="AI Chat">
      <div className="flex flex-1 flex-col min-h-0">
        <div className="flex-1 overflow-y-auto p-4">
          {isEmpty && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4">
                <Bot className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="mt-4 text-lg font-medium">How can I help you today?</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Talk to NOTSENT for support — no message is sent to anyone.
              </p>
            </div>
          )}
          <div className="space-y-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-3",
                  m.role === "user" && "flex-row-reverse"
                )}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {m.role === "user" ? "U" : "A"}
                </div>
                <div
                  className={cn(
                    "max-w-[85%] rounded-xl px-3 py-2 text-sm shadow-soft",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  {m.role === "assistant" && !m.content && loading ? (
                    <span className="text-muted-foreground">Thinking…</span>
                  ) : (
                    <span className="whitespace-pre-wrap">{m.content}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {error && (
            <p className="mt-2 text-sm text-destructive">{error}</p>
          )}
          <div ref={endRef} />
        </div>
        <form
          onSubmit={handleSubmit}
          className="flex gap-2 border-t border-border bg-card/50 p-3 backdrop-blur"
        >
          <Input
            placeholder="Message"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={loading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </PageLayout>
  );
}
