import { useMemo, useState, useCallback, useEffect } from "react";
import {
  getFlaggedContacts,
  getSessionsForContact,
  type FlaggedContact,
} from "@/lib/storage";
import type { LocalSession } from "@/types";

export interface ConversationItem {
  contact: FlaggedContact;
  sessions: LocalSession[];
  lastSession: LocalSession | null;
  preview: string;
}

/**
 * Hook: list of conversations (contacts + their sessions) for Inbox/Compose.
 * Does not change existing API behavior.
 */
export function useConversations(): {
  conversations: ConversationItem[];
  refresh: () => void;
} {
  const [contacts, setContacts] = useState<FlaggedContact[]>(() => getFlaggedContacts());

  useEffect(() => {
    setContacts(getFlaggedContacts());
  }, []);

  const refresh = useCallback(() => {
    setContacts(getFlaggedContacts());
  }, []);

  const conversations = useMemo<ConversationItem[]>(() => {
    return contacts.map((contact) => {
      const sessions = getSessionsForContact(contact.id);
      const sorted = [...sessions].sort((a, b) => b.timestamp - a.timestamp);
      const lastSession = sorted[0] ?? null;
      const preview =
        lastSession?.messageAttempted?.slice(0, 40) ?? "No messages yet";
      return {
        contact,
        sessions,
        lastSession,
        preview: lastSession && lastSession.messageAttempted.length > 40 ? preview + "…" : preview,
      };
    });
  }, [contacts]);

  return { conversations, refresh };
}
