# AI Chat (scaffolding)

Model layer ready to answer prompts. **No UI** — use from routes or scripts.

## Tokens / providers

Uses whatever API keys you have (e.g. Cursor account or personal):

- **ANTHROPIC_API_KEY** — Claude (intervention + closure).
- **OPENAI_API_KEY** — OpenAI (e.g. `gpt-4o-mini`).

Set **AI_PROVIDER** to choose:

- `auto` (default): use Anthropic if key set, else OpenAI, else canned.
- `anthropic` | `openai`: force that provider (must have key).
- Without any key: **canned** responses so the app still runs.

## Files

| File | Purpose |
|------|--------|
| `types.ts` | ChatMessage, ChatOptions, StreamChunkCallback. |
| `config.ts` | Reads env (AI_PROVIDER, keys), resolves provider. |
| `canned.ts` | Fallback text when no API key. |
| `model.ts` | `streamChat()` and `chat()` — call Anthropic, OpenAI, or canned. |
| `index.ts` | Public API. |
| `run-prompt.ts` | CLI: run model on a prompt (no UI). |

## Usage from code

```ts
import { streamChat, chat } from "./ai/index.js";

// Streaming (e.g. for SSE)
await streamChat(
  {
    systemPrompt: "You are a supportive assistant.",
    messages: [{ role: "user", content: "I was about to send: I miss you." }],
    messageAttempted: "I miss you", // used for canned reply if no keys
  },
  (chunk) => process.stdout.write(chunk)
);

// One-shot
const { text, provider } = await chat({
  systemPrompt: "...",
  messages: [{ role: "user", content: "Hello" }],
});
```

## Run a prompt from CLI (no UI)

```bash
cd backend
npm run ai:prompt
# or with a prompt:
npm run ai:prompt -- "I was about to text my ex. Help."
# or with tsx:
npx tsx src/ai/run-prompt.ts "Your prompt"
```

Prompts are answered using the configured provider (Anthropic / OpenAI / canned).
