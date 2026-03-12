# FRONTEND_CHAT Sub-Agent — NOTSENT Chat UI Components

> **Parent agent:** FRONTEND
> **Scope:** `app/src/components/chat/` + `app/src/screens/Chat/` + `app/src/screens/AIChat/` + `app/src/screens/Closure/` + `app/src/screens/Intervention/`
> **Load order:** CLAUDE.md → FRONTEND.md → this file

---

## Role

You build all chat-related UI — the conversation window, message bubbles, message input, and the interception overlay. You do not build settings, contacts, stats, or navigation. All data goes through `api.ts`. All storage through `lib/storage.ts`.

---

## Directory ownership

```
app/src/
  components/
    chat/
      ChatWindow.tsx         ← scrollable message list — generic, reused across modes
      MessageBubble.tsx      ← single message with sender styling
      MessageInput.tsx       ← text field + send/intercept button
      InterceptionOverlay.tsx ← "are you sure?" slide-up panel when AI flags
      TypingIndicator.tsx    ← animated dots while AI is streaming
  screens/
    Chat/
      ChatScreen.tsx         ← main chat view after upload — shows parsed convo + CTAs
      WelcomeView.tsx        ← first-time empty state before any upload
    AIChat/
      AIChatScreen.tsx       ← standalone support chatbot
      ContactAIChatScreen.tsx ← AI chat in context of a specific contact
    Intervention/
      InterventionChat.tsx   ← full-screen AI intervention flow
    Closure/
      ClosureScreen.tsx      ← AI plays the ex's voice
```

---

## ChatWindow — reusable container

`ChatWindow` renders a scrollable list of `MessageBubble` components. It is **mode-agnostic** — the same component renders in AIChat, Intervention, and Closure screens.

```tsx
interface ChatWindowProps {
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp?: number;
  }>;
  isStreaming?: boolean;   // shows TypingIndicator when true
  partnerName?: string;    // used in Closure mode for "speaking as" label
}

export function ChatWindow({ messages, isStreaming, partnerName }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  return (
    <div className="flex flex-col gap-3 overflow-y-auto px-4 py-4 flex-1">
      {messages.map(msg => (
        <MessageBubble key={msg.id} message={msg} partnerName={partnerName} />
      ))}
      {isStreaming && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  );
}
```

---

## MessageBubble — styling rules

User messages: right-aligned, dark bg (`bg-zinc-900 text-white`), rounded top-left + both bottom.
Assistant messages: left-aligned, soft bg (`bg-zinc-100 text-zinc-900`), rounded top-right + both bottom.

In Closure mode, assistant messages show the partner's name as a label above the bubble.

```tsx
interface MessageBubbleProps {
  message: { role: "user" | "assistant"; content: string; timestamp?: number };
  partnerName?: string;  // shown above assistant bubble in closure mode
}

export function MessageBubble({ message, partnerName }: MessageBubbleProps) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} animate-fadeIn`}>
      <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
        isUser
          ? "bg-zinc-900 text-white rounded-br-sm"
          : "bg-zinc-100 text-zinc-900 rounded-bl-sm"
      }`}>
        {!isUser && partnerName && (
          <p className="text-xs text-zinc-400 mb-1 font-medium">{partnerName}</p>
        )}
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}
```

---

## MessageInput — intercept vs. send

In intervention mode, the send button becomes "Intercept" — it submits the user's draft to the AI instead of sending it to the real ex.

```tsx
interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  mode: "chat" | "intercept";   // "intercept" changes button label
  disabled?: boolean;
  placeholder?: string;
}
```

Always include an `AbortController` reference so the SSE stream can be cancelled on unmount.

---

## InterceptionOverlay — the money moment

This slides up from the bottom when the user tries to send a message to a flagged contact. It shows the AI's risk assessment and offers choices.

Animation: `translate-y-full` → `translate-y-0` with `transition-transform duration-300 ease-out`.

```tsx
interface InterceptionOverlayProps {
  isOpen: boolean;
  draftMessage: string;
  onProceedToAI: () => void;      // user wants to process with AI — open InterventionChat
  onSendAnyway: () => void;       // user overrides — send without AI review
  onCancel: () => void;           // close overlay, don't send
}
```

Copy for overlay heading: **"Before you send..."**
Sub-copy: "Take 30 seconds to check in with yourself. Your AI is here to help."

---

## SSE streaming pattern (all chat screens)

All chat screens that call AI endpoints use the same fetch + ReadableStream pattern:

```tsx
// Canonical streaming hook pattern
async function sendMessage(userMessage: string) {
  const controller = new AbortController();
  setIsStreaming(true);

  try {
    const response = await fetch(`${API_URL}/api/chat/support`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [...history, { role: "user", content: userMessage }] }),
      signal: controller.signal,
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let assistantMessage = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const lines = decoder.decode(value).split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const { text } = JSON.parse(data);
            if (text) {
              assistantMessage += text;
              // Update UI incrementally
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && last.id === "streaming") {
                  return [...prev.slice(0, -1), { ...last, content: assistantMessage }];
                }
                return [...prev, { id: "streaming", role: "assistant", content: assistantMessage }];
              });
            }
          } catch { /* skip malformed chunks */ }
        }
      }
    }
  } catch (err) {
    if ((err as Error).name !== "AbortError") console.error(err);
  } finally {
    setIsStreaming(false);
  }

  return () => controller.abort(); // cleanup
}
```

**Critical:** always cancel the stream on component unmount using `useEffect` cleanup.

---

## Animation tokens

Add these to `tailwind.config.ts` under `extend.animation`:

```ts
'fadeIn': 'fadeIn 0.2s ease-out',
'slideUp': 'slideUp 0.3s ease-out',
```

Under `extend.keyframes`:

```ts
fadeIn: { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
slideUp: { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
```

---

## Design rules (chat-specific)

- Max chat bubble width: 80% of container (`max-w-[80%]`)
- Line height: relaxed (`leading-relaxed`) — text is emotional, needs breathing room
- Font size: `text-sm` for bubbles, `text-base` for input
- Timestamp: only show on hover/long-press — don't clutter the chat
- Avatar: no avatars for AI responses — clean, no anthropomorphization
- Closure mode: subtle label above AI bubble with ex's name in muted color (`text-zinc-400`)

---

## What to build (priority order)

1. **`ChatWindow` + `MessageBubble` + `TypingIndicator`** — generic components (P0)
2. **`AIChatScreen` streaming** — wire up support mode (P0, partially exists)
3. **`MessageInput` with intercept mode** — intercept CTA (P0)
4. **`InterceptionOverlay`** — the slide-up panel (P1)
5. **`InterventionChat`** — full intervention flow (P1)
6. **`ClosureScreen`** refactor — use shared `ChatWindow` + add partner name label (P1)
