/**
 * AI chat types — used by the model layer to answer prompts.
 * No UI; scaffolding only.
 */

export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export type AIProvider = "anthropic" | "openai" | "canned" | "auto";

export interface ChatOptions {
  /** System prompt (persona + context). */
  systemPrompt: string;
  /** Conversation messages (user/assistant). */
  messages: ChatMessage[];
  /** Max tokens for the model reply. */
  maxTokens?: number;
  /** Provider override; otherwise uses env AI_PROVIDER / auto-detect from keys. */
  provider?: AIProvider;
}

export interface ChatResult {
  /** Full assistant reply text. */
  text: string;
  /** Which provider was used. */
  provider: AIProvider;
}

/** Callback for streaming: called with each text chunk. */
export type StreamChunkCallback = (text: string) => void;

export interface StreamChatOptions extends ChatOptions {
  onChunk: StreamChunkCallback;
}
