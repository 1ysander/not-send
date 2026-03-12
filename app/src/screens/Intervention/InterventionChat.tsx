import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { streamReviewResponse, recordOutcome } from "@/core";
import { webReviewTransport } from "@/adapters/webTransport";
import { updateLocalSessionOutcome, getDeviceId, getUserContext } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function InterventionChat() {
  const [sessionId, setSessionId]               = useState<string | null>(null);
  const [messageAttempted, setMessageAttempted] = useState<string>("");
  const [reply, setReply]                       = useState("");
  const [loading, setLoading]                   = useState(true);
  const [error, setError]                       = useState("");
  const [actionLoading, setActionLoading]       = useState(false);
  const navigate                                = useNavigate();
  const replyEndRef                             = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sid = sessionStorage.getItem("notsent_sessionId");
    const msg = sessionStorage.getItem("notsent_messageAttempted");
    setSessionId(sid);
    setMessageAttempted(msg ?? "");

    if (!sid || !msg) {
      setLoading(false);
      setError("Missing session. Go back and try sending again.");
      return;
    }

    if (sid.startsWith("local_")) {
      setLoading(false);
      setError("Backend is not running. Start the backend to use the AI review.");
      return;
    }

    const deviceId   = getDeviceId();
    const userContext = getUserContext();
    streamReviewResponse(
      webReviewTransport,
      sid,
      msg,
      (chunk) => setReply((r) => r + chunk),
      {
        deviceId,
        userContext: userContext
          ? {
              breakupSummary: userContext.breakupSummary,
              partnerName: userContext.partnerName,
              conversationContext: userContext.conversationContext,
            }
          : undefined,
      }
    )
      .then(() => setLoading(false))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Chat failed");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    replyEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [reply]);

  function goBack() {
    const contactId = sessionStorage.getItem("notsent_contactId");
    sessionStorage.removeItem("notsent_sessionId");
    sessionStorage.removeItem("notsent_messageAttempted");
    sessionStorage.removeItem("notsent_contactId");
    navigate(contactId ? `/chat/${contactId}` : "/");
  }

  async function handleOutcome(outcome: "intercepted" | "sent") {
    const contactId = sessionStorage.getItem("notsent_contactId");
    const returnTo  = contactId ? `/chat/${contactId}` : "/";

    if (!sessionId || sessionId.startsWith("local_")) {
      updateLocalSessionOutcome(sessionId ?? "", outcome);
      goBack();
      return;
    }
    setActionLoading(true);
    try {
      await recordOutcome(webReviewTransport, sessionId, outcome);
      updateLocalSessionOutcome(sessionId, outcome);
      sessionStorage.removeItem("notsent_sessionId");
      sessionStorage.removeItem("notsent_messageAttempted");
      sessionStorage.removeItem("notsent_contactId");
      navigate(returnTo);
    } catch {
      setError("Failed to update. Try again.");
    } finally {
      setActionLoading(false);
    }
  }

  const errorOnly  = error && !sessionId;
  const localError = error && sessionId?.startsWith("local_");

  if (errorOnly || localError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background px-6 text-center">
        <p className="text-[14px] text-destructive font-medium mb-4">{error}</p>
        <Button
          onClick={() => {
            if (localError) updateLocalSessionOutcome(sessionId!, "intercepted");
            goBack();
          }}
        >
          Back to Messages
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">

      {/* ── Gradient hero bar ── */}
      <div className="h-1 bg-brand-gradient" />

      {/* ── Header ── */}
      <header className="glass flex items-center h-14 px-3 border-b">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={goBack}
          aria-label="Back"
          className="text-[#bf5af2] -ml-1 mr-2"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
        </Button>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-gradient">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <p className="text-[15px] font-semibold text-foreground leading-none">Intervention</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">NOTSENT stepped in</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-xl mx-auto w-full space-y-4">

        {/* ── Intercepted message ── */}
        {messageAttempted && (
          <div className="rounded-2xl border border-border/60 bg-secondary/50 p-4 animate-fade-up">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground mb-2">
              You were about to send
            </p>
            <p className="text-[15px] text-foreground font-medium leading-relaxed">
              "{messageAttempted}"
            </p>
          </div>
        )}

        {/* ── AI response card ── */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-md animate-fade-up delay-100">
          <div className="h-0.5 bg-brand-gradient" />
          <div className="p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <Sparkles className="h-3.5 w-3.5 text-[#bf5af2]" />
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                NOTSENT
              </p>
            </div>

            {loading && !reply && (
              <div className="flex items-center gap-1.5 py-2">
                <span className="typing-dot text-muted-foreground" />
                <span className="typing-dot text-muted-foreground" />
                <span className="typing-dot text-muted-foreground" />
              </div>
            )}
            {reply && (
              <p className="text-[15px] text-foreground whitespace-pre-wrap leading-relaxed">
                {reply}
              </p>
            )}
            {error && reply && (
              <p className="mt-2 text-[13px] text-destructive">{error}</p>
            )}
            <div ref={replyEndRef} />
          </div>
        </div>

        {/* ── CTA buttons ── */}
        {!loading && (
          <div className="flex flex-col gap-2.5 pt-1 animate-fade-up delay-200">
            <Button
              onClick={() => handleOutcome("intercepted")}
              disabled={actionLoading}
              size="default"
              className="w-full"
            >
              I won't send it
            </Button>
            <Button
              variant="outline"
              onClick={() => handleOutcome("sent")}
              disabled={actionLoading}
              size="default"
              className={cn("w-full", actionLoading && "opacity-50")}
            >
              Send anyway
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
