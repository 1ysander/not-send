# WEBSITE Agent — NOTSENT Marketing Site

> Load with: `CLAUDE.md` + `BUILDPLAN.md` + this file.
> Domain: `website/` directory only. Never touch `app/` or `backend/`.

---

## Your job

Build the marketing website for NOTSENT. This is a separate product from the app. It lives at the apex domain. The app lives at a subdomain.

This website must be exceptional. It is the first thing investors, press, and potential users see. Treat it like a product, not a docs site.

---

## Tech stack

```
website/
  index.html
  package.json
  vite.config.ts
  tailwind.config.ts
  src/
    main.ts
    styles/
      base.css          ← Tailwind directives + custom CSS variables
    components/
      Nav.ts            ← sticky nav
      Footer.ts         ← links, legal
    sections/
      Hero.ts
      HowItWorks.ts
      ForWho.ts
      TheAI.ts
      Enterprise.ts
```

Dependencies:
- Vite + TypeScript
- Tailwind CSS (full custom config — do not use defaults)
- GSAP for scroll animations (preferred) OR Framer Motion if React is used
- Fontsource or direct Google Fonts import

**React is optional.** If sections are simple enough, vanilla TypeScript + Tailwind is fine. If you use React, keep it lightweight — no routing, no state management library. One root component, sections as children.

---

## Design system

### Color palette

```css
:root {
  --bg:          #080808;
  --bg-card:     #111111;
  --border:      rgba(255, 255, 255, 0.07);
  --brand:       #bf5af2;
  --brand-dim:   rgba(191, 90, 242, 0.12);
  --text:        #f0f0f0;
  --text-muted:  #5a5a5a;
  --green:       #30d158;
}
```

### Typography

```css
/* Headline font: editorial, high contrast */
font-family: 'Geist', 'Inter', system-ui, sans-serif;

/* Headlines */
h1 { font-size: clamp(2.5rem, 6vw, 5rem); font-weight: 600; line-height: 1.1; letter-spacing: -0.02em; }
h2 { font-size: clamp(1.8rem, 4vw, 3rem); font-weight: 600; line-height: 1.2; }

/* Body */
p { font-size: 1rem; line-height: 1.7; color: var(--text-muted); }
```

### Motion principles

- Fade-in + subtle upward translate on scroll enter (20px, 0.6s, ease-out)
- Stagger children when multiple elements enter at once
- No bounce, no spring physics — this is not a playful product
- Parallax only on the hero background element, 0.3x scroll speed

---

## Sections — detailed spec

### 1. Hero

**Goal:** Immediately communicate what this is and why it matters. One CTA.

```
Background: near-black (#080808)
Subtle texture or grain overlay (CSS noise filter or SVG)

Center-aligned:

  [Pill badge] "Powered by Claude — Anthropic's AI"

  H1:
    "You know you shouldn't
     text them."

  Subheadline:
    "NOTSENT steps in before you do.
     Upload your conversation. Let the AI help you hold back."

  CTA button: "Start for free" → links to app subdomain

  Below CTA (small muted text):
    "No messages stored. No account required to try."

Decorative element below:
  Mockup of the chat intercept UI (real screenshot or illustrated component)
  Faded at the bottom into the background
```

### 2. How it works

**Goal:** Three steps, scannable, visual.

```
Section headline: "Three things it does."

Step 1 — Upload
  Icon: upload arrow
  "Export your iMessage chat with them from your iPhone. NOTSENT reads it. Now the AI knows them."

Step 2 — Intercept
  Icon: shield
  "Type what you were going to send. NOTSENT steps in. You decide if it goes."

Step 3 — Move on
  Icon: heart (fading, not broken)
  "Talk to the AI version of them for closure. Or just talk to someone who gets it."

Layout: horizontal on desktop, vertical on mobile
Each step: number (large, muted, background), icon, title, description
```

### 3. For who

**Goal:** Emotional resonance. Make the reader feel seen.

```
Section headline: "You already know if this is for you."

Three scenarios (cards or inline):

  "It's 2am and you've typed their name in the search bar."
  "You've drafted the text seven times and deleted it six."
  "You want to reach out but know you'll regret it tomorrow."

End with:
  "NOTSENT is for when you know what you should do, but can't."

Visual: could be a subtle typographic treatment, almost like diary entries
```

### 4. The AI

**Goal:** Build trust. Explain what the AI actually does, without jargon.

```
Section headline: "The AI reads what you actually said to each other."

Body:
  "Not generic advice. Not a journaling prompt.

   You upload your real conversation. NOTSENT learns how they write,
   what you talked about, what set you off. When you're about to send
   something, it knows the context — because it read it.

   When you want closure, it plays their voice — built from their actual messages.
   Not fake. Not random. Trained on them."

Side element: subtle animation or illustration of message bubbles → AI parsing → response
```

### 5. Enterprise teaser

**Goal:** Signal that there's a B2B product coming. Capture interest.

```
Small section, dark card against slightly lighter background:

  Icon: building or shield-check
  Headline: "For teams."
  Body: "Compliance scanning for outbound messages. Flag legal liability, hostile tone, data leakage — before anything gets sent."
  CTA: "Join enterprise waitlist" → email capture form (inline, no navigation)
```

### 6. Footer

```
Left: NOTSENT wordmark
Center: Links — App, Privacy, Terms, Contact
Right: "Built with Anthropic's Claude"

Bottom line: "© 2025 NOTSENT. Nothing you upload is stored on our servers."
```

---

## Animation implementation (GSAP)

```ts
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);

// Fade-up on scroll enter — apply to all section children
function initScrollAnimations() {
  gsap.utils.toArray<HTMLElement>(".animate-on-scroll").forEach((el) => {
    gsap.fromTo(
      el,
      { opacity: 0, y: 24 },
      {
        opacity: 1,
        y: 0,
        duration: 0.7,
        ease: "power2.out",
        scrollTrigger: {
          trigger: el,
          start: "top 88%",
          once: true,
        },
      }
    );
  });
}
```

---

## Performance requirements

- Lighthouse score ≥ 95 on all four metrics
- Hero LCP < 1.5s
- No layout shift (CLS = 0) — pre-set all image/video dimensions
- No render-blocking fonts — use `font-display: swap` or Fontsource
- Total JS bundle < 100kb gzipped (no heavy libraries unless justified)

---

## Deployment

- Vercel, apex domain
- See `VERCEL.md` for config
- Separate from the app deployment — different Vercel project or `vercel.json` with `builds` array

---

## What you must NOT do

- Do not import anything from `app/` or `backend/`
- Do not use `react-router` — this is a static site
- Do not use default Tailwind colors — always reference custom design tokens
- Do not use stock photos or emoji as primary visuals
- Do not write lorem ipsum — every word of copy must be real, emotionally considered copy
