import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { addFlaggedContact, setContactProfile, getDeviceId } from "@/lib/storage";
import { uploadConversationFile } from "@/api";
import type { ConversationDateRange } from "@/types";
import { Button } from "@/components/ui/button";
import { Upload, RefreshCw, Check, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

function formatDateRangeLabel(dateRange: ConversationDateRange): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", year: "numeric" };
  const from = new Date(dateRange.from).toLocaleDateString("en-US", opts);
  const to = new Date(dateRange.to).toLocaleDateString("en-US", opts);
  return `${from} – ${to}`;
}

type Step = "form" | "upload";

export function AddContactScreen() {
  const [step, setStep]       = useState<Step>("form");
  const [name, setName]       = useState("");
  const [phone, setPhone]     = useState("");
  const [error, setError]     = useState("");
  const [contactId, setContactId] = useState<string | null>(null);

  // Upload state
  const [uploading, setUploading]     = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadDone, setUploadDone]   = useState(false);
  const [messageCount, setMessageCount] = useState<number | null>(null);
  const [dateRange, setDateRange]       = useState<ConversationDateRange | null>(null);
  const [userMessageCount, setUserMessageCount] = useState<number | null>(null);
  const [partnerMessageCount, setPartnerMessageCount] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate     = useNavigate();

  function handleSubmitForm(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const trimmedName  = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName || !trimmedPhone) {
      setError("Both fields are required.");
      return;
    }
    const contact = addFlaggedContact({ name: trimmedName, phoneNumber: trimmedPhone });
    setContactId(contact.id);
    setStep("upload");
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !contactId) return;
    e.target.value = "";

    setUploading(true);
    setUploadError(null);
    try {
      const deviceId = getDeviceId();
      const result = await uploadConversationFile(file, { deviceId, userName: name.trim() || undefined });
      setContactProfile(contactId, {
        sampleMessages: result.sampleMessages,
        relationshipMemory: result.relationshipMemory,
      });
      setMessageCount(result.messageCount);
      setDateRange(result.dateRange ?? null);
      setUserMessageCount(result.userMessageCount ?? null);
      setPartnerMessageCount(result.partnerMessageCount ?? null);
      setUploadDone(true);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  }

  function handleContinue() {
    navigate("/onboarding/set", {
      state: uploadDone
        ? {
            partnerName: name.trim(),
            messageCount,
            dateRange,
            userMessageCount,
            partnerMessageCount,
          }
        : undefined,
    });
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-6 overflow-hidden">
      {/* Ambient glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-[#bf5af2]/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm animate-fade-up space-y-8">

        {step === "form" && (
          <>
            {/* Header */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                NOTSENT
              </p>
              <h1 className="text-[28px] font-bold tracking-tight text-foreground leading-tight">
                Who are you trying<br />not to text?
              </h1>
              <p className="text-[15px] text-muted-foreground leading-relaxed">
                NOTSENT intercepts before you send and gives you space to think.
              </p>
            </div>

            {/* Form card */}
            <form
              onSubmit={handleSubmitForm}
              className="rounded-2xl border border-border/60 bg-card shadow-md overflow-hidden"
            >
              <div className="p-5 space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Their name
                  </label>
                  <input
                    type="text"
                    placeholder="Alex"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    className="w-full h-12 rounded-xl bg-secondary border-0 px-4 text-[15px] text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-[#bf5af2]/40 transition-shadow"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Phone number
                  </label>
                  <input
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                    className="w-full h-12 rounded-xl bg-secondary border-0 px-4 text-[15px] text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-[#bf5af2]/40 transition-shadow"
                  />
                </div>
                {error && (
                  <p className="text-[13px] text-destructive">{error}</p>
                )}
              </div>

              <div className="border-t border-border px-5 py-4">
                <Button type="submit" size="default" className="w-full">
                  Continue
                </Button>
              </div>
            </form>
          </>
        )}

        {step === "upload" && (
          <>
            {/* Header */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                NOTSENT
              </p>
              <h1 className="text-[28px] font-bold tracking-tight text-foreground leading-tight">
                Upload your<br />conversation
              </h1>
              <p className="text-[15px] text-muted-foreground leading-relaxed">
                Export your iMessage chat with {name} as a <span className="font-medium text-foreground">.txt file</span> and upload it. The AI learns their voice — making every mode more personal.
              </p>
            </div>

            {/* Upload card */}
            <div className="rounded-2xl border border-border/60 bg-card shadow-md overflow-hidden">
              <div className="p-5 space-y-4">
                {uploadDone ? (
                  <div className="rounded-xl bg-[#30d158]/10 border border-[#30d158]/20 px-3.5 py-3 space-y-2">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-[#30d158] flex-shrink-0" />
                      <p className="text-[14px] font-semibold text-foreground flex-1">
                        Found {messageCount?.toLocaleString()} messages with {name}
                      </p>
                      <Check className="h-5 w-5 text-[#30d158] flex-shrink-0" />
                    </div>
                    <div className="pl-8 space-y-0.5">
                      {dateRange && (
                        <p className="text-[12px] text-muted-foreground">
                          {formatDateRangeLabel(dateRange)}
                          {(userMessageCount !== null && partnerMessageCount !== null) && (
                            <>
                              {" "}
                              <span className="text-muted-foreground/60">•</span>
                              {" "}you sent {userMessageCount.toLocaleString()}, they sent {partnerMessageCount.toLocaleString()}
                            </>
                          )}
                        </p>
                      )}
                      {!dateRange && (userMessageCount !== null && partnerMessageCount !== null) && (
                        <p className="text-[12px] text-muted-foreground">
                          you sent {userMessageCount.toLocaleString()}, they sent {partnerMessageCount.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border py-8 px-4 text-center transition-colors",
                      "hover:border-[#bf5af2]/40 hover:bg-[#bf5af2]/5 active:bg-[#bf5af2]/10",
                      uploading && "opacity-60 pointer-events-none"
                    )}
                  >
                    {uploading ? (
                      <RefreshCw className="h-7 w-7 text-muted-foreground animate-spin" />
                    ) : (
                      <Upload className="h-7 w-7 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-[14px] font-semibold text-foreground">
                        {uploading ? "Parsing conversation…" : "Upload .txt export"}
                      </p>
                      <p className="text-[12px] text-muted-foreground mt-0.5">
                        iPhone → Settings → Export chat
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

              <div className="border-t border-border px-5 py-4 space-y-3">
                <Button
                  type="button"
                  size="default"
                  className="w-full"
                  onClick={handleContinue}
                  disabled={uploading}
                >
                  {uploadDone ? "Continue" : "Skip for now"}
                </Button>
                {!uploadDone && (
                  <p className="text-center text-[12px] text-muted-foreground">
                    You can always upload later from the contact profile.
                  </p>
                )}
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
