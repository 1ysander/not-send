import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getFlaggedContacts,
  updateFlaggedContact,
  getContactProfile,
  setContactProfile,
  setContactProfileRemote,
  getDeviceId,
  supabaseEnabled,
} from "@/lib/storage";
import { uploadConversationFile } from "@/api";
import { PageLayout } from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import {
  Check,
  Upload,
  FileText,
  RefreshCw,
  Bell,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground px-1 mb-1.5">
      {children}
    </p>
  );
}

export function ContactProfileScreen() {
  const { contactId } = useParams<{ contactId: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [contacts, setContacts] = useState(getFlaggedContacts());
  const contact = contacts.find((c) => c.id === contactId) ?? null;

  // ── Contact info fields ──
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [infoSaved, setInfoSaved] = useState(false);
  const infoIsDirty = contact && (name !== contact.name || phone !== contact.phoneNumber);

  // ── Situation context fields ──
  const [breakupSummary, setBreakupSummary] = useState("");
  const [noContactDays, setNoContactDays] = useState<number | "">("");
  const [contextSaved, setContextSaved] = useState(false);

  // ── Upload state ──
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // ── Profile (re-read after saves) ──
  const [profile, setProfile] = useState(() =>
    contactId ? getContactProfile(contactId) : {}
  );

  useEffect(() => {
    if (!contactId) return;
    const p = getContactProfile(contactId);
    setProfile(p);
    setBreakupSummary(p.breakupSummary ?? "");
    setNoContactDays(p.noContactDays ?? "");
  }, [contactId]);

  useEffect(() => {
    if (contact) {
      setName(contact.name);
      setPhone(contact.phoneNumber);
    }
  }, [contact?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!contact || !contactId) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <p className="text-[14px] text-muted-foreground mb-3">Contact not found.</p>
        <Button variant="ghost" size="sm" onClick={() => navigate("/contacts")}>
          Back to Contacts
        </Button>
      </div>
    );
  }

  const partnerMsgCount = profile.sampleMessages?.filter((m) => m.fromPartner).length ?? 0;
  const hasUpload = partnerMsgCount > 0;

  function handleSaveInfo() {
    if (!contactId) return;
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName || !trimmedPhone) return;
    updateFlaggedContact(contactId, { name: trimmedName, phoneNumber: trimmedPhone });
    setContacts(getFlaggedContacts());
    setInfoSaved(true);
    setTimeout(() => setInfoSaved(false), 2000);
  }

  function handleSaveContext() {
    if (!contactId) return;
    const updated = {
      ...getContactProfile(contactId),
      breakupSummary: breakupSummary.trim() || undefined,
      noContactDays: typeof noContactDays === "number" ? noContactDays : undefined,
    };
    setContactProfile(contactId, updated);
    if (supabaseEnabled) {
      setContactProfileRemote(contactId, updated).catch(() => {});
    }
    setProfile(updated);
    setContextSaved(true);
    setTimeout(() => setContextSaved(false), 2000);
  }

  async function handleFile(file: File) {
    if (!contactId) return;
    setUploading(true);
    setUploadError(null);
    try {
      const deviceId = getDeviceId();
      const result = await uploadConversationFile(file, { deviceId, userName: name.trim() || undefined });
      const updated = {
        ...getContactProfile(contactId),
        sampleMessages: result.sampleMessages,
        relationshipMemory: result.relationshipMemory,
      };
      if (supabaseEnabled) {
        try {
          await setContactProfileRemote(contactId, updated);
        } catch {
          setContactProfile(contactId, updated);
        }
      } else {
        setContactProfile(contactId, updated);
      }
      setProfile(updated);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    await handleFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (!isDragging) setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false);
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) await handleFile(file);
  }

  return (
    <PageLayout title={contact.name} backTo="/contacts">

      {/* ─────────────────────────────────────────
          SECTION 1 — Contact info (editable)
      ───────────────────────────────────────── */}
      <div>
        <SectionLabel>Contact info</SectionLabel>
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-sm">
          <div className="space-y-2.5">
            <div>
              <label className="text-[12px] font-semibold text-muted-foreground block mb-1.5">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Their name"
                className="w-full h-11 rounded-xl bg-secondary border-0 px-3.5 text-[15px] text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-[#bf5af2]/30 transition-shadow"
              />
            </div>
            <div>
              <label className="text-[12px] font-semibold text-muted-foreground block mb-1.5">
                Phone number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 000 0000"
                className="w-full h-11 rounded-xl bg-secondary border-0 px-3.5 text-[15px] text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-[#bf5af2]/30 transition-shadow"
              />
            </div>
          </div>
          <Button
            variant={infoSaved ? "secondary" : "default"}
            size="sm"
            disabled={!infoIsDirty && !infoSaved}
            onClick={handleSaveInfo}
            className="gap-1.5 w-full"
          >
            {infoSaved ? (
              <><Check className="h-3.5 w-3.5" /> Saved</>
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      </div>

      {/* ─────────────────────────────────────────
          SECTION 2 — Situation context
      ───────────────────────────────────────── */}
      <div>
        <SectionLabel>Situation context</SectionLabel>
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-sm">
          <p className="text-[13px] text-muted-foreground">
            Tell the AI what happened. The more detail you give, the more personalised its support will be.
          </p>
          <textarea
            placeholder={`e.g. We dated for 2 years and broke up because they said they needed space. I still have feelings for them and keep wanting to reach out…`}
            value={breakupSummary}
            onChange={(e) => setBreakupSummary(e.target.value)}
            rows={5}
            className="w-full rounded-xl bg-secondary border-0 px-3.5 py-3 text-[15px] text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-[#bf5af2]/30 resize-none transition-shadow"
          />
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="text-[12px] font-semibold text-muted-foreground block mb-1.5">
                Days no contact
              </label>
              <input
                type="number"
                min={0}
                placeholder="0"
                value={noContactDays}
                onChange={(e) =>
                  setNoContactDays(e.target.value === "" ? "" : parseInt(e.target.value, 10))
                }
                className="w-24 h-10 rounded-xl bg-secondary border-0 px-3 text-[15px] text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-[#bf5af2]/30 transition-shadow"
              />
            </div>
            <Button
              variant={contextSaved ? "secondary" : "default"}
              size="sm"
              onClick={handleSaveContext}
              className="gap-1.5 flex-shrink-0"
            >
              {contextSaved ? (
                <><Check className="h-3.5 w-3.5" /> Saved</>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────
          SECTION 3 — Conversation upload
      ───────────────────────────────────────── */}
      <div>
        <SectionLabel>Conversation upload</SectionLabel>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
          <p className="text-[13px] text-muted-foreground">
            Export your iMessage chat with {contact.name} from your iPhone as a <span className="font-medium text-foreground">.txt file</span> and upload it here. The AI learns their writing style, tone, and what you talked about — used in closure mode and AI chat.
          </p>

          {hasUpload ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl bg-[#30d158]/10 border border-[#30d158]/20 px-3.5 py-3">
                <FileText className="h-5 w-5 text-[#30d158] flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-foreground">
                    {partnerMsgCount} messages from {contact.name}
                  </p>
                  {profile.relationshipMemory && (
                    <p className="text-[12px] text-muted-foreground mt-0.5 capitalize">
                      {profile.relationshipMemory.partnerTone} tone · {profile.relationshipMemory.emojiUsage} emoji use
                      {profile.relationshipMemory.recurringTopics.length > 0 &&
                        ` · talks about ${profile.relationshipMemory.recurringTopics.slice(0, 2).join(", ")}`}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", uploading && "animate-spin")} />
                {uploading ? "Uploading…" : "Re-upload conversation"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed py-8 px-4 text-center transition-all",
                isDragging
                  ? "border-[#bf5af2] bg-[#bf5af2]/10 scale-[1.02]"
                  : "border-border hover:border-[#bf5af2]/40 hover:bg-[#bf5af2]/5 active:bg-[#bf5af2]/10",
                uploading && "opacity-60 pointer-events-none"
              )}
            >
              {uploading ? (
                <RefreshCw className="h-7 w-7 text-muted-foreground animate-spin" />
              ) : (
                <Upload className={cn("h-7 w-7 transition-colors", isDragging ? "text-[#bf5af2]" : "text-muted-foreground")} />
              )}
              <div>
                <p className="text-[14px] font-semibold text-foreground">
                  {uploading ? "Parsing conversation…" : isDragging ? "Drop to upload" : "Upload .txt export"}
                </p>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  {isDragging ? "" : "Drag & drop or click · iPhone → Settings → Export chat"}
                </p>
              </div>
            </button>
          )}

          {uploadError && (
            <p className="text-[13px] text-destructive">{uploadError}</p>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,text/plain"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* ─────────────────────────────────────────
          SECTION 4 — Send message (coming soon)
      ───────────────────────────────────────── */}
      <div>
        <SectionLabel>Send message</SectionLabel>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm opacity-60">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-secondary">
              <Bell className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-[14px] font-semibold text-foreground">Push to {contact.name}</p>
                <span className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  <Lock className="h-2.5 w-2.5" />
                  Coming soon
                </span>
              </div>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                When you're ready, send a message directly through the app — reviewed by AI before it goes.
              </p>
            </div>
          </div>
        </div>
      </div>

    </PageLayout>
  );
}
