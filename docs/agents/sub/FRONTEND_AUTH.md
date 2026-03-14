# FRONTEND_AUTH Sub-Agent

> Load with: `CLAUDE.md` + `BUILDPLAN.md` + `FRONTEND.md` + this file.
> Domain: authentication UI, product routing, Google OAuth flow.

---

## What you own

```
app/src/screens/Login/LoginScreen.tsx     ← full redesign needed
app/src/context/AuthContext.tsx           ← read-only unless auth logic changes
app/src/lib/storage.ts                    ← add notsent_product_mode key
app/src/App.tsx                           ← routing guards, do not break existing routes
```

---

## The login screen redesign

### Goal

Replace the current basic login screen with a **product-selection + OAuth** screen.

The user picks their path first, then authenticates. Two paths:
- **Personal** — breakup intervention app
- **Enterprise** — compliance scanning (waitlist for now)

### Layout spec

```tsx
// Full-page, dark background, centered content
<div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">

  {/* Logo */}
  <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-12">
    NOTSENT
  </p>

  {/* Headline */}
  <h1 className="text-[32px] font-semibold text-foreground text-center mb-2 leading-tight">
    What are you protecting?
  </h1>
  <p className="text-[15px] text-muted-foreground text-center mb-10 max-w-[340px]">
    Choose your path. Both are private, both are confidential.
  </p>

  {/* Two product cards */}
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-xl">
    <PersonalCard />
    <EnterpriseCard />
  </div>

  {/* Legal footer */}
  <p className="text-[12px] text-muted-foreground text-center mt-10 max-w-[300px]">
    We never store your messages. Your conversations stay on your device.
  </p>
</div>
```

### Personal card

```tsx
<button
  onClick={handlePersonalLogin}
  className="group flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 text-left hover:border-[#bf5af2]/40 hover:bg-[#bf5af2]/5 transition-all"
>
  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#bf5af2]/15">
    <HeartCrack className="h-6 w-6 text-[#bf5af2]" />
  </div>
  <div>
    <p className="text-[17px] font-semibold text-foreground mb-1">Personal</p>
    <p className="text-[13px] text-muted-foreground leading-relaxed">
      Stop texting them. AI intercepts your messages, gives you closure, and helps you move on.
    </p>
  </div>
  <div className="flex items-center gap-2 mt-auto pt-2 text-[13px] font-medium text-foreground group-hover:text-[#bf5af2] transition-colors">
    <GoogleIcon className="h-4 w-4" />
    Continue with Google
  </div>
</button>
```

### Enterprise card

```tsx
<button
  onClick={handleEnterpriseWaitlist}
  className="group flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 text-left hover:border-white/20 hover:bg-white/[0.02] transition-all opacity-80 hover:opacity-100"
>
  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
    <Building2 className="h-6 w-6 text-muted-foreground" />
  </div>
  <div>
    <p className="text-[17px] font-semibold text-foreground mb-1">Enterprise</p>
    <p className="text-[13px] text-muted-foreground leading-relaxed">
      Scan outbound messages for legal liability, harassment, GDPR violations, and tone issues — before they send.
    </p>
  </div>
  <div className="flex items-center gap-2 mt-auto pt-2">
    <span className="text-[13px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
      Join waitlist
    </span>
    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
      Coming soon
    </span>
  </div>
</button>
```

---

## Authentication logic

### Google OAuth (Personal path)

```tsx
async function handlePersonalLogin() {
  setLoading(true);
  try {
    // Store intended product mode before OAuth redirect
    localStorage.setItem("notsent_product_mode", "personal");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    if (error) throw error;
  } catch (err) {
    setError(err instanceof Error ? err.message : "Sign in failed");
    setLoading(false);
  }
}
```

### Enterprise waitlist (no OAuth yet)

```tsx
// Show a simple email capture inline — no navigation away
const [enterpriseEmail, setEnterpriseEmail] = useState("");
const [enterpriseSubmitted, setEnterpriseSubmitted] = useState(false);

async function handleEnterpriseWaitlist() {
  // Toggle inline email form inside the Enterprise card
  setShowEnterpriseForm(true);
}

async function submitWaitlist(email: string) {
  // POST to a simple serverless function or just store locally for now
  // For MVP: just show a success state
  setEnterpriseSubmitted(true);
}
```

---

## Storage key

Add to `app/src/lib/storage.ts`:

```ts
// Product mode — set on login, read by AuthGuard
export const PRODUCT_MODE_KEY = "notsent_product_mode";

export type ProductMode = "personal" | "enterprise";

export function getProductMode(): ProductMode {
  return (localStorage.getItem(PRODUCT_MODE_KEY) as ProductMode) ?? "personal";
}

export function setProductMode(mode: ProductMode): void {
  localStorage.setItem(PRODUCT_MODE_KEY, mode);
}
```

---

## Routing after login

In `App.tsx`, the `AuthGuard` already handles the redirect. After OAuth completes:
- Product mode is read from localStorage
- `personal` → existing flow → onboarding check → `/`
- `enterprise` → future enterprise route (placeholder for now)

Do NOT restructure the existing `AuthGuard` — it works. Only add product mode reading after auth succeeds.

---

## Design constraints for auth screens

- Dark background always (`bg-background` = `#0a0a0a`)
- Never show tab bar on `/login` or `/onboarding`
- Cards use `rounded-2xl`, `border-border`, `bg-card`
- Hover states: Personal card → purple tint (`#bf5af2/5`), Enterprise card → white/2%
- Loading state: disable both cards + show spinner on the active one
- Error state: small `text-destructive` text below the cards

---

## Files NOT to touch

- `context/AuthContext.tsx` — read it, don't modify it unless auth logic genuinely needs to change
- `lib/supabase.ts` — already configured, do not recreate the client
- Any screen outside `screens/Login/` and `App.tsx` routing guards
