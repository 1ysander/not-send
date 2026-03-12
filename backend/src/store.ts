import type { Session, ConversationTurn, UserContext, PartnerContext } from "./types.js";

const sessions = new Map<string, Session>();

/** Conversation history per session (for intervention continuity + token accounting). */
const conversationHistoryBySession = new Map<string, ConversationTurn[]>();

/** Optional user context keyed by client device/user id (for prompt personalization). */
const userContextByDevice = new Map<string, UserContext>();

/** Optional partner context keyed by client device/user id (for closure flow). */
const partnerContextByDevice = new Map<string, PartnerContext>();

// --- Sessions (existing) ---

export function createSession(
  messageAttempted: string,
  userContext?: UserContext,
  deviceId?: string
): Session {
  const id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const session: Session = {
    id,
    messageAttempted,
    outcome: "draft",
    createdAt: Date.now(),
  };
  sessions.set(id, session);
  if (deviceId && userContext) {
    userContextByDevice.set(deviceId, userContext);
  }
  return session;
}

export function updateSessionOutcome(
  id: string,
  outcome: "intercepted" | "sent"
): Session | undefined {
  const session = sessions.get(id);
  if (!session) return undefined;
  session.outcome = outcome;
  return session;
}

export function getSession(id: string): Session | undefined {
  return sessions.get(id);
}

export function getAllSessions(): Session[] {
  return Array.from(sessions.values());
}

// --- Conversation history (for prompts + eventual token usage) ---

export function appendConversationTurn(
  sessionId: string,
  role: "user" | "assistant",
  content: string
): void {
  const list = conversationHistoryBySession.get(sessionId) ?? [];
  list.push({ role, content, timestamp: Date.now() });
  conversationHistoryBySession.set(sessionId, list);
}

export function getConversationHistory(sessionId: string): ConversationTurn[] {
  return conversationHistoryBySession.get(sessionId) ?? [];
}

/** Return last N turns across all sessions for a device (for "recent context" in prompt). */
export function getRecentHistoryForDevice(
  _deviceId: string,
  limit: number = 20
): ConversationTurn[] {
  const all: ConversationTurn[] = [];
  for (const turns of conversationHistoryBySession.values()) {
    all.push(...turns);
  }
  all.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
  return all.slice(0, limit);
}

// --- User / partner context (for intervention + closure) ---

export function setUserContext(deviceId: string, context: UserContext): void {
  userContextByDevice.set(deviceId, context);
}

export function getUserContext(deviceId: string): UserContext | undefined {
  return userContextByDevice.get(deviceId);
}

export function setPartnerContext(deviceId: string, context: PartnerContext): void {
  partnerContextByDevice.set(deviceId, context);
}

export function getPartnerContext(deviceId: string): PartnerContext | undefined {
  return partnerContextByDevice.get(deviceId);
}

export function getStats(): { interceptionsCount: number; messagesNeverSentCount: number } {
  const all = Array.from(sessions.values());
  return {
    interceptionsCount: all.filter((s) => s.outcome === "intercepted").length,
    messagesNeverSentCount: all.filter((s) => s.outcome !== "sent").length,
  };
}
