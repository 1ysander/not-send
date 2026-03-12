/**
 * AI provider config from env.
 * Use ANTHROPIC_API_KEY or OPENAI_API_KEY (Cursor/account tokens work here).
 */

export type ResolvedProvider = "anthropic" | "openai" | "gemini" | "canned";

export interface AIConfig {
  provider: ResolvedProvider;
  anthropicApiKey: string | undefined;
  openaiApiKey: string | undefined;
  geminiApiKey: string | undefined;
}

export function getAIConfig(): AIConfig {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const raw = (process.env.AI_PROVIDER ?? "auto").toLowerCase();

  let provider: ResolvedProvider = "canned";
  if (raw === "anthropic" && anthropicApiKey) provider = "anthropic";
  else if (raw === "openai" && openaiApiKey) provider = "openai";
  else if (raw === "gemini" && geminiApiKey) provider = "gemini";
  else if (raw === "auto") {
    if (geminiApiKey) provider = "gemini";
    else if (anthropicApiKey) provider = "anthropic";
    else if (openaiApiKey) provider = "openai";
  }

  return { provider, anthropicApiKey, openaiApiKey, geminiApiKey };
}
