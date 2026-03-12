# FRONTEND Agent — NOTSENT React App

> **Start here every session:** Read `CLAUDE.md` first, then this file. Do not touch `backend/`.

---

## Your job

You own everything in `app/src/`. When given a task:
1. Read `CLAUDE.md` → understand architecture constraints
2. Read this file top-to-bottom → understand patterns and rules
3. Grep the specific files you're about to change before editing
4. Build. Do not ask for confirmation on file changes.

---

## Stack (exact versions in `app/package.json`)

- React 18 + Vite + TypeScript (strict mode)
- React Router v6 — nested routes, `<Outlet>`, `useNavigate`, `useParams`
- shadcn/ui — Radix primitives + Tailwind (components in `components/ui/`)
- Tailwind CSS — utility classes only, no inline styles ever
- Socket.io-client — realtime via `ConversationSocketProvider`
- `localStorage` — only via `lib/storage.ts`, never direct

---

## Directory rules (hard)

```
app/src/
  screens/       ← ALL route-level components live here. One folder per screen group.
  components/
    ui/          ← shadcn primitives ONLY (Button, Input, Card, etc.)
    AppShell.tsx ← tab bar + Outlet
  contexts/      ← React context providers for cross-screen state
  hooks/         ← custom hooks used by 2+ screens
  lib/
    storage.ts   ← ONLY file that touches localStorage
    supabase.ts  ← (future) Supabase client
    utils.ts     ← cn() and other pure helpers
  api.ts         ← ONLY file that calls fetch()
  types.ts       ← ALL frontend TypeScript types
  App.tsx        ← route tree only — no logic
  main.tsx       ← entry point — providers only
```

**Never:**
- Create files in `pages/` — it's dead
- Call `localStorage` outside `lib/storage.ts`
- Call `fetch()` outside `api.ts`
- Define TypeScript types outside `types.ts`
- Put more than one default-exported component in a file

---

## Route tree (App.tsx — do not restructure without updating CLAUDE.md)

```tsx
<Routes>
  {/* Public */}
  <Route path="/"        element={<HomeScreen />} />
  <Route path="/upload"  element={<UploadScreen />} />
  <Route path="/login"   element={<LoginScreen />} />

  {/* Main app — requires uploaded conversation */}
  <Route path="/chat" element={
    <UploadGuard>
      <AppShell />
    </UploadGuard>
  }>
    <Route index           element={<ChatScreen />} />
    <Route path="ai-chat"  element={<AIChatScreen />} />
    <Route path="stats"    element={<StatsScreen />} />
    <Route path="settings" element={<SettingsScreen />} />
  </Route>

  {/* Full-screen AI flows — no nav bar */}
  <Route path="/intervention" element={<UploadGuard><InterventionChat /></UploadGuard>} />
  <Route path="/closure"      element={<UploadGuard><ClosureScreen /></UploadGuard>} />

  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>
```

Guard:
```tsx
function UploadGuard({ children }: { children: React.ReactNode }) {
  // Only gate on whether a conversation has been uploaded (partnerContext in localStorage)
  if (!getPartnerContext()) return <Navigate to="/upload" replace />;
  return <>{children}</>;
}
```

---

## Tab bar (AppShell.tsx)

Four tabs in this exact order (only shown inside `/chat/*`):
1. **Chat** `/chat` — icon: MessageSquare
2. **AI Chat** `/chat/ai-chat` — icon: Bot
3. **Stats** `/chat/stats` — icon: BarChart2
4. **Settings** `/chat/settings` — icon: Settings

Tab bar is `fixed bottom-0 w-full`. Never show on `/intervention` or `/closure` — those are full-screen flows.

```tsx
// AppShell.tsx skeleton
export function AppShell() {
  const location = useLocation();
  const tabs = [
    { path: "/", icon: MessageSquare, label: "Chats" },
    { path: "/ai-chat", icon: Bot, label: "AI Chat" },
    { path: "/conversations", icon: History, label: "Conversations" },
    { path: "/stats", icon: BarChart2, label: "Stats" },
    { path: "/settings", icon: Settings, label: "Settings" },
  ];
  return (
    <div className="flex flex-col h-screen">
      <main className="flex-1 overflow-y-auto pb-16">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-background border-t flex justify-around py-2 pb-4">
        {tabs.map(({ path, icon: Icon, label }) => {
          const isActive = path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);
          return (
            <Link key={path} to={path} data-testid={`tab-${label.toLowerCase().replace(" ", "-")}`}
              className={cn("flex flex-col items-center gap-1 text-xs min-w-[44px] min-h-[44px] justify-center",
                isActive ? "text-foreground" : "text-muted-foreground")}>
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
```

