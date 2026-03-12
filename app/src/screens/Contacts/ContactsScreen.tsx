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
import { Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

function getInitial(name: string): string {
  const n = name.trim();
  return n ? n[0].toUpperCase() : "?";
}

export function ContactsScreen() {
  const [contacts, setContacts] = useState(getFlaggedContacts());
  const [name, setName]         = useState("");
  const [phone, setPhone]       = useState("");
  const [error, setError]       = useState("");
  const [showForm, setShowForm] = useState(false);
  const navigate                = useNavigate();

  function refresh() {
    setContacts(getFlaggedContacts());
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const trimmedName  = name.trim();
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
          variant={showForm ? "ghost" : "secondary"}
          size="sm"
          className="h-8 gap-1.5 text-[13px]"
          onClick={() => setShowForm((s) => !s)}
        >
          {showForm ? (
            <>
              <X className="h-3.5 w-3.5" />
              Cancel
            </>
          ) : (
            <>
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              Add
            </>
          )}
        </Button>
      }
    >
      <p className="text-[14px] text-muted-foreground -mt-1">
        People NOTSENT protects you from texting impulsively.
      </p>

      {/* ── Add form ── */}
      {showForm && (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-sm animate-scale-in">
          <p className="text-[14px] font-semibold text-foreground">New contact</p>
          <form onSubmit={handleAdd} className="space-y-2.5">
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className="w-full h-11 rounded-xl bg-secondary border-0 px-4 text-[15px] text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-[#bf5af2]/30 transition-shadow"
            />
            <input
              type="tel"
              placeholder="Phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              className="w-full h-11 rounded-xl bg-secondary border-0 px-4 text-[15px] text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-[#bf5af2]/30 transition-shadow"
            />
            {error && <p className="text-[13px] text-destructive">{error}</p>}
            <Button type="submit" size="default" className="w-full">
              Add contact
            </Button>
          </form>
        </div>
      )}

      {/* ── List ── */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground mb-2 px-1">
          Protected ({contacts.length})
        </p>

        {contacts.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card flex flex-col items-center justify-center py-12 text-center px-4 shadow-sm">
            <p className="text-[14px] text-muted-foreground mb-3">No contacts yet.</p>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => setShowForm(true)}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              Add first contact
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border/60 shadow-sm">
            {contacts.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3.5">
                <div className={cn(
                  "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[15px] font-semibold",
                  "bg-[#bf5af2]/15 text-[#bf5af2]"
                )}>
                  {getInitial(c.name)}
                </div>
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => navigate(`/chat/${c.id}`)}
                >
                  <p className="text-[15px] font-medium text-foreground truncate">{c.name}</p>
                  <p className="text-[13px] text-muted-foreground truncate">{c.phoneNumber}</p>
                </button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-destructive flex-shrink-0"
                  onClick={() => handleRemove(c.id)}
                  aria-label="Remove contact"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
