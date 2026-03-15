/**
 * groq.ts — Dedicated Groq client for extraction and analysis passes.
 * Uses the OpenAI-compatible Groq API directly, bypassing the provider-switch
 * in model.ts so extraction always runs on Groq (free) regardless of what
 * AI_PROVIDER is configured for the main chat.
 *
 * Models:
 * - GROQ_EXTRACTION_MODEL: llama-3.3-70b-versatile — 128k context, free tier
 *   Used for: unified psychological extraction (one-time, non-streaming)
 * - GROQ_FAST_MODEL: llama-3.1-8b-instant — ultra-fast, free tier
 *   Used for: lightweight scoring passes, quick calibration
 */

export const GROQ_EXTRACTION_MODEL = "llama-3.3-70b-versatile";
export const GROQ_FAST_MODEL = "llama-3.1-8b-instant";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

export interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GroqChatOptions {
  model?: string;
  systemPrompt: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Non-streaming Groq call. Returns the full text response.
 * Throws if GROQ_API_KEY is not set.
 */
export async function chatGroq(options: GroqChatOptions): Promise<{ text: string }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "[chatGroq] GROQ_API_KEY not set. Add it to backend/.env to use Groq-powered extraction."
    );
  }

  const model = options.model ?? GROQ_EXTRACTION_MODEL;

  const messages: GroqMessage[] = [
    { role: "system", content: options.systemPrompt },
    ...options.messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: options.maxTokens ?? 6000,
      temperature: options.temperature ?? 0.3,  // low temp for structured JSON output
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`[chatGroq] Groq API error ${response.status}: ${body.slice(0, 300)}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  const text = data.choices?.[0]?.message?.content ?? "";
  return { text };
}
