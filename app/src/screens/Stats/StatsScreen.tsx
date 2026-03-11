import { useState, useEffect } from "react";
import { getStats } from "@/api";
import { getSessions } from "@/lib/storage";
import { PageLayout } from "@/components/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <p className="mb-8 text-sm text-muted-foreground">
        How many times NOTSENT helped you pause before sending.
      </p>
      <div className="grid gap-6 sm:grid-cols-2">
        <Card className="rounded-xl shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Messages stopped
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tracking-tight">{interceptions}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Never sent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tracking-tight">{neverSent}</p>
          </CardContent>
        </Card>
      </div>
      {!usedApi && (
        <p className="mt-4 text-xs text-muted-foreground">
          Showing local count. Start the backend for synced stats.
        </p>
      )}
    </PageLayout>
  );
}
