import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getFlaggedContacts,
  clearFlaggedContacts,
  getUserContext,
  setUserContextLocal,
  getDeviceId,
  getPartnerContext,
  setPartnerContextLocal,
} from "@/lib/storage";
import {
  saveUserContextToBackend,
  checkBackendHealth,
  type BackendHealth,
  getPartnerContextFromBackend,
  savePartnerContextToBackend,
} from "@/api";
import type { UserContext } from "@/types";
import { PageLayout } from "@/components/PageLayout";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, Check, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

export function SettingsScreen() {
  const [contacts] = useState(getFlaggedContacts());
  const [breakupSummary, setBreakupSummary] = useState("");
  const [noContactDays, setNoContactDays] = useState<number | "">("");
  const [saved, setSaved] = useState(false);
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const partnerName = contacts[0]?.name ?? "";

  useEffect(() => {
    const ctx = getUserContext();
    if (ctx) {
      setBreakupSummary(ctx.breakupSummary ?? "");
      setNoContactDays(ctx.noContactDays ?? "");
    }
  }, []);

  function handleSaveContext() {
    const ctx: UserContext = {
      breakupSummary: breakupSummary.trim() || undefined,
      noContactDays: typeof noContactDays === "number" ? noContactDays : undefined,
      partnerName: partnerName || undefined,
    };
    setUserContextLocal(ctx);
    setSaved(true);
    saveUserContextToBackend(getDeviceId(), ctx).catch(() => {});
    setTimeout(() => setSaved(false), 2000);
  }

  const [backendStatus, setBackendStatus] = useState<BackendHealth | null>(null);
  const [partnerSynced, setPartnerSynced] = useState(false);

  async function handleCheckBackend() {
    setBackendStatus(null);
    const health = await checkBackendHealth();
    setBackendStatus(health);
  }

  async function handleSyncPartnerToBackend() {
    const local = getPartnerContext();
    if (!local?.partnerName) return;
    await savePartnerContextToBackend(getDeviceId(), local);
    setPartnerSynced(true);
    setTimeout(() => setPartnerSynced(false), 2000);
  }

  async function handleLoadPartnerFromBackend() {
    const ctx = await getPartnerContextFromBackend(getDeviceId());
    if (ctx) {
      setPartnerContextLocal(ctx);
      setPartnerSynced(true);
      setTimeout(() => setPartnerSynced(false), 2000);
    }
  }

  function handleRedoOnboarding() {
    clearFlaggedContacts();
    navigate("/onboarding");
  }

  return (
    <PageLayout title="Settings">
      <div className="space-y-8">
        <Card className="rounded-xl shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {user ? (
              <>
                <div className="flex items-center gap-3">
                  {user.picture && (
                    <img
                      src={user.picture}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{user.name}</p>
                    <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={signOut} className="gap-2">
                  <LogOut className="h-4 w-4" />
                  Sign out
                </Button>
              </>
            ) : (
              <Button onClick={() => navigate("/login")}>Sign in with Google</Button>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Context for AI</CardTitle>
            <CardDescription>
              Helps the AI reference your situation during interventions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea
              placeholder="e.g. We broke up 2 months ago…"
              value={breakupSummary}
              onChange={(e) => setBreakupSummary(e.target.value)}
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <div>
              <label className="text-sm font-medium text-muted-foreground">No contact (days)</label>
              <Input
                type="number"
                min={0}
                placeholder="14"
                value={noContactDays}
                onChange={(e) =>
                  setNoContactDays(e.target.value === "" ? "" : parseInt(e.target.value, 10))
                }
                className="mt-1 max-w-[88px]"
              />
            </div>
            <Button variant={saved ? "secondary" : "default"} size="sm" onClick={handleSaveContext}>
              {saved ? <><Check className="h-4 w-4 mr-1" /> Saved</> : "Save context"}
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Backend</CardTitle>
            <CardDescription>
              Check connection for AI chat and interventions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={handleCheckBackend}>
                Check connection
              </Button>
              {backendStatus && (
                <span
                  className={cn(
                    "text-sm",
                    backendStatus.ok ? "text-primary" : "text-destructive"
                  )}
                >
                  {backendStatus.ok ? "✓ Connected" : `✗ ${backendStatus.error}`}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleLoadPartnerFromBackend}>
                Load partner from backend
              </Button>
              <Button variant="outline" size="sm" onClick={handleSyncPartnerToBackend}>
                {partnerSynced ? "✓ Synced" : "Save partner to backend"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Contacts</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full justify-between"
              onClick={() => navigate("/contacts")}
            >
              <span>Manage contacts</span>
              <UserPlus className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-destructive/50 shadow-card">
          <CardContent className="pt-6">
            <Button
              variant="ghost"
              className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handleRedoOnboarding}
            >
              Redo onboarding
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              Clears all contacts and returns to setup.
            </p>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