---

## Upload flow (entry point — critical path)

```
HomeScreen
  → user clicks "Upload your conversation"
  → navigate("/upload")

UploadScreen
  → user picks .txt file (iMessage export from iPhone)
  → POST /api/parse-imessage (multipart/form-data, field: "file")
  → show parsing progress indicator
  → on success: receive { partnerName, messageCount, sampleMessages[], conversationHistory[] }
  → setPartnerContextLocal({ partnerName, sampleMessages })
  → setConversationHistoryLocal(conversationHistory)
  → navigate("/chat")
```

**How to export from iPhone:** Settings → [contact name] → Export. Users need clear instructions on the upload screen.

---

## Intervention flow (critical path — never break this)

```
ChatScreen
  → user types in "What were you going to say?" input
  → hits "Intercept" button (data-testid="intercept-button")
  → addSession({ id, timestamp, messageAttempted, outcome: "draft" })
  → POST /api/session via createSession(messageAttempted, userContext, deviceId) from api.ts
  → sessionStorage.setItem("notsent_intervention", JSON.stringify({ sessionId, messageAttempted }))
  → navigate("/intervention")

InterventionChat (no AppShell — standalone full-screen)
  → read InterventionState from sessionStorage
  → if null → navigate("/chat") immediately
  → POST /api/chat (SSE stream) with { sessionId, messageAttempted, messages: [], deviceId, userContext }
  → render tokens as they arrive (data-testid="ai-message")
  → show two buttons only after isStreaming = false:
      "I won't send it" (data-testid="wont-send-button")
        → PATCH /api/session/:id { outcome: "intercepted" }
        → updateLocalSessionOutcome(sessionId, "intercepted")
        → sessionStorage.removeItem("notsent_intervention")
        → navigate("/chat")
      "Send anyway" (data-testid="send-anyway-button")
        → PATCH /api/session/:id { outcome: "sent" }
        → updateLocalSessionOutcome(sessionId, "sent")
        → sessionStorage.removeItem("notsent_intervention")
        → navigate("/chat")
```

## Closure flow

```
ChatScreen
  → user clicks "Talk to [partnerName]" button
  → navigate("/closure")

ClosureScreen (no AppShell — standalone full-screen)
  → reads partnerContext from getPartnerContext()
  → if null → navigate("/chat") immediately
  → POST /api/chat/closure (SSE) with { messages: [], partnerContext, userContext, deviceId }
  → free chat — AI plays the ex's voice
  → "End conversation" button → navigate("/chat")
```

---

## SSE streaming — exact pattern (copy this for every AI screen)

```tsx
const abortRef = useRef<AbortController | null>(null);

async function startStream(body: object, apiPath: string) {
  abortRef.current?.abort();
  abortRef.current = new AbortController();
  setIsStreaming(true);
  setError(null);

  try {
    const resp = await fetch(`${import.meta.env.VITE_API_URL}${apiPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: abortRef.current.signal,
    });

    if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") { setIsStreaming(false); return; }
        try {
          const parsed = JSON.parse(payload);
          if (parsed.error) { setError(parsed.error); setIsStreaming(false); return; }
          if (parsed.text) {
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last?.role === "assistant") {
                return [...prev.slice(0, -1), { ...last, content: last.content + parsed.text }];
              }
              return [...prev, { role: "assistant" as const, content: parsed.text }];
            });
          }
        } catch { /* skip malformed line */ }
      }
    }
  } catch (err) {
    if ((err as Error).name !== "AbortError") setError((err as Error).message);
  } finally {
    setIsStreaming(false);
  }
}

