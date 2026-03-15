import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { uploadConversationFile, type ParsedConversation } from "@/api";
import { addFlaggedContact, setContactProfile, setPartnerContextLocal, getDeviceId } from "@/lib/storage";
import { Button } from "@/components/ui/button";

type Stage = "idle" | "parsing" | "done" | "error";

function formatDateRange(range: ParsedConversation["dateRange"]): string {
  if (!range) return "";
  const from = new Date(range.from).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  const to = new Date(range.to).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  return from === to ? from : `${from} – ${to}`;
}

export function UploadScreen() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ParsedConversation | null>(null);
  const [contactId, setContactId] = useState<string | null>(null);

  async function processFile(file: File) {
    if (!file.name.endsWith(".txt")) {
      setError("Please upload a .txt file — the iMessage export format from your iPhone.");
      setStage("error");
      return;
    }

    setStage("parsing");
    setError(null);

    try {
      const deviceId = getDeviceId();
      const parsed = await uploadConversationFile(file, { deviceId });

      // Create a contact for this person
      const contact = addFlaggedContact({
        name: parsed.partnerName,
        phoneNumber: "",
      });

      // Save relationship memory + sample messages to their profile
      setContactProfile(contact.id, {
        sampleMessages: parsed.sampleMessages,
        relationshipMemory: parsed.relationshipMemory,
      });

      // Save global partner context (used by closure + intervention flows)
      setPartnerContextLocal({
        partnerName: parsed.partnerName,
        sampleMessages: parsed.sampleMessages,
        relationshipMemory: parsed.relationshipMemory,
      });

      setResult(parsed);
      setContactId(contact.id);
      setStage("done");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed.";
      setError(msg);
      setStage("error");
    }
  }

  const handleFile = useCallback((file: File | null | undefined) => {
    if (file) processFile(file);
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    handleFile(e.target.files?.[0]);
  }

  function reset() {
    setStage("idle");
    setError(null);
    setResult(null);
    setContactId(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div
      className="relative flex flex-col min-h-screen overflow-x-hidden"
      style={{ backgroundColor: "#0a0a0a" }}
    >
      {/* Ambient glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-40 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full opacity-10 blur-3xl"
          style={{ background: "radial-gradient(circle, #bf5af2 0%, transparent 70%)" }}
        />
      </div>

      {/* Header */}
      <header className="relative z-20 flex items-center justify-between px-6 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <button
          onClick={() => navigate("/home")}
          className="text-xs font-bold uppercase tracking-[0.25em] min-h-[44px] flex items-center"
          style={{ color: "#6b6b6b" }}
        >
          NOTSENT
        </button>
        <button
          onClick={() => navigate(-1)}
          className="text-sm min-h-[44px] min-w-[44px] flex items-center justify-end"
          style={{ color: "#6b6b6b" }}
        >
          ← Back
        </button>
      </header>

      <main className="relative z-10 flex flex-col items-center px-6 pt-12 pb-20 flex-1">
        <div className="w-full max-w-md flex flex-col gap-8">

          {/* Title block */}
          <div className="flex flex-col gap-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "#bf5af2" }}>
              Step 1 of 1
            </p>
            <h1 className="text-[32px] font-bold tracking-tight leading-tight" style={{ color: "#f5f5f5" }}>
              Upload your conversation.
            </h1>
            <p className="text-[15px] leading-relaxed" style={{ color: "#6b6b6b" }}>
              Export your iMessage chat as a .txt file from your iPhone, then drop it here.
              The AI reads it privately — nothing leaves your device until you start a chat.
            </p>
          </div>

          {/* Drop zone — idle */}
          {stage === "idle" && (
            <div
              data-testid="upload-dropzone"
              onClick={() => inputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className="flex flex-col items-center justify-center gap-4 rounded-2xl cursor-pointer transition-all duration-200 px-6 py-14"
              style={{
                border: isDragging
                  ? "1.5px dashed #bf5af2"
                  : "1.5px dashed rgba(255,255,255,0.12)",
                backgroundColor: isDragging
                  ? "rgba(191,90,242,0.06)"
                  : "rgba(255,255,255,0.02)",
              }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                style={{
                  backgroundColor: "rgba(191,90,242,0.1)",
                  border: "1px solid rgba(191,90,242,0.2)",
                }}
              >
                💬
              </div>
              <div className="text-center flex flex-col gap-1">
                <p className="text-[15px] font-semibold" style={{ color: "#f5f5f5" }}>
                  Drop your .txt file here
                </p>
                <p className="text-[13px]" style={{ color: "#6b6b6b" }}>
                  or tap to browse
                </p>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".txt,text/plain"
                className="hidden"
                data-testid="upload-file-input"
                onChange={handleInputChange}
              />
            </div>
          )}

          {/* Parsing state */}
          {stage === "parsing" && (
            <div
              className="flex flex-col items-center justify-center gap-5 rounded-2xl px-6 py-14"
              style={{
                border: "1.5px solid rgba(191,90,242,0.2)",
                backgroundColor: "rgba(191,90,242,0.04)",
              }}
            >
              <ParseSpinner />
              <div className="text-center flex flex-col gap-1">
                <p className="text-[15px] font-semibold" style={{ color: "#f5f5f5" }}>
                  Reading the conversation…
                </p>
                <p className="text-[13px]" style={{ color: "#6b6b6b" }}>
                  Learning their tone, their words, their patterns.
                </p>
              </div>
            </div>
          )}

          {/* Error state */}
          {stage === "error" && (
            <div className="flex flex-col gap-5">
              <div
                className="rounded-2xl px-6 py-6 flex flex-col gap-3"
                style={{
                  backgroundColor: "rgba(255,69,58,0.06)",
                  border: "1px solid rgba(255,69,58,0.2)",
                }}
              >
                <p className="text-[15px] font-semibold" style={{ color: "#ff453a" }}>
                  Couldn't read the file
                </p>
                <p className="text-[13px] leading-relaxed" style={{ color: "#6b6b6b" }}>
                  {error}
                </p>
              </div>
              <Button
                data-testid="upload-retry-btn"
                onClick={reset}
                className="w-full min-h-[48px] font-semibold rounded-2xl"
                style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "#f5f5f5" }}
              >
                Try again
              </Button>
            </div>
          )}

          {/* Done state — result preview */}
          {stage === "done" && result && (
            <div className="flex flex-col gap-5">
              <div
                className="rounded-2xl px-6 py-6 flex flex-col gap-5"
                style={{
                  backgroundColor: "#111111",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {/* Partner name badge */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0"
                    style={{ backgroundColor: "rgba(191,90,242,0.15)", color: "#bf5af2" }}
                  >
                    {result.partnerName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <p className="text-[16px] font-semibold" style={{ color: "#f5f5f5" }}>
                      {result.partnerName}
                    </p>
                    {result.dateRange && (
                      <p className="text-[12px]" style={{ color: "#6b6b6b" }}>
                        {formatDateRange(result.dateRange)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3">
                  <StatPill label="Messages" value={result.messageCount.toLocaleString()} />
                  <StatPill label="From them" value={result.partnerMessageCount.toLocaleString()} />
                  <StatPill label="From you" value={result.userMessageCount.toLocaleString()} />
                </div>

                {/* Tone preview */}
                {result.relationshipMemory && (
                  <div className="flex flex-col gap-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#6b6b6b" }}>
                      Their style
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Tag label={result.relationshipMemory.partnerTone} />
                      <Tag label={`emoji: ${result.relationshipMemory.emojiUsage}`} />
                      {result.relationshipMemory.usesLowercase && <Tag label="lowercase" />}
                      {result.relationshipMemory.usesEllipsis && <Tag label="uses …" />}
                    </div>
                  </div>
                )}
              </div>

              <Button
                data-testid="upload-start-chat-btn"
                onClick={() => contactId && navigate(`/chat/${contactId}`)}
                className="w-full min-h-[52px] text-base font-semibold rounded-2xl text-white"
                style={{ backgroundColor: "#bf5af2" }}
              >
                Start chatting with {result.partnerName}
              </Button>

              <button
                data-testid="upload-another-btn"
                onClick={reset}
                className="text-center text-[13px] min-h-[44px] flex items-center justify-center"
                style={{ color: "#6b6b6b" }}
              >
                Upload a different conversation
              </button>
            </div>
          )}

          {/* How to export — always visible in idle */}
          {stage === "idle" && <HowToExport />}
        </div>
      </main>
    </div>
  );
}

function ParseSpinner() {
  return (
    <div className="relative w-14 h-14">
      <svg className="w-14 h-14 animate-spin" viewBox="0 0 56 56" fill="none">
        <circle cx="28" cy="28" r="24" stroke="rgba(191,90,242,0.15)" strokeWidth="3" />
        <path
          d="M28 4a24 24 0 0 1 24 24"
          stroke="#bf5af2"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex flex-col items-center gap-1 rounded-xl py-3 px-2"
      style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <span className="text-[17px] font-bold" style={{ color: "#f5f5f5" }}>
        {value}
      </span>
      <span className="text-[10px] uppercase tracking-wider" style={{ color: "#6b6b6b" }}>
        {label}
      </span>
    </div>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span
      className="text-[11px] rounded-full px-3 py-1 font-medium"
      style={{
        backgroundColor: "rgba(191,90,242,0.1)",
        color: "#bf5af2",
        border: "1px solid rgba(191,90,242,0.2)",
      }}
    >
      {label}
    </span>
  );
}

function HowToExport() {
  return (
    <div
      className="rounded-2xl px-5 py-5 flex flex-col gap-4"
      style={{
        backgroundColor: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#6b6b6b" }}>
        How to export from iPhone
      </p>
      <ol className="flex flex-col gap-3">
        {[
          "Open the Messages app and find your conversation.",
          'Tap and hold any message → "More…" → select all → tap the share icon.',
          'Choose "Save to Files" and save as a .txt file.',
          "Upload that file here.",
        ].map((step, i) => (
          <li key={i} className="flex gap-3 items-start">
            <span
              className="flex-shrink-0 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center mt-0.5"
              style={{ backgroundColor: "rgba(191,90,242,0.12)", color: "#bf5af2" }}
            >
              {i + 1}
            </span>
            <span className="text-[13px] leading-relaxed" style={{ color: "#6b6b6b" }}>
              {step}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
