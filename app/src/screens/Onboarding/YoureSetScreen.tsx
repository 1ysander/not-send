import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import type { ConversationDateRange } from "@/types";

interface LocationState {
  partnerName?: string;
  messageCount?: number;
  dateRange?: ConversationDateRange | null;
  userMessageCount?: number | null;
  partnerMessageCount?: number | null;
}

function formatDateRangeLabel(dateRange: ConversationDateRange): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", year: "numeric" };
  const from = new Date(dateRange.from).toLocaleDateString("en-US", opts);
  const to = new Date(dateRange.to).toLocaleDateString("en-US", opts);
  return `${from} – ${to}`;
}

export function YoureSetScreen() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const state     = (location.state ?? {}) as LocationState;
  const { partnerName, messageCount, dateRange, userMessageCount, partnerMessageCount } = state;
  const hasUpload = Boolean(partnerName && messageCount);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-6 overflow-hidden">
      {/* Ambient glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/3 left-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#bf5af2]/12 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm text-center space-y-8 animate-scale-in">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-[26px] bg-brand-gradient shadow-xl">
            <svg viewBox="0 0 40 40" fill="none" className="h-10 w-10" aria-hidden>
              <path
                d="M10 20l7 7 13-14"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* Copy — personalized if upload happened, generic if skipped */}
        <div className="space-y-3">
          {hasUpload ? (
            <>
              <h1 className="text-[32px] font-bold tracking-tight text-foreground">
                You're set up with {partnerName}.
              </h1>
              <p className="text-[15px] text-muted-foreground leading-relaxed max-w-xs mx-auto">
                When you want to text them, open NOTSENT and type here instead.
                We'll step in before it sends — every time.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-[32px] font-bold tracking-tight text-foreground">
                You're set.
              </h1>
              <p className="text-[15px] text-muted-foreground leading-relaxed max-w-xs mx-auto">
                You can upload a conversation anytime from the contact profile to make every AI mode more personal.
              </p>
            </>
          )}
        </div>

        {/* Upload success card — only shown when upload happened */}
        {hasUpload && (
          <div className="rounded-2xl border border-[#30d158]/20 bg-[#30d158]/8 px-4 py-3.5 text-left space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#30d158]/15">
                <FileText className="h-4 w-4 text-[#30d158]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-foreground">
                  The AI has read {messageCount?.toLocaleString()} messages.
                </p>
              </div>
            </div>
            {(dateRange || (userMessageCount != null && partnerMessageCount != null)) && (
              <p className="text-[12px] text-muted-foreground pl-12">
                {dateRange && formatDateRangeLabel(dateRange)}
                {dateRange && userMessageCount != null && partnerMessageCount != null && (
                  <>{" "}<span className="opacity-50">•</span>{" "}you sent {userMessageCount.toLocaleString()}, they sent {partnerMessageCount.toLocaleString()}</>
                )}
                {!dateRange && userMessageCount != null && partnerMessageCount != null && (
                  <>you sent {userMessageCount.toLocaleString()}, they sent {partnerMessageCount.toLocaleString()}</>
                )}
              </p>
            )}
          </div>
        )}

        <Button
          onClick={() => navigate("/")}
          size="lg"
          className="w-full"
        >
          {hasUpload ? `Open NOTSENT` : "Open NOTSENT"}
        </Button>
      </div>
    </div>
  );
}
