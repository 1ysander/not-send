import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { addFlaggedContact } from "@/lib/storage";
import { Button } from "@/components/ui/button";

export function AddContactScreen() {
  const [name, setName]   = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const navigate          = useNavigate();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const trimmedName  = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName || !trimmedPhone) {
      setError("Both fields are required.");
      return;
    }
    addFlaggedContact({ name: trimmedName, phoneNumber: trimmedPhone });
    navigate("/onboarding/set");
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-6 overflow-hidden">
      {/* Ambient glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-[#bf5af2]/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm animate-fade-up space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            NOTSENT
          </p>
          <h1 className="text-[28px] font-bold tracking-tight text-foreground leading-tight">
            Who are you trying<br />not to text?
          </h1>
          <p className="text-[15px] text-muted-foreground leading-relaxed">
            NOTSENT intercepts before you send and gives you space to think.
          </p>
        </div>

        {/* Form card */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-border/60 bg-card shadow-md overflow-hidden"
        >
          <div className="p-5 space-y-3">
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                Their name
              </label>
              <input
                type="text"
                placeholder="Alex"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                className="w-full h-12 rounded-xl bg-secondary border-0 px-4 text-[15px] text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-[#bf5af2]/40 transition-shadow"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                Phone number
              </label>
              <input
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                className="w-full h-12 rounded-xl bg-secondary border-0 px-4 text-[15px] text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-[#bf5af2]/40 transition-shadow"
              />
            </div>
            {error && (
              <p className="text-[13px] text-destructive">{error}</p>
            )}
          </div>

          <div className="border-t border-border px-5 py-4">
            <Button type="submit" size="default" className="w-full">
              Continue
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
