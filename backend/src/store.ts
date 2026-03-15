import type { Session, ConversationTurn, UserContext, PartnerContext } from "./types.js";
import { supabaseAdmin, supabaseEnabled } from "./lib/supabase.js";

// In-memory fallback Maps (used when Supabase is not configured)
const sessions = new Map<string, Session>();
const conversationHistoryBySession = new Map<string, ConversationTurn[]>();
const userContextByDevice = new Map<string, UserContext>();
const partnerContextByDevice = new Map<string, PartnerContext>();

// --- Sessions ---

export async function createSession(
  messageAttempted: string,
  userContext?: UserContext,
  deviceId?: string
): Promise<Session> {
  const id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  if (supabaseEnabled && supabaseAdmin && deviceId) {
    const { data, error } = await supabaseAdmin
      .from("sessions")
      .insert({
        id,
        user_id: deviceId,
        message_attempted: messageAttempted,
        outcome: "draft",
      })
      .select()
      .single();
    if (error) throw error;
    if (userContext) userContextByDevice.set(deviceId, userContext);
    return {
      id: data.id,
      messageAttempted: data.message_attempted,
      createdAt: new Date(data.created_at).getTime(),
    };
  }

  // In-memory fallback
  const session: Session = { id, messageAttempted, createdAt: Date.now() };
  sessions.set(id, session);
  if (deviceId && userContext) userContextByDevice.set(deviceId, userContext);
  return session;
}

export async function getSession(id: string): Promise<Session | undefined> {
  if (supabaseEnabled && supabaseAdmin) {
    const { data } = await supabaseAdmin
      .from("sessions")
      .select()
      .eq("id", id)
      .maybeSingle();
    if (!data) return undefined;
    return {
      id: data.id,
      messageAttempted: data.message_attempted,
      createdAt: new Date(data.created_at).getTime(),
      outcome: data.outcome !== "draft" ? (data.outcome as Session["outcome"]) : undefined,
    };
  }
  return sessions.get(id);
}

export async function getAllSessions(userId?: string): Promise<Session[]> {
  if (supabaseEnabled && supabaseAdmin && userId) {
    const { data } = await supabaseAdmin
      .from("sessions")
      .select()
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    return (data ?? []).map((d) => ({
      id: d.id,
      messageAttempted: d.message_attempted,
      createdAt: new Date(d.created_at).getTime(),
      outcome: d.outcome !== "draft" ? (d.outcome as Session["outcome"]) : undefined,
    }));
  }
  return Array.from(sessions.values());
}

// --- Conversation history ---

export async function appendConversationTurn(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
  userId?: string
): Promise<void> {
  if (supabaseEnabled && supabaseAdmin && userId) {
    await supabaseAdmin.from("conversation_turns").insert({
      session_id: sessionId,
      user_id: userId,
      role,
      content,
    });
    return;
  }
  const list = conversationHistoryBySession.get(sessionId) ?? [];
  list.push({ role, content, timestamp: Date.now() });
  conversationHistoryBySession.set(sessionId, list);
}

export async function getConversationHistory(sessionId: string): Promise<ConversationTurn[]> {
  if (supabaseEnabled && supabaseAdmin) {
    const { data } = await supabaseAdmin
      .from("conversation_turns")
      .select()
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    return (data ?? []).map((d) => ({
      role: d.role as "user" | "assistant",
      content: d.content,
      timestamp: new Date(d.created_at).getTime(),
    }));
  }
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

// --- User / partner context ---

export async function setUserContext(deviceId: string, context: UserContext): Promise<void> {
  if (supabaseEnabled && supabaseAdmin) {
    await supabaseAdmin.from("user_contexts").upsert(
      {
        user_id: deviceId,
        breakup_summary: context.breakupSummary ?? null,
        partner_name: context.partnerName ?? null,
        no_contact_days: context.noContactDays ?? null,
        conversation_context: context.conversationContext ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    return;
  }
  userContextByDevice.set(deviceId, context);
}

export async function getUserContext(deviceId: string): Promise<UserContext | undefined> {
  if (supabaseEnabled && supabaseAdmin) {
    const { data } = await supabaseAdmin
      .from("user_contexts")
      .select()
      .eq("user_id", deviceId)
      .maybeSingle();
    if (!data) return undefined;
    return {
      breakupSummary: data.breakup_summary ?? undefined,
      partnerName: data.partner_name ?? undefined,
      noContactDays: data.no_contact_days ?? undefined,
      conversationContext: data.conversation_context ?? undefined,
    };
  }
  return userContextByDevice.get(deviceId);
}

export async function setPartnerContext(deviceId: string, context: PartnerContext): Promise<void> {
  if (supabaseEnabled && supabaseAdmin) {
    // partner_contexts has unique(user_id, contact_id) but contact_id can be null.
    // NULL != NULL in Postgres unique constraints, so we do manual upsert.
    const { data: existing } = await supabaseAdmin
      .from("partner_contexts")
      .select("id")
      .eq("user_id", deviceId)
      .is("contact_id", null)
      .maybeSingle();
    if (existing) {
      await supabaseAdmin
        .from("partner_contexts")
        .update({
          partner_name: context.partnerName,
          sample_messages: context.sampleMessages ?? [],
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabaseAdmin.from("partner_contexts").insert({
        user_id: deviceId,
        contact_id: null,
        partner_name: context.partnerName,
        sample_messages: context.sampleMessages ?? [],
      });
    }
    return;
  }
  partnerContextByDevice.set(deviceId, context);
}

export async function getPartnerContext(deviceId: string): Promise<PartnerContext | undefined> {
  if (supabaseEnabled && supabaseAdmin) {
    const { data } = await supabaseAdmin
      .from("partner_contexts")
      .select()
      .eq("user_id", deviceId)
      .is("contact_id", null)
      .maybeSingle();
    if (!data) return undefined;
    return {
      partnerName: data.partner_name,
      sampleMessages: data.sample_messages ?? undefined,
    };
  }
  return partnerContextByDevice.get(deviceId);
}

// --- Token usage logging ---

export async function logTokenUsage(opts: {
  userId: string;
  sessionId?: string;
  mode: "intervention" | "closure" | "support" | "contact";
  model: string;
  inputTokens: number;
  outputTokens: number;
}): Promise<void> {
  if (!supabaseEnabled || !supabaseAdmin) return;
  await supabaseAdmin.from("token_usage").insert({
    user_id: opts.userId,
    session_id: opts.sessionId ?? null,
    mode: opts.mode,
    model: opts.model,
    input_tokens: opts.inputTokens,
    output_tokens: opts.outputTokens,
  });
}
