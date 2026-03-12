import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { streamReviewResponse, recordOutcome } from "@/core";
import { webReviewTransport } from "@/adapters/webTransport";
import { updateLocalSessionOutcome, getDeviceId, getUserContext } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export function InterventionChat() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messageAttempted, setMessageAttempted] = useState<string>("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const navigate = useNavigate();
  const replyEndRef = useRef<HTMLDivElement>(null);

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

    const isLocalSession = sid.startsWith("local_");
    if (isLocalSession) {
      setLoading(false);
      setError("Backend is not running. Start the backend to use the AI review.");
      return;
    }

    const deviceId = getDeviceId();
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
    const returnTo = contactId ? `/chat/${contactId}` : "/";

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

  const errorOnly = error && !sessionId;
  const localError = error && sessionId?.startsWith("local_");

  if (errorOnly || localError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background px-6 text-center">
        <p className="text-sm text-destructive font-medium mb-4">{error}</p>
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
      {/* Header */}
      <header className="flex items-center h-14 px-4 border-b border-border">
        <Button
          variant="ghost"
          size="icon"
          onClick={goBack}
          aria-label="Back"
          className="h-8 w-8 text-muted-foreground hover:text-foreground mr-2"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <p className="text-sm font-semibold text-foreground">Intervention</p>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-xl mx-auto w-full space-y-4">
        {/* Intercepted message */}
        {messageAttempted && (
          <div className="rounded-xl border border-border bg-secondary/40 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              You were about to send
            </p>
            <p className="text-sm text-foreground font-medium">"{messageAttempted}"</p>
          </div>
        )}

        {/* AI response */}
        <div className="rounded-xl border border-border bg-card p-4 min-h-[7rem]">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            NOTSENT
          </p>
          {loading && !reply && (
            <p className="text-sm text-muted-foreground italic">Thinking…</p>
          )}
          {reply && (
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{reply}</p>
          )}
          {error && reply && (
            <p className="mt-2 text-sm text-destructive">{error}</p>
          )}
          <div ref={replyEndRef} />
        </div>

        {/* Actions */}
        {!loading && (
          <div className="flex gap-3 pt-2">
            <Button
              onClick={() => handleOutcome("intercepted")}
              disabled={actionLoading}
              className="flex-1 h-11"
            >
              Won't send it
            </Button>
            <Button
              variant="outline"
              onClick={() => handleOutcome("sent")}
              disabled={actionLoading}
              className="flex-1 h-11"
            >
              Send anyway
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
