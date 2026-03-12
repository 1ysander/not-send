# Product Pivot Process

> **When to use this:** Whenever the product idea, user flow, or core mechanic changes — not just a feature addition, but a change in *what the product is* or *how it fundamentally works*. Use this checklist to make sure the agent system stays in sync with the product reality.

---

## What counts as a pivot

A pivot is any change that affects:
- Who the product is for (personal vs. business, new audience)
- How the user enters the product (new entry point or primary action)
- What the core mechanic is (what happens when they use it)
- What platform it runs on (web vs. mobile, browser extension vs. app)
- What the AI is doing (different role, different goal, different prompt strategy)

A pivot is **not** just adding a feature, changing UI polish, or adding a screen to an existing flow.

---

## Pivot checklist

When the founder describes a new direction, work through this list in order. Do not start coding until steps 1–3 are complete.

### Step 1 — Articulate the new product clearly

Write a 3-sentence description of the product in its new form. It must answer:
- Who is it for?
- What is the entry point (what does the user do first)?
- What does the AI do and why does it help?

Get confirmation from the founder that this captures their intent before proceeding.

### Step 2 — Identify what's wrong in the current codebase

Ask: does anything currently built contradict the new direction?
- Wrong entry point (e.g., built contact-add flow when product should start with file upload)
- Wrong platform assumptions (e.g., mobile tab nav for a website product)
- Wrong AI mode or prompt strategy
- Dead screens that encode the old flow

List these explicitly. Do not silently ignore them — they will confuse future agents.

### Step 3 — Update documentation before touching code

In this order:
1. **`CLAUDE.md`** — update "What this is", data flow, canonical file map, current vs. target state
2. **`FRONTEND.md`** — update route tree, entry point, screen list, "What to build next"
3. **`BACKEND.md`** — update route map, engine functions, "What to build next"
4. **`CRORR.md`** — add entries for any mistakes the old direction caused
5. **Agent routing table in `CLAUDE.md`** — add new agent files if a new domain was introduced

### Step 4 — Decide what to do with existing code

For each piece of existing code that contradicts the new direction, choose one:

| Option | When to use |
|---|---|
| **Keep and repurpose** | The code still has a role but needs to be modified |
| **Keep but mark dead** | The code is not used now but might be relevant later — add a comment `// LEGACY: [reason kept]` |
| **Delete** | The code is actively misleading and has no future use |

Never leave code in place that encodes the old product direction without marking it. It will confuse future agents into thinking the old direction was intentional.

### Step 5 — Build the new entry point first

Always start with the new entry point, not a middle-of-the-flow feature. The entry point is what makes the product coherent. Everything else hangs off it.

### Step 6 — Update CRORR

Add a CRORR entry for any mistakes or wrong assumptions the pivot reveals. Future agents must know what was tried and why it didn't fit.

---

## Example: the iMessage pivot (2026-03-11)

**Old direction:** Mobile app with real-time message interception, contact-add onboarding, tab nav UI

**New direction:** Web product with iMessage .txt export upload as entry point

**What was wrong:**
- `AddContactScreen` encoded the old contact-add onboarding
- `ConversationList` listed contacts as if the app was a real messaging client
- `AppShell` tab nav was mobile-app-style, not web-product-style
- No file upload route or parser existed anywhere

**What was updated:**
- `CLAUDE.md` — rewritten "What this is", new data flow, new canonical file map
- `FRONTEND.md` — new route tree, upload flow added, tab bar reduced, website design principles added
- `BACKEND.md` — iMessage parser added as P0, parse route added to route map
- `CRORR.md` — three entries added for the documented mistakes

**New entry point built:** `HomeScreen` + `UploadScreen` (P0 priority)

---

## When the founder changes direction mid-build

This is normal and expected. The process is the same:
1. Stop building
2. Run the pivot checklist
3. Update docs
4. Resume building from the new entry point

Do not try to preserve half-built work from the old direction by shoe-horning it into the new one. Clarity is more valuable than code reuse.

---

## Adding this file to agent routing

When a new domain is introduced by a pivot (e.g., enterprise compliance, a new platform), add a new agent file under `docs/agents/` and add a row to the agent routing table in `CLAUDE.md`:

```markdown
| [new domain description] | `docs/agents/[NEWFILE].md` |
```
