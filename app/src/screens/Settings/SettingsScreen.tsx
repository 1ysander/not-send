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
import { LogOut, Check, ChevronRight, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1 mb-1.5">
      {children}
    </p>
  );
}

function SettingsGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
      {children}
    </div>
  );
}

function SettingsRow({
  label,
  description,
  right,
  onClick,
  destructive,
}: {
  label: string;
  description?: string;
  right?: React.ReactNode;
  onClick?: () => void;
  destructive?: boolean;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-3.5 text-left",
        onClick && "hover:bg-secondary/50 active:bg-secondary transition-colors",
        destructive && "text-destructive"
      )}
    >
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium", destructive ? "text-destructive" : "text-foreground")}>
          {label}
        </p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {right ?? (onClick && !destructive && <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />)}
    </Tag>
  );
}

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
      {/* Account */}
      <div>
        <SectionLabel>Account</SectionLabel>
        <SettingsGroup>
          {user ? (
            <>
              <div className="flex items-center gap-3 px-4 py-3.5">
                {user.picture ? (
                  <img
                    src={user.picture}
                    alt=""
                    className="h-9 w-9 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary flex-shrink-0">
                    <span className="text-sm font-semibold text-foreground">
                      {(user.name ?? "?")[0].toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
              </div>
              <SettingsRow
                label="Sign out"
                right={<LogOut className="h-4 w-4 text-muted-foreground" />}
                onClick={signOut}
              />
            </>
          ) : (
            <SettingsRow
              label="Sign in with Google"
              onClick={() => navigate("/login")}
            />
          )}
        </SettingsGroup>
      </div>

      {/* AI Context */}
      <div>
        <SectionLabel>AI Context</SectionLabel>
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Helps AI reference your situation during interventions.
          </p>
          <textarea
            placeholder="e.g. We broke up 2 months ago after a 3-year relationship…"
            value={breakupSummary}
            onChange={(e) => setBreakupSummary(e.target.value)}
            rows={3}
            className="w-full rounded-lg bg-secondary border-0 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring/30 resize-none transition-shadow"
          />
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                No contact (days)
              </label>
              <input
                type="number"
                min={0}
                placeholder="14"
                value={noContactDays}
                onChange={(e) =>
                  setNoContactDays(e.target.value === "" ? "" : parseInt(e.target.value, 10))
                }
                className="w-20 h-9 rounded-lg bg-secondary border-0 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring/30 transition-shadow"
              />
            </div>
            <Button
              variant={saved ? "secondary" : "default"}
              size="sm"
              onClick={handleSaveContext}
              className="flex-shrink-0 gap-1.5"
            >
              {saved ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Saved
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Contacts */}
      <div>
        <SectionLabel>Contacts</SectionLabel>
        <SettingsGroup>
          <SettingsRow
            label="Manage contacts"
            description={`${contacts.length} contact${contacts.length !== 1 ? "s" : ""} flagged`}
            onClick={() => navigate("/contacts")}
          />
        </SettingsGroup>
      </div>

      {/* Backend */}
      <div>
        <SectionLabel>Connection</SectionLabel>
        <SettingsGroup>
          <SettingsRow
            label="Check backend"
            right={
              backendStatus ? (
                <span className={cn("text-xs font-medium", backendStatus.ok ? "text-brand" : "text-destructive")}>
                  {backendStatus.ok ? "Connected" : "Offline"}
                </span>
              ) : (
                <Activity className="h-4 w-4 text-muted-foreground" />
              )
            }
            onClick={handleCheckBackend}
          />
          <SettingsRow
            label="Load partner from backend"
            right={<ChevronRight className="h-4 w-4 text-muted-foreground" />}
            onClick={handleLoadPartnerFromBackend}
          />
          <SettingsRow
            label={partnerSynced ? "Synced" : "Save partner to backend"}
            right={partnerSynced ? <Check className="h-4 w-4 text-brand" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            onClick={handleSyncPartnerToBackend}
          />
        </SettingsGroup>
      </div>

      {/* Danger zone */}
      <div>
        <SectionLabel>Danger zone</SectionLabel>
        <SettingsGroup>
          <SettingsRow
            label="Redo onboarding"
            description="Clears all contacts and returns to setup"
            destructive
            onClick={handleRedoOnboarding}
          />
        </SettingsGroup>
      </div>
    </PageLayout>
  );
}
