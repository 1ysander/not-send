import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getFlaggedContacts, getDeviceId, getUserContext, getPartnerContext } from "@/lib/storage";
import { streamClosureChat } from "@/api";
import type { PartnerContext } from "@/api";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Info, X } from "lucide-react";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { InputBar } from "@/components/chat/InputBar";

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
      <header className="flex flex-shrink-0 items-center h-14 gap-2 border-b border-border px-3 bg-background">
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

      <ChatWindow>
        {showInfo && (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[14px] font-semibold text-foreground mb-1">
              What is closure mode?
            </p>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              AI responds as {partnerName} — a safe space to say what you need to say.
              Nothing is sent to anyone.
            </p>
            <button
              type="button"
              className="mt-3 text-[13px] font-medium text-foreground hover:underline"
              onClick={() => setShowInfo(false)}
            >
              Got it
            </button>
          </div>
        )}

        {messages.length === 0 && !showInfo && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-secondary text-[22px] font-semibold text-foreground mb-4">
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

        {messages.length > 0 && (
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
        onSubmit={() => handleSubmit({ preventDefault: () => {} } as React.FormEvent)}
        placeholder={`Message ${partnerName}…`}
        disabled={loading}
      />
    </div>
  );
}
