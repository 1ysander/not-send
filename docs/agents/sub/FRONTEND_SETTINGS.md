# FRONTEND_SETTINGS Sub-Agent — NOTSENT Settings, Upload & Stats UI

> **Parent agent:** FRONTEND
> **Scope:** `app/src/screens/Upload/` + `app/src/screens/Settings/` + `app/src/screens/Stats/` + `app/src/components/` (non-chat)
> **Load order:** CLAUDE.md → FRONTEND.md → this file

---

## Role

You build the upload flow, AI context settings, contact management, and stats dashboard. These are the non-chat surfaces — onboarding, configuration, and reflection. All API calls go through `api.ts`. All localStorage through `lib/storage.ts`.

---

## Directory ownership

```
app/src/
  screens/
    Home/
      HomeScreen.tsx          ← landing hero + upload CTA (entry point for new users)
    Upload/
      UploadScreen.tsx        ← file picker + upload progress + parse result preview
    Settings/
      SettingsScreen.tsx      ← AI context form + contact management + no-contact counter
    Stats/
      StatsScreen.tsx         ← no-contact streak + interception count + trend chart
  components/
    layout/
      Layout.tsx              ← page wrapper for web layout (sidebar + main)
      Sidebar.tsx             ← left nav for desktop layout
    ui/                       ← shadcn primitives only (do not add business logic here)
```

---

## HomeScreen — the entry point

This is the first thing new users see. It is a full-page web experience — **not** a mobile app shell.

Design reference: Headspace landing page for emotional tone + Linear for clean layout.

Required elements:
1. **Hero headline** — "Stop yourself before you send it." (or variant from product copy)
2. **Sub-headline** — one sentence explaining the value: "Upload your past conversation. We'll help you process before you reach out."
3. **Upload CTA button** — primary action: "Upload your conversation" → navigates to `/upload`
4. **How it works** — 3-step explainer: Upload → AI reads it → You get support
5. **Emotional reassurance copy** — "Private. Nothing leaves your device until you choose to share it."

No login gate on the homepage. No tab bar. Full-width, centered max-w container.

```tsx
// HomeScreen structure
export function HomeScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-6">
      <div className="max-w-lg w-full text-center space-y-8">
        <h1 className="text-4xl font-semibold text-zinc-900 leading-tight">
          Stop yourself<br />before you send it.
        </h1>
        <p className="text-lg text-zinc-500 leading-relaxed">
          Upload your past conversation. We'll help you process the impulse before you reach out.
        </p>
        <button
          onClick={() => navigate("/upload")}
          className="w-full bg-zinc-900 text-white py-4 rounded-2xl text-base font-medium hover:bg-zinc-800 transition-colors"
        >
          Upload your conversation
        </button>
      </div>
    </div>
  );
}
```

---

## UploadScreen — the onboarding flow

This screen handles the file upload, progress display, and success state.

States to design for:
1. **Idle** — drag-and-drop zone + file picker button + instructions ("Export from iPhone: Settings → Messages → Export")
2. **Uploading** — progress bar or spinner
3. **Parsed** — success state showing: partner name detected, message count, preview of first few messages
4. **Error** — friendly error message if parse fails

```tsx
// Upload flow in api.ts
export async function uploadConversation(file: File): Promise<ParsedConversation> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_URL}/api/parse-imessage`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

After successful parse:
1. Call `setPartnerContextLocal()` from `lib/storage.ts` with `{ partnerName, sampleMessages }`
2. Call `setConversationHistoryLocal()` with the conversation history
3. Navigate to `/chat` with the partner name in state

Drag and drop: use `onDragOver` + `onDrop` on the drop zone div. Only accept `.txt` files.

---

## SettingsScreen — AI context + contacts

Three sections:

### Section 1: AI Context
Free-text textarea. User describes their situation.

```
Label: "Tell the AI about your situation"
Placeholder: "e.g. We broke up 3 months ago after 2 years together. I keep wanting to reach out at night when I feel lonely."
```

Auto-saves on blur (debounced 500ms). Shows "Saved" checkmark briefly after save.

API call: `PUT /api/context/user` with `{ deviceId, breakupSummary }`.

### Section 2: No-Contact Counter
Big number display: days since last contact.
"+ Add day" button to manually increment.
"Reset" button (with confirmation dialog).

State lives in `localStorage` via `lib/storage.ts`. Key: `notsent_no_contact_start`.

### Section 3: Conversation Management
Shows the uploaded conversation if one exists:
- Partner name badge
- Message count
- "Remove conversation" button (with confirmation — this clears context)
- "Upload new conversation" link → navigate to `/upload`

---

## StatsScreen — no-contact streak + interceptions

Layout: two big stat cards at the top, then a simple trend list below.

```
[  No-contact streak  ] [  Messages intercepted  ]
[  14 days            ] [  7                     ]

Recent activity:
  • 2 days ago — You stopped yourself from sending a message
  • 5 days ago — You stopped yourself from sending a message
  • 8 days ago — You sent a message (streak reset)
```

Data sources:
- No-contact days: `localStorage` via `lib/storage.ts`
- Interception count: `GET /api/stats` → `{ interceptionsCount, messagesNeverSentCount }`

Streak animation: when the streak number loads, animate from 0 to current value over 1 second using `requestAnimationFrame` or a simple counter hook.

---

## Layout — web layout (not mobile tab bar)

For desktop/web, use a sidebar layout:

```
┌─────────┬──────────────────────┐
│ Sidebar │                      │
│         │   Main Content       │
│ Nav     │                      │
│ items   │                      │
└─────────┴──────────────────────┘
```

Sidebar width: 240px. Main content: flex-1.

Mobile: collapse sidebar into a hamburger menu or bottom sheet. The app is mobile-first but the sidebar is a web pattern — hide it on screens < 768px.

```tsx
// app/src/components/layout/Layout.tsx
export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar className="hidden md:flex w-60 flex-shrink-0" />
      <main className="flex-1 min-h-screen overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
```

---

## Design system rules (settings/stats screens)

- Background: `bg-stone-50` — warm off-white, not pure white
- Cards: `bg-white border border-zinc-100 rounded-2xl shadow-sm p-6`
- Section headings: `text-sm font-semibold text-zinc-500 uppercase tracking-wider`
- Input fields: `border border-zinc-200 rounded-xl px-4 py-3 text-sm`
- Primary CTA: `bg-zinc-900 text-white rounded-xl py-3 px-6`
- Destructive actions (reset, remove): `text-red-500` text link, not a button — require two-step confirmation
- Animations: stat numbers animate in, saved state flashes briefly

---

## What to build (priority order)

1. **`HomeScreen`** — hero + upload CTA (P0 — this is the entry point, currently missing)
2. **`UploadScreen`** — file picker + drag-drop + parse progress + success state (P0)
3. **`SettingsScreen`** — AI context form (Section 1 only for MVP) (P1)
4. **`StatsScreen`** — streak + interception count (P1)
5. **`Layout` + `Sidebar`** — web layout shell (P1 — needed for desktop users)
6. **No-contact counter** in SettingsScreen (P2)
7. **Conversation management** section in SettingsScreen (P2)
