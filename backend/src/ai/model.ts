/**
 * AI chat model — ready to answer prompts using available tokens.
 * Supports Anthropic (ANTHROPIC_API_KEY), OpenAI (OPENAI_API_KEY), or canned fallback.
 * No UI; call from routes or other services.
 */

import type { ChatMessage, StreamChunkCallback } from "./types.js";
import { getAIConfig } from "./config.js";
import { getCannedInterventionReply } from "./canned.js";

const DEFAULT_MAX_TOKENS = 1024;
const INTERVENTION_MODEL_ANTHROPIC = "claude-sonnet-4-20250514";
const INTERVENTION_MODEL_OPENAI = "gpt-4o-mini";

/**
 * Stream a reply using the configured provider (Anthropic, OpenAI, or canned).
 * onChunk is called with each piece of text; use for SSE or live UI later.
 */
export async function streamChat(
  options: {
    systemPrompt: string;
    messages: ChatMessage[];
    maxTokens?: number;
    /** If set, used for canned reply when no keys (e.g. messageAttempted for intervention). */
    messageAttempted?: string;
  },
  onChunk: StreamChunkCallback
): Promise<{ provider: "anthropic" | "openai" | "canned" }> {
  const config = getAIConfig();
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;

  if (config.provider === "canned") {
    const text =
      options.messageAttempted != null
        ? getCannedInterventionReply(options.messageAttempted)
        : "I'm here to support you. Take a breath — you've got this.";
    onChunk(text);
    return { provider: "canned" };
  }

  if (config.provider === "anthropic" && config.anthropicApiKey) {
    return streamAnthropic(
      config.anthropicApiKey,
      options.systemPrompt,
      options.messages,
      maxTokens,
      onChunk
    );
  }

  if (config.provider === "openai" && config.openaiApiKey) {
    return streamOpenAI(
      config.openaiApiKey,
      options.systemPrompt,
      options.messages,
      maxTokens,
      onChunk
    );
  }

  const fallback =
    options.messageAttempted != null
      ? getCannedInterventionReply(options.messageAttempted)
      : "I'm here to support you. Take a breath — you've got this.";
  onChunk(fallback);
  return { provider: "canned" };
}

async function streamAnthropic(
  apiKey: string,
  systemPrompt: string,
  messages: ChatMessage[],
  maxTokens: number,
  onChunk: StreamChunkCallback
): Promise<{ provider: "anthropic" }> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const anthropic = new Anthropic({ apiKey });
  const stream = await anthropic.messages.stream({
    model: INTERVENTION_MODEL_ANTHROPIC,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    stream: true,
  });
  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      "delta" in event &&
      (event as { delta?: { type?: string; text?: string } }).delta?.type === "text_delta"
    ) {
      const text = (event as { delta: { text?: string } }).delta.text;
      if (text) onChunk(text);
    }
  }
  return { provider: "anthropic" };
}

async function streamOpenAI(
  apiKey: string,
  systemPrompt: string,
  messages: ChatMessage[],
  maxTokens: number,
  onChunk: StreamChunkCallback
): Promise<{ provider: "openai" }> {
  const OpenAI = await import("openai").then((m) => m.default);
  const openai = new OpenAI({ apiKey });
  const stream = await openai.chat.completions.create({
    model: INTERVENTION_MODEL_OPENAI,
    max_tokens: maxTokens,
    stream: true,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
        })),
    ],
  });
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (typeof delta === "string" && delta) onChunk(delta);
  }
  return { provider: "openai" };
}

/**
 * Non-streaming: get full reply (uses stream under the hood and concatenates).
 * Use when you don't need streaming (e.g. server-side only).
 */
export async function chat(options: {
  systemPrompt: string;
  messages: ChatMessage[];
  maxTokens?: number;
  messageAttempted?: string;
}): Promise<{ text: string; provider: "anthropic" | "openai" | "canned" }> {
  const parts: string[] = [];
  const { provider } = await streamChat(options, (t) => parts.push(t));
  return { text: parts.join(""), provider };
}
