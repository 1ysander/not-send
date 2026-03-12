import { useState, useEffect } from "react";
import { getStats } from "@/api";
import { getSessions } from "@/lib/storage";
import { PageLayout } from "@/components/PageLayout";
import { Shield, MessageCircleOff } from "lucide-react";

export function StatsScreen() {
  const [interceptions, setInterceptions] = useState(0);
  const [neverSent, setNeverSent]         = useState(0);
  const [usedApi, setUsedApi]             = useState(false);

  useEffect(() => {
    getStats()
      .then((stats) => {
        if (stats) {
          setInterceptions(stats.interceptionsCount);
          setNeverSent(stats.messagesNeverSentCount);
          setUsedApi(true);
        } else {
          const sessions = getSessions();
          const n = sessions.filter(
            (s) => s.outcome === "intercepted" || s.outcome === "draft"
          ).length;
          setInterceptions(n);
          setNeverSent(n);
        }
      })
      .catch(() => {
        const sessions = getSessions();
        const n = sessions.filter(
          (s) => s.outcome === "intercepted" || s.outcome === "draft"
        ).length;
        setInterceptions(n);
        setNeverSent(n);
      });
  }, []);

  return (
    <PageLayout title="Stats">
      <p className="text-[14px] text-muted-foreground -mt-1">
        How many times NOTSENT helped you pause before sending.
      </p>

      <div className="grid grid-cols-2 gap-3">
        {/* Interceptions */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-brand-gradient" />
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#bf5af2]/10 mb-3">
            <Shield className="h-4.5 w-4.5 text-[#bf5af2]" strokeWidth={1.5} />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            Intercepted
          </p>
          <p className="text-[44px] font-bold tracking-tight text-foreground leading-none">
            {interceptions}
          </p>
        </div>

        {/* Never sent */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-brand-gradient" />
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ff375f]/10 mb-3">
            <MessageCircleOff className="h-4.5 w-4.5 text-[#ff375f]" strokeWidth={1.5} />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            Never sent
          </p>
          <p className="text-[44px] font-bold tracking-tight text-foreground leading-none">
            {neverSent}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      {interceptions > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-[13px] font-semibold text-foreground mb-1">
            {interceptions === 1
              ? "1 moment of clarity"
              : `${interceptions} moments of clarity`}
          </p>
          <p className="text-[13px] text-muted-foreground mb-3">
            Every interception is a step forward.
          </p>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-brand-gradient transition-all duration-700"
              style={{ width: `${Math.min((neverSent / Math.max(interceptions, 1)) * 100, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[11px] text-muted-foreground">Intercepted</span>
            <span className="text-[11px] text-muted-foreground">Never sent</span>
          </div>
        </div>
      )}

      {!usedApi && (
        <p className="text-[12px] text-muted-foreground text-center">
          Local count only · Start the backend for synced stats
        </p>
      )}
    </PageLayout>
  );
}
