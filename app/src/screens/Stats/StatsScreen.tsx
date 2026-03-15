import { useState, useEffect, useCallback, useRef } from "react";
import {
  getMoodLog,
  logMood,
  getTodayEntry,
  getSessions,
  getNoContactSince,
  setNoContactSince,
  getMoodLogRemote,
  logMoodRemote,
  supabaseEnabled,
} from "@/lib/storage";
import { PageLayout } from "@/components/PageLayout";
import { MessageCircle, Shield } from "lucide-react";
import type { MoodEntry } from "@/types";

// ─── Color helpers ────────────────────────────────────────────────────────────

const SCORE_COLORS: Record<number, string> = {
  1:  "#ff3b30",
  2:  "#ff6040",
  3:  "#ff8c42",
  4:  "#ffaa00",
  5:  "#ffcc00",
  6:  "#c8d84a",
  7:  "#8fce6a",
  8:  "#5cb85c",
  9:  "#34c759",
  10: "#1a9e3f",
};

function scoreColor(score: number): string {
  return SCORE_COLORS[Math.round(Math.min(Math.max(score, 1), 10))] ?? "#888";
}

function wordCount(text: string): number {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

// ─── 30-day heatmap ───────────────────────────────────────────────────────────

function buildCalendarDays(): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function MoodCalendar({ log, highlightToday }: { log: MoodEntry[]; highlightToday?: boolean }) {
  const days = buildCalendarDays();
  const byDate = Object.fromEntries(log.map((e) => [e.date, e]));
  const todayStr = new Date().toISOString().slice(0, 10);
  const startDow = new Date(days[0]).getDay();

  return (
    <div>
      <style>{`
        @keyframes pulse-today {
          0%   { transform: scale(1); box-shadow: 0 0 0 0px currentColor; }
          40%  { transform: scale(1.35); box-shadow: 0 0 0 4px currentColor; }
          70%  { transform: scale(1.15); }
          100% { transform: scale(1); box-shadow: 0 0 0 0px currentColor; }
        }
        .today-pulse { animation: pulse-today 0.55s ease-out; }
      `}</style>

      <div className="grid grid-cols-7 mb-1">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i} className="text-center text-[10px] text-muted-foreground font-medium">
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: startDow }).map((_, i) => (
          <div key={`pad-${i}`} className="aspect-square rounded-sm" />
        ))}

        {days.map((date) => {
          const entry = byDate[date];
          const score = entry?.score;
          const isToday = date === todayStr;
          const tooltip = score != null
            ? `${date}: ${score}/10${entry?.note ? ` — "${entry.note}"` : ""}`
            : date;
          return (
            <div
              key={date}
              title={tooltip}
              className={`aspect-square rounded-sm transition-opacity${isToday && highlightToday ? " today-pulse" : ""}`}
              style={{
                backgroundColor: score != null ? scoreColor(score) : "hsl(var(--secondary))",
                opacity: score != null ? 1 : 0.45,
                outline: isToday ? "2px solid hsl(var(--foreground))" : "none",
                outlineOffset: "1px",
                color: score != null ? scoreColor(score) : "transparent",
              }}
            />
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-muted-foreground">30 days</span>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground">low</span>
          {[1, 3, 5, 7, 9, 10].map((s) => (
            <div key={s} className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: scoreColor(s) }} />
          ))}
          <span className="text-[10px] text-muted-foreground">high</span>
        </div>
      </div>
    </div>
  );
}

// ─── Score picker ─────────────────────────────────────────────────────────────

function ScorePicker({ current, onSelect }: { current: number | null; onSelect: (score: number) => void }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onSelect(n)}
          className="flex-1 min-w-0 py-2 rounded-lg text-[12px] font-bold transition-all"
          style={{
            backgroundColor: scoreColor(n),
            color: n <= 2 || n >= 9 ? "#fff" : "#1c1c1e",
            opacity: current != null && current !== n ? 0.35 : 1,
            transform: current === n ? "scale(1.18)" : "scale(1)",
            boxShadow: current === n ? `0 0 0 2px ${scoreColor(n)}55` : "none",
          }}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const LABELS: Record<number, string> = {
  1:  "Really rough",
  2:  "Pretty hard",
  3:  "Struggling",
  4:  "Getting by",
  5:  "Okay",
  6:  "Decent",
  7:  "Pretty good",
  8:  "Good",
  9:  "Really good",
  10: "Thriving",
};

const MAX_NOTE_WORDS = 50;

function getTotalMessagesIntercepted(): number {
  return getSessions().length;
}

