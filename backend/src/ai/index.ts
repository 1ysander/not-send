/**
 * AI chat module — model ready to answer prompts.
 * Use ANTHROPIC_API_KEY or OPENAI_API_KEY (e.g. Cursor account tokens).
 * No UI; integrate from routes or scripts.
 */

export { streamChat, chat } from "./model.js";
export { getAIConfig } from "./config.js";
export { getCannedInterventionReply } from "./canned.js";
export type {
  ChatMessage,
  ChatRole,
  ChatOptions,
  ChatResult,
  StreamChunkCallback,
  StreamChatOptions,
  AIProvider,
} from "./types.js";
export type { AIConfig, ResolvedProvider } from "./config.js";
