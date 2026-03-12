import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { addFlaggedContact } from "@/lib/storage";
import { Button } from "@/components/ui/button";

export function AddContactScreen() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName || !trimmedPhone) {
      setError("Name and phone number are required.");
      return;
    }
    addFlaggedContact({ name: trimmedName, phoneNumber: trimmedPhone });
    navigate("/onboarding/set");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            NOTSENT
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Add your ex's contact
          </h1>
          <p className="text-sm text-muted-foreground">
            NOTSENT will protect you from impulse texting this person.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <input
              type="text"
              placeholder="Alex"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className="w-full h-10 rounded-lg bg-secondary border-0 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring/30 transition-shadow"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Phone number</label>
            <input
              type="tel"
              placeholder="+1 (555) 000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              className="w-full h-10 rounded-lg bg-secondary border-0 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring/30 transition-shadow"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" className="w-full h-11">
            Continue
          </Button>
        </form>
      </div>
    </div>
  );
}
