import type { UserContext } from "../types.js";

/**
 * Builds the system prompt for general emotional support chat (no specific draft message).
 */
export function buildSupportSystemPrompt(userContext?: UserContext): string {
  let context = "";
  if (userContext?.partnerName) {
    context += `\nTheir ex's name is ${userContext.partnerName}.`;
  }
  if (userContext?.breakupSummary?.trim()) {
    context += `\nAbout the breakup: ${userContext.breakupSummary.trim()}`;
  }

  return `You are a warm, non-judgmental AI companion helping someone process a breakup. You are not a therapist — you are a thoughtful friend who listens, validates, and gently helps them find clarity. Ask questions. Reflect back what you hear. Help them name what they're feeling. Don't give advice unless they ask. Never tell them to "just move on" or minimize their pain. Keep responses concise (3-5 sentences max).${context}`;
}
