/**
 * conversationManager — trim conversation history to token budget.
 * Keeps last 20 messages. Prepends a 2-sentence summary if history is longer.
 */

type Message = { role: "user" | "assistant"; content: string };

const MAX_MESSAGES = 20;

function summarizeEarly(messages: Message[]): string {
  // Simple heuristic summary — Tier 2 will use an LLM summarizer
  const topics = new Set<string>();
  const TOPIC_WORDS = ["love", "miss", "fight", "plans", "work", "family", "together", "break"];

  for (const m of messages) {
    const lower = m.content.toLowerCase();
    for (const word of TOPIC_WORDS) {
      if (lower.includes(word)) topics.add(word);
    }
  }

  const topicList = [...topics].slice(0, 3).join(", ") || "various topics";
  return `Earlier in this conversation, you discussed ${topicList}.`;
}

export function trimConversationHistory(
  history: Message[]
): Message[] {
  if (history.length <= MAX_MESSAGES) return history;

  const early = history.slice(0, history.length - MAX_MESSAGES);
  const recent = history.slice(-MAX_MESSAGES);
  const summary = summarizeEarly(early);

  // Prepend summary as the first user message context
  return [
    { role: "user", content: `[Context from earlier: ${summary}]` },
    { role: "assistant", content: "Got it." },
    ...recent,
  ];
}
