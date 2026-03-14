import { useState, useEffect, useCallback, useRef } from "react";
import {
  getMoodLog,
  logMood,
  getTodayEntry,
  getFlaggedContacts,
  getContactAIChatHistory,
} from "@/lib/storage";
import { PageLayout } from "@/components/PageLayout";
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

function MoodCalendar({ log }: { log: MoodEntry[] }) {
  const days = buildCalendarDays();
  const byDate = Object.fromEntries(log.map((e) => [e.date, e]));
  const todayStr = new Date().toISOString().slice(0, 10);
  const startDow = new Date(days[0]).getDay();

  return (
    <div>
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
              className="aspect-square rounded-sm transition-opacity"
              style={{
                backgroundColor: score != null ? scoreColor(score) : "hsl(var(--secondary))",
                opacity: score != null ? 1 : 0.45,
                outline: isToday ? "2px solid hsl(var(--foreground))" : "none",
                outlineOffset: "1px",
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

const MAX_WORDS = 50;

function getTotalMessagesSent(): number {
  const contacts = getFlaggedContacts();
  let total = 0;
  for (const contact of contacts) {
    total += getContactAIChatHistory(contact.id).filter((m) => m.role === "user").length;
  }
  return total;
}

export function StatsScreen() {
  const [log, setLog] = useState<MoodEntry[]>([]);
  const [todayScore, setTodayScore] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [justSaved, setJustSaved] = useState(false);
  const [totalMessages, setTotalMessages] = useState(0);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLog(getMoodLog());
    const entry = getTodayEntry();
    setTodayScore(entry?.score ?? null);
    setNote(entry?.note ?? "");
    setTotalMessages(getTotalMessagesSent());
  }, []);

  // Auto-save note 600ms after the user stops typing
  useEffect(() => {
    if (todayScore === null) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      logMood(todayScore, note.trim() || undefined);
      setLog(getMoodLog());
    }, 600);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [note, todayScore]);

  const handleSelectScore = useCallback((score: number) => {
    setTodayScore(score);
    logMood(score, note.trim() || undefined);
    setLog(getMoodLog());
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1800);
    // Focus note field after picking a score
    setTimeout(() => noteRef.current?.focus(), 80);
  }, [note]);

  const handleNoteChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    // Block input past 50 words but allow editing within them
    if (wordCount(val) <= MAX_WORDS) {
      setNote(val);
    }
  }, []);

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

  const words = wordCount(note);
  const wordsLeft = MAX_WORDS - words;

  return (
    <PageLayout title="How you're doing">
      <p className="text-[14px] text-muted-foreground -mt-1">
        Check in once a day. Watch your healing.
      </p>

      {/* Message count */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm flex items-center justify-between">
        <p className="text-[14px] font-semibold text-foreground">Messages sent</p>
        <span className="text-[22px] font-bold text-foreground tabular-nums">{totalMessages}</span>
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

        {/* Note field — appears once a score is picked */}
        {todayScore != null && (
          <div className="space-y-1.5">
            <textarea
              ref={noteRef}
              value={note}
              onChange={handleNoteChange}
              placeholder="Describe how you're feeling… (optional)"
              rows={3}
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
                  color: wordsLeft <= 5
                    ? scoreColor(2)
                    : "hsl(var(--muted-foreground))",
                }}
              >
                {wordsLeft} word{wordsLeft !== 1 ? "s" : ""} left
              </p>
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
        <MoodCalendar log={log} />
      </div>
    </PageLayout>
  );
}
