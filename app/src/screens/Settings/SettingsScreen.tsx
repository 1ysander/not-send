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
import { LogOut, Check, ChevronRight, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground px-1 mb-1.5">
      {children}
    </p>
  );
}

function SettingsGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border/60 shadow-sm">
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
        onClick && "hover:bg-secondary/40 active:bg-secondary transition-colors",
        destructive && "text-destructive"
      )}
    >
      <div className="flex-1 min-w-0">
        <p className={cn("text-[15px] font-medium", destructive ? "text-destructive" : "text-foreground")}>
          {label}
        </p>
        {description && (
          <p className="text-[13px] text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {right ?? (onClick && !destructive && <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />)}
    </Tag>
  );
}

export function SettingsScreen() {
  const [contacts]          = useState(getFlaggedContacts());
  const [breakupSummary, setBreakupSummary] = useState("");
  const [noContactDays, setNoContactDays]   = useState<number | "">("");
  const [saved, setSaved]   = useState(false);
  const navigate            = useNavigate();
  const { user, signOut }   = useAuth();
  const partnerName         = contacts[0]?.name ?? "";

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

  const [backendStatus, setBackendStatus]   = useState<BackendHealth | null>(null);
  const [partnerSynced, setPartnerSynced]   = useState(false);

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

      {/* ── Account ── */}
      <div>
        <SectionLabel>Account</SectionLabel>
        <SettingsGroup>
          {user ? (
            <>
              <div className="flex items-center gap-3 px-4 py-4">
                {user.picture ? (
                  <img
                    src={user.picture}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover flex-shrink-0 ring-2 ring-border"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-gradient flex-shrink-0">
                    <span className="text-[15px] font-semibold text-white">
                      {(user.name ?? "?")[0].toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-foreground truncate">{user.name}</p>
                  <p className="text-[13px] text-muted-foreground truncate">{user.email}</p>
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

      {/* ── AI Context ── */}
      <div>
        <SectionLabel>AI Context</SectionLabel>
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-sm">
          <p className="text-[13px] text-muted-foreground">
            Helps the AI reference your situation during interventions.
          </p>
          <textarea
            placeholder="e.g. We broke up 2 months ago after a 3-year relationship…"
            value={breakupSummary}
            onChange={(e) => setBreakupSummary(e.target.value)}
            rows={3}
            className="w-full rounded-xl bg-secondary border-0 px-3.5 py-3 text-[15px] text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-[#bf5af2]/30 resize-none transition-shadow"
          />
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-[12px] font-semibold text-muted-foreground block mb-1.5">
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
                className="w-20 h-10 rounded-xl bg-secondary border-0 px-3 text-[15px] text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-[#bf5af2]/30 transition-shadow"
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

      {/* ── Contacts ── */}
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

      {/* ── Connection ── */}
      <div>
        <SectionLabel>Connection</SectionLabel>
        <SettingsGroup>
          <SettingsRow
            label="Check backend"
            right={
              backendStatus ? (
                <span className={cn(
                  "text-[13px] font-semibold",
                  backendStatus.ok ? "text-[#30d158]" : "text-destructive"
                )}>
                  {backendStatus.ok ? "Online" : "Offline"}
                </span>
              ) : (
                <Wifi className="h-4 w-4 text-muted-foreground" />
              )
            }
            onClick={handleCheckBackend}
          />
          <SettingsRow
            label="Load partner from backend"
            onClick={handleLoadPartnerFromBackend}
          />
          <SettingsRow
            label={partnerSynced ? "Synced" : "Save partner to backend"}
            right={
              partnerSynced
                ? <Check className="h-4 w-4 text-[#30d158]" />
                : <ChevronRight className="h-4 w-4 text-muted-foreground" />
            }
            onClick={handleSyncPartnerToBackend}
          />
        </SettingsGroup>
      </div>

      {/* ── Danger zone ── */}
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
