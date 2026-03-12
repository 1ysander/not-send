import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getFlaggedContacts, getDeviceId, getUserContext, getPartnerContext } from "@/lib/storage";
import { streamClosureChat } from "@/api";
import type { PartnerContext } from "@/api";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function ClosureScreen() {
  const { contactId } = useParams<{ contactId: string }>();
  const navigate = useNavigate();
  const contacts = getFlaggedContacts();
  const contact = contacts.find((c) => c.id === contactId) ?? null;

  const partnerCtx = getPartnerContext();
  // Build effective PartnerContext: prefer saved ctx, fallback to contact name
  const effectivePartner: PartnerContext = partnerCtx ?? {
    partnerName: contact?.name ?? "them",
  };

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <p className="text-sm text-muted-foreground mb-3">Contact not found.</p>
        <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
          Back to Messages
        </Button>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError(null);
    setShowInfo(false);

    const userMessage: ChatMessage = { role: "user", content: text };
    const updated = [...messages, userMessage];
    setMessages(updated);
    setLoading(true);

    const deviceId = getDeviceId();
    const userContext = getUserContext();

    try {
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
      let fullReply = "";
      await streamClosureChat(
        updated.map((m) => ({ role: m.role, content: m.content })),
        effectivePartner,
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
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }

  const partnerName = effectivePartner.partnerName;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <header className="flex flex-shrink-0 items-center h-14 gap-3 border-b border-border bg-background px-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={() => navigate(`/chat/${contactId}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{partnerName}</p>
          <p className="text-[11px] text-muted-foreground leading-none mt-0.5">Closure mode</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
          onClick={() => setShowInfo((s) => !s)}
          aria-label="About closure mode"
        >
          <Info className="h-4 w-4" />
        </Button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Info banner */}
        {showInfo && (
          <div className="rounded-xl bg-secondary border border-border p-3.5 mb-4 max-w-xl mx-auto">
            <p className="text-xs font-semibold text-foreground mb-1">What is closure mode?</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              AI responds as {partnerName} based on their known style. This is a safe space to say
              what you need to say — nothing is sent to anyone.
            </p>
            <button
              type="button"
              className="text-xs text-muted-foreground underline underline-offset-2 mt-2"
              onClick={() => setShowInfo(false)}
            >
              Got it
            </button>
          </div>
        )}

        {/* Empty state */}
        {messages.length === 0 && !showInfo && (
          <div className="flex flex-col items-center justify-center py-16 text-center max-w-xl mx-auto">
            <p className="text-sm font-medium text-foreground mb-1">
              Say what you need to say
            </p>
            <p className="text-sm text-muted-foreground max-w-xs">
              {partnerName} is here. This is your chance.
            </p>
          </div>
        )}

        {/* Chat bubbles */}
        <div className="space-y-2 max-w-xl mx-auto">
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
            >
              {m.role === "assistant" && (
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground mr-2 mt-1 self-end">
                  {partnerName[0]?.toUpperCase() ?? "?"}
                </div>
              )}
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-secondary text-foreground rounded-tl-sm"
                )}
              >
                {m.role === "assistant" && !m.content && loading ? (
                  <span className="text-muted-foreground italic text-xs">typing…</span>
                ) : (
                  <span className="whitespace-pre-wrap">{m.content}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {error && (
          <p className="mt-3 text-xs text-destructive text-center">{error}</p>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex-shrink-0 flex items-center gap-2 border-t border-border bg-background px-4 py-3"
      >
        <input
          type="text"
          placeholder={`Message ${partnerName}…`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e as unknown as React.FormEvent);
            }
          }}
          className="flex-1 h-10 rounded-full bg-secondary px-4 text-sm text-foreground placeholder:text-muted-foreground border-0 outline-none focus:ring-2 focus:ring-ring/30 transition-shadow disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className={cn(
            "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-colors",
            input.trim() && !loading
              ? "bg-primary text-primary-foreground hover:bg-primary/85"
              : "bg-secondary text-muted-foreground"
          )}
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
