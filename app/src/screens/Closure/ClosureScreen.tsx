import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getFlaggedContacts, getDeviceId, getUserContext, getPartnerContext } from "@/lib/storage";
import { streamClosureChat } from "@/api";
import type { PartnerContext } from "@/api";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Send, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function ClosureScreen() {
  const { contactId } = useParams<{ contactId: string }>();
  const navigate      = useNavigate();
  const contacts      = getFlaggedContacts();
  const contact       = contacts.find((c) => c.id === contactId) ?? null;

  const partnerCtx       = getPartnerContext();
  const effectivePartner: PartnerContext = partnerCtx ?? {
    partnerName: contact?.name ?? "them",
  };

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(true);
  const endRef                  = useRef<HTMLDivElement>(null);
  const abortRef                = useRef<AbortController | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <p className="text-[14px] text-muted-foreground mb-3">Contact not found.</p>
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

    const deviceId    = getDeviceId();
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

      {/* ── Header ── */}
      <header className="glass sticky top-0 z-10 flex flex-shrink-0 items-center h-14 gap-2 border-b px-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => navigate(`/chat/${contactId}`)}
          className="text-[#bf5af2] -ml-1"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-foreground truncate leading-none">
            {partnerName}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Closure mode</p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setShowInfo((s) => !s)}
          aria-label="About closure mode"
          className="text-muted-foreground"
        >
          {showInfo ? <X className="h-4 w-4" /> : <Info className="h-4 w-4" />}
        </Button>
      </header>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4">

        {/* Info banner */}
        {showInfo && (
          <div className="rounded-2xl border border-border bg-card p-4 mb-4 max-w-xl mx-auto animate-scale-in shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-[14px] font-semibold text-foreground mb-1">
                  What is closure mode?
                </p>
                <p className="text-[13px] text-muted-foreground leading-relaxed">
                  AI responds as {partnerName} — a safe space to say what you need to say.
                  Nothing is sent to anyone.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="mt-3 text-[13px] font-medium text-[#bf5af2]"
              onClick={() => setShowInfo(false)}
            >
              Got it
            </button>
          </div>
        )}

        {/* Empty state */}
        {messages.length === 0 && !showInfo && (
          <div className="flex flex-col items-center justify-center py-20 text-center max-w-xl mx-auto animate-fade-up">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-[#bf5af2]/15 text-[22px] font-semibold text-[#bf5af2] mb-4">
              {partnerName[0]?.toUpperCase() ?? "?"}
            </div>
            <p className="text-[17px] font-semibold text-foreground mb-1.5">
              Say what you need to say
            </p>
            <p className="text-[14px] text-muted-foreground max-w-[240px] leading-relaxed">
              {partnerName} is here. This is your chance.
            </p>
          </div>
        )}

        {/* Chat bubbles */}
        <div className="space-y-2.5 max-w-xl mx-auto">
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn("flex animate-fade-in", m.role === "user" ? "justify-end" : "justify-start")}
            >
              {m.role === "assistant" && (
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#bf5af2]/15 text-[12px] font-semibold text-[#bf5af2] mr-2 mt-1 self-end">
                  {partnerName[0]?.toUpperCase() ?? "?"}
                </div>
              )}
              <div
                className={cn(
                  "max-w-[75%] rounded-[18px] px-3.5 py-2.5 text-[15px] leading-relaxed",
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

        {error && (
          <p className="mt-3 text-[12px] text-destructive text-center">{error}</p>
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
          className="flex-1 h-10 rounded-full bg-secondary px-4 text-[15px] text-foreground placeholder:text-muted-foreground border-0 outline-none focus:ring-2 focus:ring-[#bf5af2]/30 transition-shadow disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Send"
          className={cn(
            "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-all duration-150 active:scale-90",
            input.trim() && !loading
              ? "bg-foreground text-background shadow-sm"
              : "bg-secondary text-muted-foreground"
          )}
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
