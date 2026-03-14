import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  getFlaggedContacts,
  getSessionsForContact,
  deleteSessionsForContact,
  clearAllSessions,
} from "@/lib/storage";
import { PageLayout } from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ContactAvatar } from "@/components/ContactAvatar";

export function ManageConversationsScreen() {
  const [contacts, setContacts] = useState(getFlaggedContacts());
  const [confirmClearContact, setConfirmClearContact] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const contactStats = useMemo(
    () =>
      contacts.map((contact) => {
        const sessions = getSessionsForContact(contact.id);
        const sorted = [...sessions].sort((a, b) => b.timestamp - a.timestamp);
        return { contact, sessions, recent: sorted.slice(0, 5) };
      }),
    [contacts],
  );

  const totalSessions = useMemo(() => contactStats.reduce((n, c) => n + c.sessions.length, 0), [contactStats]);

  function handleClearContact(contactId: string) {
    deleteSessionsForContact(contactId);
    setConfirmClearContact(null);
    setContacts(getFlaggedContacts());
  }

  function handleClearAll() {
    clearAllSessions();
    setConfirmClearAll(false);
    setContacts(getFlaggedContacts());
  }

  return (
    <PageLayout title="Inbox">
      {contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground">No conversations yet.</p>
          <p className="mt-2 text-sm text-muted-foreground">Add a contact in Contacts, then start a thread in Chats to see history here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {contactStats.map(({ contact, sessions, recent }) => (
            <Card key={contact.id} className="rounded-xl shadow-card">
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link to={`/chat/${contact.id}`} className="flex min-w-0 items-center gap-3 text-foreground no-underline hover:opacity-80">
                    <ContactAvatar contact={contact} size="md" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{contact.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {sessions.length} conversation{sessions.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </Link>
                  {sessions.length > 0 && (
                    confirmClearContact === contact.id ? (
                      <span className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Clear all?</span>
                        <Button variant="destructive" size="sm" onClick={() => handleClearContact(contact.id)}>Yes, clear</Button>
                        <Button variant="ghost" size="sm" onClick={() => setConfirmClearContact(null)}>Cancel</Button>
                      </span>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => setConfirmClearContact(contact.id)}>Clear</Button>
                    )
                  )}
                </div>
                {recent.length > 0 && (
                  <ul className="mt-3 list-inside list-disc space-y-0.5 text-sm text-muted-foreground">
                    {recent.map((s) => (
                      <li key={s.id}>"{s.messageAttempted.length > 50 ? s.messageAttempted.slice(0, 50) + "…" : s.messageAttempted}"</li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))}
          {totalSessions > 0 && (
            <Card>
              <CardContent className="p-4">
                <p className="mb-3 text-sm text-muted-foreground">Clear all conversation history for every contact. This cannot be undone.</p>
                {confirmClearAll ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <Button variant="destructive" size="sm" onClick={handleClearAll}>Yes, clear all</Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmClearAll(false)}>Cancel</Button>
                  </span>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setConfirmClearAll(true)}>Clear all conversations</Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </PageLayout>
  );
}
