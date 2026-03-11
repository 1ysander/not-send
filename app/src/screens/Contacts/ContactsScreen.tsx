import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getFlaggedContacts,
  addFlaggedContact,
  removeFlaggedContact,
  deleteSessionsForContact,
} from "@/lib/storage";
import { PageLayout } from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, Trash2 } from "lucide-react";

function getInitial(name: string): string {
  const n = name.trim();
  return n ? n[0].toUpperCase() : "?";
}

export function ContactsScreen() {
  const [contacts, setContacts] = useState(getFlaggedContacts());
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const navigate = useNavigate();

  function refresh() {
    setContacts(getFlaggedContacts());
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName || !trimmedPhone) {
      setError("Name and phone number are required.");
      return;
    }
    addFlaggedContact({ name: trimmedName, phoneNumber: trimmedPhone });
    setName("");
    setPhone("");
    setShowForm(false);
    refresh();
  }

  function handleRemove(id: string) {
    deleteSessionsForContact(id);
    removeFlaggedContact(id);
    refresh();
  }

  return (
    <PageLayout
      title="Contacts"
      right={
        <Button
          variant={showForm ? "ghost" : "default"}
          size="sm"
          onClick={() => setShowForm((s) => !s)}
        >
          {showForm ? "Cancel" : "Add"}
        </Button>
      }
    >
      <p className="mb-6 text-sm text-muted-foreground">
        People NOTSENT protects you from texting. Add someone to start a thread in Chats.
      </p>

      {showForm && (
        <Card className="mb-8 rounded-xl shadow-card">
          <CardHeader>
            <CardTitle className="text-base">New contact</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="space-y-3">
              <Input
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
              <Input
                type="tel"
                placeholder="Phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
              />
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button type="submit" className="w-full">
                Add contact
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-xl shadow-card">
        <CardHeader>
          <CardTitle className="text-base">
            Flagged contacts ({contacts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm text-muted-foreground">No contacts yet.</p>
              <Button
                className="mt-3 gap-2"
                onClick={() => setShowForm(true)}
              >
                <UserPlus className="h-4 w-4" />
                Add your first contact
              </Button>
            </div>
          ) : (
            <ul className="space-y-1">
              {contacts.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-3"
                >
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                    {getInitial(c.name)}
                  </div>
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left hover:opacity-80"
                    onClick={() => navigate(`/chat/${c.id}`)}
                  >
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{c.phoneNumber}</p>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => handleRemove(c.id)}
                    aria-label="Remove contact"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  );
}
