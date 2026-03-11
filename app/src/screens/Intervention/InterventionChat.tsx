import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { streamReviewResponse, recordOutcome } from "@/core";
import { webReviewTransport } from "@/adapters/webTransport";
import { updateLocalSessionOutcome, getDeviceId, getUserContext } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/Container";
import { ArrowLeft, AlertTriangle } from "lucide-react";

/** Review warning: AI read-over before send. Messaging-style container, not a form. */
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

  if (error && !sessionId) {
    return (
      <Container>
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <p className="text-destructive font-medium">{error}</p>
          <Button className="mt-4 rounded-xl" onClick={goBack}>
            Back to Messages
          </Button>
        </div>
      </Container>
    );
  }

  if (error && sessionId?.startsWith("local_")) {
    return (
      <Container>
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <p className="text-destructive font-medium">{error}</p>
          <Button
            className="mt-4 rounded-xl"
            onClick={() => {
              updateLocalSessionOutcome(sessionId, "intercepted");
              goBack();
            }}
          >
            Back to Messages
          </Button>
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <header className="flex items-center gap-2 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={goBack}
          aria-label="Back"
          className="rounded-full"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-semibold tracking-tight">Review</h1>
      </header>

      {/* Warning card: what you were about to send */}
      {messageAttempted && (
        <div className="rounded-2xl border-l-4 border-l-primary bg-muted/40 p-4 mb-6">
          <div className="flex gap-2 items-start">
            <AlertTriangle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                You were about to send
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                "{messageAttempted}"
              </p>
            </div>
          </div>
        </div>
      )}

      {/* AI response */}
      <div className="rounded-2xl bg-card border border-border p-4 min-h-[8rem]">
        {loading && !reply && (
          <p className="text-sm text-muted-foreground italic">
            NOTSENT is thinking…
          </p>
        )}
        {reply && (
          <>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              NOTSENT
            </p>
            <p className="text-sm whitespace-pre-wrap text-foreground leading-relaxed">
              {reply}
            </p>
            <div ref={replyEndRef} />
          </>
        )}
        {error && reply && (
          <p className="mt-2 text-sm text-destructive">{error}</p>
        )}
      </div>

      {/* Actions */}
      {!loading && (
        <footer className="mt-8 flex gap-3">
          <Button
            onClick={() => handleOutcome("intercepted")}
            disabled={actionLoading}
            className="flex-1 rounded-xl"
          >
            I won't send it
          </Button>
          <Button
            variant="outline"
            onClick={() => handleOutcome("sent")}
            disabled={actionLoading}
            className="flex-1 rounded-xl"
          >
            Send anyway
          </Button>
        </footer>
      )}
    </Container>
  );
}
