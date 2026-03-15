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
const INTERVENTION_MODEL_GEMINI = "gemini-2.0-flash";
const INTERVENTION_MODEL_GROQ = "llama-3.1-8b-instant";

export interface StreamChatUsage {
  inputTokens: number;
  outputTokens: number;
  model: string;
}

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
    /** Override the Anthropic model (e.g. use Haiku for lightweight passes). */
    model?: string;
  },
  onChunk: StreamChunkCallback
): Promise<{ provider: "anthropic" | "openai" | "gemini" | "groq" | "canned"; usage?: StreamChatUsage }> {
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
      onChunk,
      options.model
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

  if (config.provider === "gemini" && config.geminiApiKey) {
    return streamGemini(
      config.geminiApiKey,
      options.systemPrompt,
      options.messages,
      maxTokens,
      onChunk
    );
  }

  if (config.provider === "groq" && config.groqApiKey) {
    return streamGroq(
      config.groqApiKey,
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
  onChunk: StreamChunkCallback,
  modelOverride?: string
): Promise<{ provider: "anthropic"; usage?: StreamChatUsage }> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const anthropic = new Anthropic({ apiKey });
  const model = modelOverride ?? INTERVENTION_MODEL_ANTHROPIC;
  const stream = anthropic.messages.stream({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
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
  try {
    const finalMsg = await stream.finalMessage();
    return {
      provider: "anthropic",
      usage: {
        inputTokens: finalMsg.usage.input_tokens,
        outputTokens: finalMsg.usage.output_tokens,
        model,
      },
    };
  } catch {
    return { provider: "anthropic" };
  }
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

async function streamGemini(
  apiKey: string,
  systemPrompt: string,
  messages: ChatMessage[],
  maxTokens: number,
  onChunk: StreamChunkCallback
): Promise<{ provider: "gemini" }> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: INTERVENTION_MODEL_GEMINI,
    systemInstruction: systemPrompt,
  });

  const history = messages
    .filter((m) => m.role !== "system")
    .slice(0, -1)
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const lastMessage = messages.filter((m) => m.role !== "system").at(-1);
  const chat = model.startChat({ history, generationConfig: { maxOutputTokens: maxTokens } });
  const result = await chat.sendMessageStream(lastMessage?.content ?? "");

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) onChunk(text);
  }
  return { provider: "gemini" };
}

async function streamGroq(
  apiKey: string,
  systemPrompt: string,
  messages: ChatMessage[],
  maxTokens: number,
  onChunk: StreamChunkCallback
): Promise<{ provider: "groq" }> {
  const OpenAI = await import("openai").then((m) => m.default);
  // Groq is OpenAI-API-compatible — just point baseURL at Groq
  const groq = new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });
  const stream = await groq.chat.completions.create({
    model: INTERVENTION_MODEL_GROQ,
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
  return { provider: "groq" };
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
  model?: string;
}): Promise<{ text: string; provider: "anthropic" | "openai" | "gemini" | "groq" | "canned" }> {
  const parts: string[] = [];
  const { provider } = await streamChat(options, (t) => parts.push(t));
  return { text: parts.join(""), provider };
}
