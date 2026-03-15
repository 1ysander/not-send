import type { FlaggedContact, LocalSession, UserContext, PartnerContext, AIChatMessage, ContactProfile, MoodEntry } from "../types";
import { supabase, supabaseEnabled } from "./supabase";

// Re-export for consumers
export { supabaseEnabled };

const FLAGGED_KEY = "notsent_flaggedContacts";
const SESSIONS_KEY = "notsent_sessions";
const DEVICE_ID_KEY = "notsent_deviceId";
const USER_CONTEXT_KEY = "notsent_userContext";
const PARTNER_CONTEXT_KEY = "notsent_partnerContext";

export function getFlaggedContacts(): FlaggedContact[] {
  try {
    const raw = localStorage.getItem(FLAGGED_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function setFlaggedContacts(contacts: FlaggedContact[]): void {
  localStorage.setItem(FLAGGED_KEY, JSON.stringify(contacts));
}

export function addFlaggedContact(contact: Omit<FlaggedContact, "id" | "dateAdded">): FlaggedContact {
  const contacts = getFlaggedContacts();
  const newContact: FlaggedContact = {
    ...contact,
    id: `contact_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    dateAdded: Date.now(),
  };
  contacts.push(newContact);
  setFlaggedContacts(contacts);
  return newContact;
}

export function removeFlaggedContact(id: string): void {
  setFlaggedContacts(getFlaggedContacts().filter((c) => c.id !== id));
  deleteContactProfile(id);
}

export function updateFlaggedContact(id: string, updates: { name?: string; phoneNumber?: string }): void {
  setFlaggedContacts(
    getFlaggedContacts().map((c) =>
      c.id === id ? { ...c, ...updates } : c
    )
  );
}

export function clearFlaggedContacts(): void {
  localStorage.removeItem(FLAGGED_KEY);
}

export function getSessions(): LocalSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const sessions: LocalSession[] = Array.isArray(parsed) ? parsed : [];
    const contacts = getFlaggedContacts();
    const needsMigration = sessions.some((s: LocalSession) => !s.contactId);
    if (needsMigration && contacts.length === 1) {
      const contactId = contacts[0].id;
      const migrated = sessions.map((s: LocalSession) =>
        s.contactId ? s : { ...s, contactId }
      );
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(migrated));
      return migrated;
    }
    return sessions;
  } catch {
    return [];
  }
}

/** Sessions for a specific contact (conversation thread). */
export function getSessionsForContact(contactId: string): LocalSession[] {
  return getSessions().filter((s) => s.contactId === contactId);
}

/** Remove all sessions (messages) for a contact. Does not remove the contact. */
export function deleteSessionsForContact(contactId: string): void {
  const sessions = getSessions().filter((s) => s.contactId !== contactId);
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

/** Remove all sessions across all contacts. */
export function clearAllSessions(): void {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify([]));
}

export function addSession(session: LocalSession): void {
  const sessions = getSessions();
  sessions.push(session);
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}


export function hasCompletedOnboarding(): boolean {
  return getFlaggedContacts().length > 0;
}

/** Stable device id for API context (user/partner context). */
export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function getUserContext(): UserContext | undefined {
  try {
    const raw = localStorage.getItem(USER_CONTEXT_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (
      !parsed.breakupSummary &&
      !parsed.partnerName &&
      !parsed.conversationContext
    )
      return undefined;
    return {
      breakupSummary: parsed.breakupSummary,
      partnerName: parsed.partnerName,
      conversationContext: parsed.conversationContext,
    };
  } catch {
    return undefined;
  }
}

export function setUserContextLocal(ctx: UserContext | undefined): void {
  if (
    !ctx?.breakupSummary &&
    !ctx?.partnerName &&
    !ctx?.conversationContext
  ) {
    localStorage.removeItem(USER_CONTEXT_KEY);
    return;
  }
  localStorage.setItem(USER_CONTEXT_KEY, JSON.stringify({
    breakupSummary: ctx.breakupSummary,
    partnerName: ctx.partnerName,
    conversationContext: ctx.conversationContext,
  }));
}

/** Partner context (name + sample messages) for closure / tone. Stored per app; use contactId for per-contact later. */
export function getPartnerContext(): PartnerContext | null {
  try {
    const raw = localStorage.getItem(PARTNER_CONTEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.partnerName) return null;
    return {
      partnerName: parsed.partnerName,
      sampleMessages: Array.isArray(parsed.sampleMessages)
        ? parsed.sampleMessages.filter(
            (m: unknown) =>
              m != null &&
              typeof m === "object" &&
              typeof (m as { fromPartner?: unknown }).fromPartner === "boolean" &&
              typeof (m as { text?: unknown }).text === "string"
          )
        : undefined,
    };
  } catch {
    return null;
  }
}

export function setPartnerContextLocal(ctx: PartnerContext | null): void {
  if (!ctx?.partnerName) {
    localStorage.removeItem(PARTNER_CONTEXT_KEY);
    return;
  }
  localStorage.setItem(PARTNER_CONTEXT_KEY, JSON.stringify(ctx));
}

const AI_CHAT_PREFIX = "notsent_ai_chat_";

/** Retrieve persisted AI chat history for a specific contact. */
export function getContactAIChatHistory(contactId: string): AIChatMessage[] {
  try {
    const raw = localStorage.getItem(`${AI_CHAT_PREFIX}${contactId}`);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/** Persist AI chat history for a specific contact. */
export function setContactAIChatHistory(contactId: string, messages: AIChatMessage[]): void {
  localStorage.setItem(`${AI_CHAT_PREFIX}${contactId}`, JSON.stringify(messages));
}

/** Clear AI chat history for a specific contact. */
export function clearContactAIChatHistory(contactId: string): void {
  localStorage.removeItem(`${AI_CHAT_PREFIX}${contactId}`);
}

// ─── Per-contact profile (the editable "file" for each person) ──────────────

const CONTACT_PROFILE_PREFIX = "notsent_contact_profile_";

/** Get all stored context for a specific contact (breakup info + partner voice). */
export function getContactProfile(contactId: string): ContactProfile {
  try {
    const raw = localStorage.getItem(`${CONTACT_PROFILE_PREFIX}${contactId}`);
    if (!raw) return {};
    return JSON.parse(raw) as ContactProfile;
  } catch {
    return {};
  }
}

/** Save all context for a specific contact. */
export function setContactProfile(contactId: string, profile: ContactProfile): void {
  localStorage.setItem(
    `${CONTACT_PROFILE_PREFIX}${contactId}`,
    JSON.stringify({ ...profile, lastUpdated: Date.now() })
  );
}

/** Delete the profile for a contact (call when removing the contact). */
export function deleteContactProfile(contactId: string): void {
  localStorage.removeItem(`${CONTACT_PROFILE_PREFIX}${contactId}`);
}

// ─── Mood log ────────────────────────────────────────────────────────────────

const MOOD_LOG_KEY = "notsent_mood_log";

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export function getMoodLog(): MoodEntry[] {
  try {
    const raw = localStorage.getItem(MOOD_LOG_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as MoodEntry[];
  } catch {
    return [];
  }
}

export function logMood(score: number, note?: string, journal?: string): void {
  const log = getMoodLog();
  const today = todayDateString();
  const idx = log.findIndex((e) => e.date === today);
  const entry: MoodEntry = {
    date: today,
    score,
    ...(note !== undefined ? { note } : {}),
    ...(journal !== undefined ? { journal } : {}),
  };
  if (idx >= 0) {
    log[idx] = { ...log[idx], ...entry };
  } else {
    log.push(entry);
  }
  localStorage.setItem(MOOD_LOG_KEY, JSON.stringify(log));
}

export function getTodayEntry(): MoodEntry | null {
  return getMoodLog().find((e) => e.date === todayDateString()) ?? null;
}

export function getTodayMood(): number | null {
  return getTodayEntry()?.score ?? null;
}

// ─── No-contact date ─────────────────────────────────────────────────────────

const NO_CONTACT_SINCE_KEY = "notsent_no_contact_since";

/**
 * Get the ISO date string (YYYY-MM-DD) the user manually set as their
 * no-contact start date, or null if not set.
 */
export function getNoContactSince(): string | null {
  return localStorage.getItem(NO_CONTACT_SINCE_KEY);
}

/**
 * Save the no-contact start date as an ISO date string (YYYY-MM-DD).
 */
export function setNoContactSince(dateStr: string): void {
  localStorage.setItem(NO_CONTACT_SINCE_KEY, dateStr);
}

/**
 * Clear the no-contact start date (user wants to reset the counter).
 */
export function clearNoContactSince(): void {
  localStorage.removeItem(NO_CONTACT_SINCE_KEY);
}

// ─── Product mode ─────────────────────────────────────────────────────────────

export const PRODUCT_MODE_KEY = "notsent_product_mode";

export type ProductMode = "personal" | "enterprise";

export function getProductMode(): ProductMode | null {
  const val = localStorage.getItem(PRODUCT_MODE_KEY);
  if (val === "personal" || val === "enterprise") return val;
  return null;
}

export function setProductMode(mode: ProductMode): void {
  localStorage.setItem(PRODUCT_MODE_KEY, mode);
}

export function clearProductMode(): void {
  localStorage.removeItem(PRODUCT_MODE_KEY);
}

// ─── Remote: Contacts ─────────────────────────────────────────────────────────

export async function addFlaggedContactRemote(
  contact: Omit<FlaggedContact, "id" | "dateAdded">
): Promise<FlaggedContact> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("flagged_contacts")
    .insert({ user_id: session.user.id, name: contact.name, phone_number: contact.phoneNumber })
    .select()
    .single();
  if (error) throw error;
  const local: FlaggedContact = {
    id: data.id,
    name: data.name,
    phoneNumber: data.phone_number,
    dateAdded: new Date(data.date_added).getTime(),
  };
  // Keep localStorage in sync as cache
  const contacts = getFlaggedContacts();
  contacts.push(local);
  setFlaggedContacts(contacts);
  return local;
}

export async function getFlaggedContactsRemote(): Promise<FlaggedContact[]> {
  const { data, error } = await supabase
    .from("flagged_contacts")
    .select()
    .order("date_added", { ascending: true });
  if (error) throw error;
  const contacts = (data as Array<{ id: string; name: string; phone_number: string; date_added: string }>).map((row) => ({
    id: row.id,
    name: row.name,
    phoneNumber: row.phone_number,
    dateAdded: new Date(row.date_added).getTime(),
  }));
  // Sync cache
  setFlaggedContacts(contacts);
  return contacts;
}

export async function removeFlaggedContactRemote(id: string): Promise<void> {
  const { error } = await supabase.from("flagged_contacts").delete().eq("id", id);
  if (error) throw error;
  setFlaggedContacts(getFlaggedContacts().filter((c) => c.id !== id));
  deleteContactProfile(id);
}

// ─── Remote: Chat history ─────────────────────────────────────────────────────

export async function getContactAIChatHistoryRemote(contactId: string): Promise<AIChatMessage[]> {
  const { data, error } = await supabase
    .from("contact_ai_chat_history")
    .select("role, content")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as Array<{ role: "user" | "assistant"; content: string }>).map((row) => ({
    role: row.role,
    content: row.content,
  }));
}

export async function appendContactAIChatMessageRemote(
  contactId: string,
  msg: AIChatMessage
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  const { error } = await supabase.from("contact_ai_chat_history").insert({
    user_id: session.user.id,
    contact_id: contactId,
    role: msg.role,
    content: msg.content,
  });
  if (error) throw error;
}

export async function clearContactAIChatHistoryRemote(contactId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  await supabase
    .from("contact_ai_chat_history")
    .delete()
    .eq("contact_id", contactId)
    .eq("user_id", session.user.id);
}

// ─── Remote: Mood log ─────────────────────────────────────────────────────────

export async function logMoodRemote(score: number, note?: string, journal?: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  const today = new Date().toISOString().slice(0, 10);
  const payload: Record<string, unknown> = { user_id: session.user.id, date: today, score };
  if (note !== undefined) payload.note = note;
  if (journal !== undefined) payload.journal = journal;
  const { error } = await supabase
    .from("mood_log")
    .upsert(payload, { onConflict: "user_id,date" });
  if (error) throw error;
}

export async function getMoodLogRemote(): Promise<MoodEntry[]> {
  const { data, error } = await supabase
    .from("mood_log")
    .select("date, score, note, journal")
    .order("date", { ascending: true });
  if (error) throw error;
  return (data as Array<{ date: string; score: number; note?: string | null; journal?: string | null }>).map((row) => ({
    date: row.date,
    score: row.score,
    ...(row.note ? { note: row.note } : {}),
    ...(row.journal ? { journal: row.journal } : {}),
  }));
}

// ─── Remote: Contact profile ──────────────────────────────────────────────────

export async function getContactProfileRemote(contactId: string): Promise<ContactProfile> {
  const { data, error } = await supabase
    .from("partner_contexts")
    .select("sample_messages")
    .eq("contact_id", contactId)
    .maybeSingle();
  if (error || !data) return getContactProfile(contactId);
  // Merge remote sample_messages with local profile fields
  const local = getContactProfile(contactId);
  return { ...local, sampleMessages: data.sample_messages };
}

export async function setContactProfileRemote(
  contactId: string,
  profile: ContactProfile
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  const contact = getFlaggedContacts().find((c) => c.id === contactId);
  if (!contact) return;
  const { error } = await supabase.from("partner_contexts").upsert(
    {
      user_id: session.user.id,
      contact_id: contactId,
      partner_name: contact.name,
      sample_messages: profile.sampleMessages ?? [],
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,contact_id" }
  );
  if (error) throw error;
  // Keep localStorage as cache
  setContactProfile(contactId, profile);
}
