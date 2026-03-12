# CRORR — Continuous Retrospective on Reasoning and Results

> **What this is:** A learning framework for AI agents working on this codebase. When an agent makes a mistake, goes in the wrong direction, or produces something the user has to correct, the lesson goes here. Agents must read this file at the start of every session and internalize these patterns. Do not repeat documented mistakes.

---

## How to use this file

**Reading:** Every agent reads this file after `CLAUDE.md` and before the domain-specific agent file. Treat every entry as a hard lesson — something that cost time or produced wrong results.

**Writing:** When the user corrects a direction, rejects an approach, or explicitly says "no, not like that" — add an entry here. Include:
1. What was built or decided
2. Why it was wrong
3. What to do instead
4. Which agent files were updated as a result

**Format for each entry:**
```
## [date] [brief title]
**What happened:** ...
**Why it was wrong:** ...
**Correct approach:** ...
**Files updated:** ...
```

---

## Entries

### 2026-03-11 — Built a mobile app when the product is a website

**What happened:** Agents built NOTSENT as a mobile-first React SPA with tab bar navigation, simulating a native phone app. Screens like `ConversationList`, `AddContactScreen`, and the `AppShell` tab bar were built as if this were a phone UI.

**Why it was wrong:** NOTSENT is a **web product**. The iMessage integration was always going to be a file upload (users export their chat as a .txt file), not a real-time phone intercept. Building a phone-app-style UI for a file-upload web product created a mismatch between what the product actually does and how it presents itself. The entry point is a homepage with an upload CTA — not a contact list or tab navigation.

**Correct approach:**
- Build a homepage (hero, CTA, explanation)
- Upload screen as the entry point
- Full-page web experience, not a mobile-tab-nav shell
- Emotional, visually polished design — not a UI component library demo

**Files updated:** `CLAUDE.md`, `FRONTEND.md`

---

### 2026-03-11 — Assumed real-time iMessage interception was possible

**What happened:** The original architecture assumed the app would intercept messages at the moment of sending, like a phone keyboard or notification hook.

**Why it was wrong:** Real-time iMessage integration requires OS-level access (not available to a web startup). The realistic MVP uses iPhone's built-in "Export Chat" feature — user downloads a `.txt` file and uploads it to NOTSENT.

**Correct approach:**
- Parse iMessage `.txt` export files server-side (`src/engine/imessageParser.ts`)
- Use the parsed conversation as context for all three AI modes
- Never design around real-time message interception unless native OS access is confirmed

**Files updated:** `CLAUDE.md`, `BACKEND.md`, `FRONTEND.md`

---

### 2026-03-11 — Treated NOTSENT as one product when it's two

**What happened:** All agent instructions were written for a single personal-use app.

**Why it was wrong:** The founder's vision is two products sharing one engine:
1. **NOTSENT** — personal web app (breakup/emotional)
2. **Enterprise Compliance Layer** — B2B browser/email plugin (legal/professional)

Building as one product risks cross-contaminating the prompts, UI patterns, and audience assumptions.

**Correct approach:**
- Keep products cleanly separated at the prompt layer: personal prompts in `prompts/intervention.ts`, `prompts/closure.ts`; compliance prompts in a future `prompts/compliance.ts`
- Never reuse or modify personal app prompts for the compliance product
- Build personal app first; enterprise layer comes later

**Files updated:** `CLAUDE.md`, `BACKEND.md`

---

## How to add a new entry

When the user corrects you:
1. Understand exactly what went wrong
2. Add an entry to this file following the format above
3. Update the relevant agent files so future agents won't repeat the mistake
4. Update `CLAUDE.md` if the mistake was at the architecture level
