/**
 * Conversation engine — session lifecycle, history, and AI streaming.
 * Orchestrates store, prompts, and AI; does not change existing API behavior.
 */

import type { Session, ConversationTurn, UserContext, PartnerContext } from "../src/types.js";
import {
  createSession as createSessionInStore,
  updateSessionOutcome,
  getSession,
  getAllSessions,
  appendConversationTurn,
  getConversationHistory,
  getRecentHistoryForDevice,
  setUserContext,
  getUserContext,
  setPartnerContext,
  getPartnerContext,
} from "../src/store.js";
import { streamChat } from "../src/ai/index.js";
import { buildInterventionSystemPrompt } from "../src/prompts/intervention.js";
import { buildClosureSystemPrompt } from "../src/prompts/closure.js";

const SUPPORT_SYSTEM_PROMPT = `You are a calm, supportive AI for NOTSENT — an app that helps people avoid texting their ex in the heat of the moment. The user is talking to you for general support about their breakup, urges to reach out, or moving on. Be warm and brief. Ask questions. Don't lecture. Help them process what they're feeling.`;

// --- Session lifecycle (unchanged behavior) ---

export function createSession(
  messageAttempted: string,
  userContext?: UserContext,
  deviceId?: string
): Session {
  return createSessionInStore(messageAttempted, userContext, deviceId);
}

export function getSessionById(id: string): Session | undefined {
  return getSession(id);
}

export function updateOutcome(id: string, outcome: "intercepted" | "sent"): Session | undefined {
  return updateSessionOutcome(id, outcome);
}

// --- Conversation history ---

export function appendTurn(
  sessionId: string,
  role: "user" | "assistant",
  content: string
): void {
  appendConversationTurn(sessionId, role, content);
}

export function getHistory(sessionId: string): ConversationTurn[] {
  return getConversationHistory(sessionId);
}

export function getRecentHistory(deviceId: string, limit: number = 20): ConversationTurn[] {
  return getRecentHistoryForDevice(deviceId, limit);
}

// --- User / partner context ---

export function setUserContextByDevice(deviceId: string, context: UserContext): void {
  setUserContext(deviceId, context);
}

export function getUserContextByDevice(deviceId: string): UserContext | undefined {
  return getUserContext(deviceId);
}

export function setPartnerContextByDevice(deviceId: string, context: PartnerContext): void {
  setPartnerContext(deviceId, context);
}

export function getPartnerContextByDevice(deviceId: string): PartnerContext | undefined {
  return getPartnerContext(deviceId);
}

// --- Stats ---

export function getStats(): { interceptionsCount: number; messagesNeverSentCount: number } {
  const sessions = getAllSessions();
  const interceptionsCount = sessions.filter((s) => s.outcome === "intercepted").length;
  const messagesNeverSentCount = sessions.filter(
    (s) => s.outcome === "intercepted" || s.outcome === "draft"
  ).length;
  return { interceptionsCount, messagesNeverSentCount };
}

// --- Streaming: intervention, closure, support ---

export type StreamChunkCallback = (text: string) => void;

export async function streamIntervention(
  params: {
    sessionId?: string;
    messageAttempted: string;
    messages: Array<{ role: string; content: string }>;
    conversationHistory?: ConversationTurn[];
    userContext?: UserContext;
    deviceId?: string;
  },
  onChunk: StreamChunkCallback
): Promise<{ fullReply: string }> {
  const userContext =
    params.userContext ??
    (typeof params.deviceId === "string" ? getUserContext(params.deviceId) : undefined);
  let history: ConversationTurn[] =
    Array.isArray(params.conversationHistory) && params.conversationHistory.length > 0
      ? params.conversationHistory
      : params.sessionId && typeof params.sessionId === "string"
        ? getConversationHistory(params.sessionId)
        : [];
  if (history.length === 0 && typeof params.deviceId === "string") {
    history = getRecentHistoryForDevice(params.deviceId, 12);
  }
  const systemPrompt = buildInterventionSystemPrompt(params.messageAttempted, {
    userContext,
    conversationHistory: history,
    maxHistoryTurns: 10,
  });
  const chatMessages = params.messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
  let fullReply = "";
  await streamChat(
    { systemPrompt, messages: chatMessages, messageAttempted: params.messageAttempted },
    (text) => {
      fullReply += text;
      onChunk(text);
    }
  );
  if (params.sessionId && typeof params.sessionId === "string") {
    const lastUser = params.messages.filter((m) => m.role === "user").pop();
    if (lastUser?.content) appendConversationTurn(params.sessionId, "user", lastUser.content);
    if (fullReply) appendConversationTurn(params.sessionId, "assistant", fullReply);
  }
  return { fullReply };
}

export async function streamClosure(
  params: {
    messages: Array<{ role: string; content: string }>;
    userContext?: UserContext;
    partnerContext?: PartnerContext;
    deviceId?: string;
  },
  onChunk: StreamChunkCallback
): Promise<void> {
  const partnerContext =
    params.partnerContext ??
    (typeof params.deviceId === "string" ? getPartnerContext(params.deviceId) : undefined);
  if (!partnerContext?.partnerName) {
    throw new Error("partnerContext.partnerName is required (or set partnerContext via deviceId)");
  }
  const userContext =
    params.userContext ??
    (typeof params.deviceId === "string" ? getUserContext(params.deviceId) : undefined);
  const systemPrompt = buildClosureSystemPrompt(partnerContext, userContext);
  const chatMessages = params.messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
  await streamChat({ systemPrompt, messages: chatMessages }, onChunk);
}

export async function streamSupport(
  params: {
    messages: Array<{ role: string; content: string }>;
    userContext?: UserContext;
    deviceId?: string;
  },
  onChunk: StreamChunkCallback
): Promise<void> {
  const userContext =
    params.userContext ??
    (typeof params.deviceId === "string" ? getUserContext(params.deviceId) : undefined);
  let systemPrompt = SUPPORT_SYSTEM_PROMPT;
  if (userContext?.partnerName) {
    systemPrompt += ` Their ex's name is ${userContext.partnerName}.`;
  }
  if (userContext?.breakupSummary?.trim()) {
    systemPrompt += ` About their situation: ${userContext.breakupSummary.slice(0, 300)}.`;
  }
  const chatMessages = params.messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
  await streamChat({ systemPrompt, messages: chatMessages }, onChunk);
}
