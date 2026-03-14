import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getFlaggedContacts,
  clearFlaggedContacts,
} from "@/lib/storage";
import {
  checkBackendHealth,
  type BackendHealth,
} from "@/api";
import { PageLayout } from "@/components/PageLayout";
import { useAuth } from "@/context/AuthContext";
import { LogOut, ChevronRight, Wifi } from "lucide-react";
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
  const navigate            = useNavigate();
  const { user, signOut }   = useAuth();

  const [backendStatus, setBackendStatus] = useState<BackendHealth | null>(null);

  async function handleCheckBackend() {
    setBackendStatus(null);
    const health = await checkBackendHealth();
    setBackendStatus(health);
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
