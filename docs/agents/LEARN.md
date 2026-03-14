# LEARN — Agent Self-Correction & Mistake Memory

> **What this is:** A live protocol for recording, storing, and applying lessons from agent mistakes. Every agent in this project must read this file alongside `CRORR.md`. While `CRORR.md` records what went wrong historically, `LEARN.md` defines *how* agents detect, log, and internalize new mistakes in real time.

---

## The core loop

Every agent session runs this loop:

```
1. READ   → Load CLAUDE.md + CRORR.md + LEARN.md + domain agent file
2. ACT    → Execute the task
3. DETECT → Did something go wrong? Was a correction given?
4. RECORD → Log the mistake in CRORR.md with full context
5. PATCH  → Update the relevant agent file so it doesn't happen again
6. RESUME → Continue with corrected approach
```

This loop runs continuously — not just at the end of a session. If a correction happens mid-task, record it mid-task.

---

## What counts as a mistake

Record an entry when any of the following happens:

| Signal | Example |
|---|---|
| User says "no, not like that" | Agent built desktop layout; user wants mobile-first |
| Agent has to undo its own work | Wrote a new file, then deleted it because it was wrong |
| User corrects an assumption | Agent assumed real-time integration; user clarifies it's file upload |
| A build breaks after an agent edit | TypeScript error introduced by the agent's change |
| A feature disappears after a change | Agent's fix removed a working UI element |
| Agent guessed a file path / API route wrong | Used wrong import path, wrong endpoint |
| Same mistake made twice | Anything already in CRORR.md that happened again |

---

## How to record a mistake — step by step

When a mistake occurs, immediately add an entry to `CRORR.md` using this format:

```markdown
### [YYYY-MM-DD] — [Short title of what went wrong]

**What happened:** One or two sentences. Be specific — name the file, screen, or behavior.

**Why it was wrong:** The root cause — wrong assumption, misread instruction, hallucinated path, etc.

**Correct approach:** Exactly what to do instead. Concrete enough that a future agent can apply it without re-deriving it.

**Files updated:** List any agent .md files updated as a result of this lesson.
```

Then update the relevant domain agent file (`FRONTEND.md`, `BACKEND.md`, etc.) with a note under a "Known pitfalls" or "Do not" section so the lesson is surfaced before the mistake can be repeated.

---

## Tiered severity

Not all mistakes are equal. Tag each entry with a tier:

| Tier | Label | Meaning | Action required |
|---|---|---|---|
| 1 | `[CRITICAL]` | Caused data loss, broke the build, removed a feature, shipped wrong behavior | Fix immediately, update CRORR + domain agent |
| 2 | `[PATTERN]` | Same category of mistake as a previous entry | Fix, add "do not repeat" note to domain agent, consider if the original CRORR entry needs strengthening |
| 3 | `[ASSUMPTION]` | Wrong assumption that was caught before it caused harm | Log in CRORR, no domain agent update required unless assumption is a common trap |

---

## Self-detection prompts

Agents should ask themselves these questions before completing any task:

**Before writing code:**
- Have I read CRORR.md? Does any past entry apply to what I'm about to do?
- Am I adding a file when I should be editing an existing one?
- Am I making an assumption about the product (e.g., real-time vs. file upload, mobile vs. web)?
- Am I changing something outside the scope of the task I was given?

**After writing code:**
- Does TypeScript still compile? (`npx tsc --noEmit`)
- Did I change anything I wasn't asked to change?
- Did I remove any feature, route, export, or prop that was working before?
- Does the thing I was asked to fix actually work now?

**Before closing the session:**
- Did the user correct me at any point? If yes — is it logged in CRORR.md?
- Did I make a mistake I caught myself? If yes — is it logged?
- Are any domain agent files out of date based on what I learned today?

---

## Repeat mistake protocol

If an agent makes a mistake that is already documented in CRORR.md:

1. **Stop immediately.** Do not continue in the wrong direction hoping it works out.
2. **Acknowledge the repeat explicitly.** Say: "This matches the existing CRORR entry from [date]: [title]."
3. **Apply the correct approach from that entry.** Do not re-derive it.
4. **Strengthen the CRORR entry.** Add a note that this mistake recurred on [date] and consider whether the existing description was unclear.
5. **Check the domain agent file.** If the lesson wasn't in the domain file, add it now — the original entry was not strong enough to prevent recurrence.

---

## Agent file maintenance rules

When a new lesson is learned, update files in this order:

1. **`CRORR.md`** — always, with the full entry
2. **Domain agent file** (`FRONTEND.md`, `BACKEND.md`, etc.) — add to a "Known pitfalls" section
3. **`CLAUDE.md`** — only if the mistake was architectural (affects all agents, not just one domain)
4. **This file (`LEARN.md`)** — only if the mistake-recording process itself needs to change

---

## Learning memory — current active lessons

> This section is maintained by agents. Add a one-liner when a new lesson is confirmed and worth surfacing at a glance. Full details live in CRORR.md.

| Date | Lesson | Domain |
|---|---|---|
| 2026-03-11 | NOTSENT is a web product with file upload — not a mobile app with real-time intercept | FRONTEND |
| 2026-03-11 | Two products share one engine — never cross-contaminate personal and compliance prompts | BACKEND |
| 2026-03-11 | iMessage integration = .txt file export parse, not OS-level real-time hook | BACKEND |

> Agents: append new rows to this table whenever a lesson is confirmed. Date format: YYYY-MM-DD.

---

## What NOT to log

Do not create noise. Skip entries for:

- Typos corrected during normal editing (not a conceptual mistake)
- Disagreements about code style that aren't enforced rules
- Tasks the user changed their mind about (log in project notes, not here)
- Anything already fully covered by an existing CRORR entry with no new information

The goal is a signal-rich log, not a diary. Every entry should make a future agent smarter.
