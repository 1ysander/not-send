import { useState, useEffect } from "react";
import { getStats } from "@/api";
import { getSessions } from "@/lib/storage";
import { PageLayout } from "@/components/PageLayout";

export function StatsScreen() {
  const [interceptions, setInterceptions] = useState(0);
  const [neverSent, setNeverSent] = useState(0);
  const [usedApi, setUsedApi] = useState(false);

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
      <p className="text-sm text-muted-foreground -mt-1">
        How many times NOTSENT helped you pause before sending.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground font-medium mb-2">Messages stopped</p>
          <p className="text-4xl font-semibold tracking-tight text-foreground">{interceptions}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground font-medium mb-2">Never sent</p>
          <p className="text-4xl font-semibold tracking-tight text-foreground">{neverSent}</p>
        </div>
      </div>
      {!usedApi && (
        <p className="text-xs text-muted-foreground">
          Local count only. Start the backend for synced stats.
        </p>
      )}
    </PageLayout>
  );
}