/** Returns the number of full days between a past ISO date string and today. */
function daysSince(isoDateStr: string): number {
  const start = new Date(isoDateStr);
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

/** Format a stored date string as "Jan 12, 2024". */
function formatNoContactDate(isoDateStr: string): string {
  return new Date(isoDateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Get today's date as YYYY-MM-DD for the date input default value. */
function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function StatsScreen() {
  const [log, setLog] = useState<MoodEntry[]>([]);
  const [todayScore, setTodayScore] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [journal, setJournal] = useState("");
  const [justSaved, setJustSaved] = useState(false);
  const [journalSaved, setJournalSaved] = useState(false);
  const [journalJustSaved, setJournalJustSaved] = useState(false);
  const [highlightToday, setHighlightToday] = useState(false);
  const [totalMessages, setTotalMessages] = useState(0);
  const [noContactSince, setNoContactSinceState] = useState<string | null>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (supabaseEnabled) {
      getMoodLogRemote()
        .then((remoteLog) => {
          setLog(remoteLog);
          const today = new Date().toISOString().slice(0, 10);
          const entry = remoteLog.find((e) => e.date === today) ?? null;
          setTodayScore(entry?.score ?? null);
          setNote(entry?.note ?? "");
          setJournal(entry?.journal ?? "");
          setJournalSaved(!!entry?.journal?.trim());
        })
        .catch(() => {
          setLog(getMoodLog());
          const entry = getTodayEntry();
          setTodayScore(entry?.score ?? null);
          setNote(entry?.note ?? "");
          setJournal(entry?.journal ?? "");
          setJournalSaved(!!entry?.journal?.trim());
        });
    } else {
      setLog(getMoodLog());
      const entry = getTodayEntry();
      setTodayScore(entry?.score ?? null);
      setNote(entry?.note ?? "");
      setJournal(entry?.journal ?? "");
      setJournalSaved(!!entry?.journal?.trim());
    }
    setTotalMessages(getTotalMessagesIntercepted());
    setNoContactSinceState(getNoContactSince());
  }, []);

  function handleNoContactDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (!val) return;
    setNoContactSince(val);
    setNoContactSinceState(val);
  }

  // Auto-save note only (600ms debounce); journal is submitted manually
  useEffect(() => {
    if (todayScore === null) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const currentJournal = getTodayEntry()?.journal;
      logMood(todayScore, note.trim() || undefined, currentJournal);
      if (supabaseEnabled) {
        logMoodRemote(todayScore, note.trim() || undefined, currentJournal).catch(() => {});
      }
      setLog(getMoodLog());
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1800);
    }, 600);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [note, todayScore]);

  const handleSelectScore = useCallback((score: number) => {
    setTodayScore(score);
    logMood(score, note.trim() || undefined, journal.trim() || undefined);
    if (supabaseEnabled) {
      logMoodRemote(score, note.trim() || undefined, journal.trim() || undefined).catch(() => {});
    }
    setLog(getMoodLog());
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1800);
    // Pulse the today cell in the calendar
    setHighlightToday(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setHighlightToday(true));
    });
    setTimeout(() => setHighlightToday(false), 700);
    // Focus note field after picking a score
    setTimeout(() => noteRef.current?.focus(), 80);
  }, [note, journal]);

  const handleNoteChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (wordCount(val) <= MAX_NOTE_WORDS) {
      setNote(val);
    }
  }, []);

  const handleJournalChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setJournal(e.target.value);
  }, []);

  const handleSubmitJournal = useCallback(() => {
    if (todayScore === null || !journal.trim()) return;
    logMood(todayScore, note.trim() || undefined, journal.trim());
    if (supabaseEnabled) {
      logMoodRemote(todayScore, note.trim() || undefined, journal.trim()).catch(() => {});
    }
    setLog(getMoodLog());
    setJournalSaved(true);
    setJournalJustSaved(true);
    setTimeout(() => setJournalJustSaved(false), 2000);
  }, [todayScore, journal, note]);

  const streak = (() => {
    let count = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      if (log.find((e) => e.date === d.toISOString().slice(0, 10))) count++;
      else break;
    }
    return count;
  })();

  const noteWords = wordCount(note);
  const noteWordsLeft = MAX_NOTE_WORDS - noteWords;

  return (
    <PageLayout title="Journal">
      <p className="text-[14px] text-muted-foreground -mt-1">
        Check in once a day. Watch your healing.
      </p>

      {/* No-contact counter */}
      <div className="rounded-2xl bg-[#111] border border-border p-5 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-[#bf5af2]" />
            <p className="text-[13px] font-semibold text-foreground uppercase tracking-wide">No contact</p>
          </div>
          {noContactSince && (
            <p className="text-[11px] text-muted-foreground">
              since {formatNoContactDate(noContactSince)}
            </p>
          )}
        </div>

        {noContactSince ? (
          <div className="flex items-end gap-2">
            <span className="text-[52px] font-bold text-[#bf5af2] tabular-nums leading-none">
              {daysSince(noContactSince)}
            </span>
            <span className="text-[15px] text-muted-foreground pb-1.5">days</span>
          </div>
        ) : (
          <p className="text-[14px] text-muted-foreground">
            Set your start date to track how long you've stayed no contact.
          </p>
        )}

        <div className="flex items-center gap-2">
          <label className="text-[12px] text-muted-foreground shrink-0">
            {noContactSince ? "Change date:" : "No contact since:"}
          </label>
          <input
            type="date"
            max={todayInputValue()}
            defaultValue={noContactSince ?? todayInputValue()}
            onChange={handleNoContactDateChange}
            className="flex-1 min-w-0 h-9 rounded-lg bg-secondary border border-border px-3 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-[#bf5af2]/40 transition-shadow"
          />
        </div>
      </div>

      {/* Message count */}
      <div className="rounded-2xl bg-brand-gradient p-5 flex items-center justify-between shadow-sm">
        <div>
          <p className="text-[12px] font-medium text-white/70 uppercase tracking-wider">Messages intercepted</p>
          <span className="text-[32px] font-bold text-white tabular-nums leading-none mt-1 block">{totalMessages}</span>
          <p className="text-[11px] text-white/60 mt-1">drafts you held back</p>
        </div>
        <div className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center">
          <MessageCircle className="h-6 w-6 text-white" />
        </div>
      </div>

      {/* Daily check-in */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[14px] font-semibold text-foreground">
            How are you feeling today?
          </p>
          {todayScore != null && (
            <span
              className="text-[12px] font-semibold px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: scoreColor(todayScore) + "33",
                color: scoreColor(todayScore),
              }}
            >
              {LABELS[todayScore]}
            </span>
          )}
        </div>

        <ScorePicker current={todayScore} onSelect={handleSelectScore} />

        {/* Note + journal fields — appear once a score is picked */}
        {todayScore != null && (
          <div className="space-y-3">
            {/* Short caption (50 words) */}
            <div className="space-y-1.5">
              <textarea
                ref={noteRef}
                value={note}
                onChange={handleNoteChange}
                placeholder="One-line caption… (optional, 50 words)"
                rows={2}
                className="w-full resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-[14px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-shadow"
              />
              <div className="flex items-center justify-between px-0.5">
                <p
                  className="text-[11px] transition-opacity duration-500"
                  style={{
                    opacity: justSaved ? 1 : 0,
                    color: "hsl(var(--muted-foreground))",
                  }}
                >
                  Saved
                </p>
                <p
                  className="text-[11px] tabular-nums"
                  style={{
                    color: noteWordsLeft <= 5
                      ? scoreColor(2)
                      : "hsl(var(--muted-foreground))",
                  }}
                >
                  {noteWordsLeft} word{noteWordsLeft !== 1 ? "s" : ""} left
                </p>
              </div>
            </div>

            {/* Journal entry (unlimited) */}
            <div className="space-y-1.5">
              <p className="text-[12px] font-medium text-muted-foreground px-0.5">
                Journal entry
              </p>
              <textarea
                value={journal}
                onChange={handleJournalChange}
                placeholder="Write as much as you need. No one else sees this."
                rows={6}
                className="w-full resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-[14px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-shadow"
              />
              <div className="flex items-center justify-between px-0.5">
                <p
                  className="text-[11px] transition-opacity duration-500"
                  style={{ opacity: journalJustSaved ? 1 : 0, color: "hsl(var(--muted-foreground))" }}
                >
                  Journal saved
                </p>
                <button
                  type="button"
                  disabled={!journal.trim()}
                  onClick={handleSubmitJournal}
                  className="text-[13px] font-semibold px-4 py-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity active:scale-95"
                >
                  {journalSaved ? "Edit entry" : "Write today's entry"}
                </button>
              </div>
            </div>
          </div>
        )}

        {todayScore === null && (
          <p className="text-center text-[12px] text-muted-foreground">
            Pick a number to log today.
          </p>
        )}
      </div>

      {/* 30-day calendar */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[14px] font-semibold text-foreground">Last 30 days</p>
          {streak > 1 && (
            <span className="text-[12px] text-muted-foreground">
              {streak}-day streak
            </span>
          )}
        </div>
        <MoodCalendar log={log} highlightToday={highlightToday} />
      </div>
    </PageLayout>
  );
}
