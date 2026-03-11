import type { FlaggedContact, LocalSession, UserContext, PartnerContext } from "../types";

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

export function updateLocalSessionOutcome(id: string, outcome: "intercepted" | "sent"): void {
  const sessions = getSessions();
  const idx = sessions.findIndex((s) => s.id === id);
  if (idx >= 0) {
    sessions[idx].outcome = outcome;
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  }
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
