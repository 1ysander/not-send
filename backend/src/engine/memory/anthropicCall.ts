/**
 * Direct Anthropic call with explicit model selection.
 * Used by the memory engine to route Haiku vs Sonnet per sub-agent.
 * Only called when provider is Anthropic — callers must guard.
 */

import { getAIConfig } from "../../ai/config.js";

export const HAIKU_MODEL = "claude-haiku-4-5-20251001";
export const SONNET_MODEL = "claude-sonnet-4-20250514";

export async function callAnthropic(opts: {
  model: "haiku" | "sonnet";
  system: string;
  userMessage: string;
  maxTokens: number;
}): Promise<string> {
  const config = getAIConfig();
  if (!config.anthropicApiKey) {
    throw new Error("[memoryEngine] Anthropic API key required");
  }

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: config.anthropicApiKey });

  const modelId = opts.model === "haiku" ? HAIKU_MODEL : SONNET_MODEL;
  const response = await client.messages.create({
    model: modelId,
    max_tokens: opts.maxTokens,
    system: opts.system,
    messages: [{ role: "user", content: opts.userMessage }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock && "text" in textBlock ? textBlock.text : "";
}