// Cleanup on unmount — REQUIRED for every screen using SSE
useEffect(() => () => { abortRef.current?.abort(); }, []);
```

Use this pattern in: `InterventionChat`, `AIChatScreen`, `ClosureScreen` (when built). Never duplicate-paste and diverge — extract to `hooks/useSSEStream.ts` if used in 3+ places.

---

## Screen skeletons

### ChatScreen (`screens/Chat/ChatScreen.tsx`)

```tsx
export default function ChatScreen() {
  const { contactId } = useParams<{ contactId: string }>();
  const navigate = useNavigate();
  const [message, setMessage] = useState("");

  const contact = getFlaggedContacts().find(c => c.id === contactId);
  const sessions = getSessionsForContact(contactId ?? "");

  if (!contact) return <Navigate to="/" replace />;

  async function handleSend() {
    if (!message.trim()) return;
    const deviceId = getDeviceId();
    const userContext = getUserContext();

    // 1. Save local session
    const localSession: LocalSession = {
      id: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      contactId: contact.id,
      timestamp: Date.now(),
      messageAttempted: message,
      outcome: "draft",
    };
    addSession(localSession);

    // 2. Create backend session
    const { sessionId } = await createSession(message, userContext, deviceId);

    // 3. Hand off to intervention
    sessionStorage.setItem("notsent_intervention", JSON.stringify({
      sessionId,
      messageAttempted: message,
      contactId: contact.id,
    }));
    navigate("/intervention");
  }

  return (
    <div className="flex flex-col h-screen">
      {/* header */}
      {/* messages list */}
      {/* input */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t flex gap-2">
        <Input
          data-testid="message-input"
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder={`Message ${contact.name}...`}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
        />
        <Button data-testid="send-button" onClick={handleSend} disabled={!message.trim()}>
          Send
        </Button>
      </div>
    </div>
  );
}
```

### InterventionChat (`screens/Intervention/InterventionChat.tsx`)

```tsx
export default function InterventionChat() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const state = JSON.parse(sessionStorage.getItem("notsent_intervention") ?? "null") as InterventionState | null;

  useEffect(() => {
    if (!state) { navigate("/", { replace: true }); return; }
    // Seed user's message as first bubble
    setMessages([{ role: "user", content: state.messageAttempted }]);
    startStream({ /* body */ }, "/api/chat");
  }, []); // eslint-disable-line

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  async function handleOutcome(outcome: "intercepted" | "sent") {
    if (!state) return;
    await updateSessionOutcome(state.sessionId, outcome); // api.ts
    updateLocalSessionOutcome(state.sessionId, outcome);  // storage.ts
    sessionStorage.removeItem("notsent_intervention");
    navigate(-1);
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Full-screen — no AppShell, no tab bar */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} data-testid={m.role === "assistant" ? "ai-message" : undefined}
            className={cn("max-w-[85%] rounded-2xl p-3 text-sm",
              m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted")}>
            {m.content}
          </div>
        ))}
        {isStreaming && <div className="text-muted-foreground text-sm">...</div>}
      </div>
      {!isStreaming && !error && (
        <div className="p-4 flex flex-col gap-3 border-t">
          <Button data-testid="wont-send-button" onClick={() => handleOutcome("intercepted")}
            className="w-full">
            I won't send it
          </Button>
          <Button data-testid="send-anyway-button" variant="outline" onClick={() => handleOutcome("sent")}
            className="w-full">
            Send anyway
          </Button>
        </div>
      )}
    </div>
  );
}
```

---

## Storage API (complete reference)

All functions from `lib/storage.ts` — import these, never re-implement:

```ts
// Contacts
getFlaggedContacts(): FlaggedContact[]
addFlaggedContact(contact: Omit<FlaggedContact, "id" | "dateAdded">): FlaggedContact
removeFlaggedContact(id: string): void
clearFlaggedContacts(): void

// Sessions
getSessions(): LocalSession[]
getSessionsForContact(contactId: string): LocalSession[]
addSession(session: LocalSession): void
updateLocalSessionOutcome(id: string, outcome: "intercepted" | "sent"): void
deleteSessionsForContact(contactId: string): void
clearAllSessions(): void

// Device + context
getDeviceId(): string
getUserContext(): UserContext | undefined
setUserContextLocal(ctx: UserContext | undefined): void
getPartnerContext(): PartnerContext | null
setPartnerContextLocal(ctx: PartnerContext | null): void

// Guards
hasCompletedOnboarding(): boolean
```

---

## API module (`api.ts`) — complete reference

Every backend call goes through here. Current functions:

```ts
// Sessions
createSession(messageAttempted: string, userContext?: UserContext, deviceId?: string): Promise<{ sessionId: string }>
updateSessionOutcome(sessionId: string, outcome: "intercepted" | "sent"): Promise<void>

// Stats
getStats(): Promise<{ interceptionsCount: number; messagesNeverSentCount: number }>

// Context
saveUserContext(deviceId: string, userContext: UserContext): Promise<void>
getBackendUserContext(deviceId: string): Promise<UserContext | null>
savePartnerContext(deviceId: string, partnerContext: PartnerContext): Promise<void>

