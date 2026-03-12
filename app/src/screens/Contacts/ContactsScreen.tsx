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
          variant={showForm ? "ghost" : "outline"}
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => setShowForm((s) => !s)}
        >
          {showForm ? "Cancel" : (
            <>
              <UserPlus className="h-3.5 w-3.5" />
              Add
            </>
          )}
        </Button>
      }
    >
      <p className="text-sm text-muted-foreground -mt-1">
        People NOTSENT protects you from texting impulsively.
      </p>

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">New contact</p>
          <form onSubmit={handleAdd} className="space-y-2">
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className="w-full h-10 rounded-lg bg-secondary border-0 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring/30 transition-shadow"
            />
            <input
              type="tel"
              placeholder="Phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              className="w-full h-10 rounded-lg bg-secondary border-0 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring/30 transition-shadow"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button type="submit" className="w-full h-10">
              Add contact
            </Button>
          </form>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 px-1">
          Flagged ({contacts.length})
        </p>
        {contacts.length === 0 ? (
          <div className="rounded-xl border border-border bg-card flex flex-col items-center justify-center py-10 text-center px-4">
            <p className="text-sm text-muted-foreground mb-3">No contacts yet.</p>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => setShowForm(true)}
            >
              <UserPlus className="h-3.5 w-3.5" />
              Add first contact
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
            {contacts.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-foreground">
                  {getInitial(c.name)}
                </div>
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => navigate(`/chat/${c.id}`)}
                >
                  <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.phoneNumber}</p>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                  onClick={() => handleRemove(c.id)}
                  aria-label="Remove contact"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