// Chat (SSE) — these return Response, caller reads the stream
fetchInterventionStream(body: InterventionChatBody): Promise<Response>
fetchClosureStream(body: ClosureChatBody): Promise<Response>
fetchSupportStream(body: { messages: Message[]; userContext?: UserContext; deviceId?: string }): Promise<Response>
```

When adding a new backend call: add the function to `api.ts` first, then import in the screen.

---

## Forms and validation pattern

```tsx
// Pattern for settings / onboarding forms
const [values, setValues] = useState({ name: "", phone: "" });
const [errors, setErrors] = useState<Record<string, string>>({});
const [isSubmitting, setIsSubmitting] = useState(false);

function validate(): boolean {
  const next: Record<string, string> = {};
  if (!values.name.trim()) next.name = "Name is required";
  if (!values.phone.trim()) next.phone = "Phone number is required";
  setErrors(next);
  return Object.keys(next).length === 0;
}

async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  if (!validate()) return;
  setIsSubmitting(true);
  try {
    // ... do work
  } finally {
    setIsSubmitting(false);
  }
}
```

---

## Loading and error states

Every screen that loads async data must show three states:

```tsx
if (isLoading) return <div className="flex items-center justify-center h-full"><Spinner /></div>;
if (error) return <div className="p-4 text-destructive text-sm">{error}</div>;
// happy path
```

Never show a blank screen while loading. Never swallow errors silently.

---

## Adding a new screen (step by step)

1. Create `app/src/screens/[Feature]/[FeatureName]Screen.tsx`
2. Default export the component
3. Add the route in `App.tsx` (nested under `AppShell` if it needs the tab bar, standalone if not)
4. If it needs a tab, add it to `AppShell.tsx` tabs array
5. If it needs new storage functions, add to `lib/storage.ts`
6. If it needs new API calls, add to `api.ts`
7. If it needs new types, add to `types.ts`
8. Add `data-testid` attributes to all interactive elements (see `PLAYWRIGHT.md`)

---

## Mobile-first constraints (non-negotiable)

| Constraint | Implementation |
|---|---|
| Full-height screens | `className="flex flex-col h-screen"` |
| Scrollable content | `className="flex-1 overflow-y-auto"` |
| Fixed input bar | `className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t"` |
| Tab bar clearance | `className="pb-16"` on scrollable content |
| Touch targets | `min-h-[44px] min-w-[44px]` on all tappable elements |
| Content width | `max-w-md mx-auto w-full` on content containers |
| Text | min `text-sm` body, `text-base` inputs |

---

## Website design principles (non-negotiable)

NOTSENT is a **website product** — it must look emotionally compelling and polished. This is the first thing investors, users, and press see.

- **No generic UI.** Do not use default shadcn/ui themes. Use custom color palette, typography, and spacing.
- **Emotional tone.** The design should feel calm, intimate, and slightly melancholy — not clinical or app-like.
- **Generous whitespace.** Full-viewport sections, breathing room, not a cramped dashboard.
- **Hero matters.** The HomeScreen headline and CTA are the entire product pitch. Get them right.
- **Upload UX matters most.** The upload screen is where users first trust you with something personal. It must feel safe and intentional.

---

## What to build next (in order)

### 1. HomeScreen + UploadScreen (P0 — the entry point)
- `screens/Home/HomeScreen.tsx` — hero headline, CTA to upload, brief explanation of what NOTSENT does
- `screens/Upload/UploadScreen.tsx` — file picker, upload progress, parse result preview ("Found 122 messages with Alex")
- Endpoint: `POST /api/parse-imessage`

### 2. ChatScreen redesign (P0 — upload-first)
- Remove "add contact" flow entirely
- Show uploaded conversation summary at top
- Two primary CTAs: "Intercept a message" + "Talk to [name]"

### 3. ClosureScreen (P1)
- `screens/Closure/ClosureScreen.tsx`
- Endpoint: `POST /api/chat/closure`
- Full-screen, no tab bar
- Entry from ChatScreen "Talk to [name]" button

### 4. Streak counter on Stats (P2)
- Days since last `outcome: "sent"` session
- "X days no contact" with calendar icon

### 5. Supabase auth (P1)
- Create `lib/supabase.ts` with client
- Replace `UploadGuard` with session check
- See `SUPABASE.md` for full migration plan
