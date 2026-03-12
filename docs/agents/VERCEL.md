# VERCEL Agent — NOTSENT Frontend Deployment

> **Start here every session:** Read `CLAUDE.md` first, then this file. You handle the `app/` deployment only. The backend goes to Railway/Render — NOT Vercel.

---

## What you own

You own the deployment pipeline for `app/` (the React + Vite SPA) to Vercel. You do NOT touch `backend/` deployment. Never deploy backend code to Vercel serverless functions — the Express app with SSE streaming is incompatible with Vercel's function timeout limits.

---

## One-time Vercel project setup (do this first if not done)

```bash
# Install Vercel CLI globally
npm install -g vercel

# From the app/ directory — link to Vercel project
cd /Users/lysanderelgar/Breakupfix/app
vercel link

# When prompted:
# - Set up and deploy? → Yes
# - Which scope? → your account
# - Link to existing project? → No (first time) / Yes (re-linking)
# - Project name? → notsent-app
# - In which directory is your code? → . (current, which is app/)
```

---

## vercel.json (place this at `app/vercel.json`)

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

The `rewrites` rule is mandatory — without it, React Router deep links (e.g. `/intervention`, `/settings`) return 404 on hard refresh.

---

## Environment variables in Vercel

Set these in the Vercel dashboard → Project → Settings → Environment Variables.
**Never hardcode these in any file. Never commit `.env` files.**

| Variable | Value | Environment |
|---|---|---|
| `VITE_API_URL` | `https://your-backend.railway.app` | Production |
| `VITE_API_URL` | `http://localhost:3001` | Development (not needed — Vercel dev auto-uses local) |
| `VITE_GOOGLE_CLIENT_ID` | Your Google OAuth client ID | Production + Preview |
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` | Production + Preview |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key | Production + Preview |

**After setting any env var in the dashboard, redeploy for it to take effect.**

To set via CLI instead:
```bash
vercel env add VITE_API_URL production
# Paste value when prompted
```

---

## Deploy commands

```bash
# Deploy preview (test before going live)
cd app && vercel

# Deploy to production
cd app && vercel --prod

# Check deployment status
vercel ls

# View logs for latest deployment
vercel logs <deployment-url>

# Rollback to previous deployment
vercel rollback
```

---

## GitHub → Vercel auto-deploy (set this up once)

1. Vercel dashboard → Project → Settings → Git
2. Connect to GitHub repo: `1ysander/Breakupfix`
3. Root directory: `app` ← critical, set this explicitly
4. Set:
   - Build command: `npm run build`
   - Output directory: `dist`
   - Install command: `npm install`
5. Enable: Deploy on push to `main`
6. Optional: Enable preview deployments for all branches

After setup, every `git push` to `main` triggers a production deploy automatically.

---

## Local Vercel dev (mirrors production exactly)

```bash
cd app && vercel dev
# Runs at http://localhost:3000 with Vercel's build pipeline
# Use this to catch Vercel-specific issues before deploying
```

---

## Custom domain setup

1. Vercel dashboard → Project → Settings → Domains
2. Add domain: `notsent.app` (or whatever domain you own)
3. Copy the DNS records Vercel gives you
4. In your domain registrar: add those DNS records (CNAME or A record)
5. Vercel auto-provisions SSL — takes ~5 minutes

---

## Build troubleshooting

### Build fails with TypeScript errors

```bash
# Run locally first to catch errors before deploying
cd app && npm run build
# Fix all TS errors before pushing — Vercel will fail on the same errors
```

### Build succeeds but app is blank

Check:
1. `VITE_API_URL` is set correctly in Vercel env vars
2. The backend is actually running and accessible from the internet
3. CORS on the backend allows the Vercel domain:

```ts
// backend/src/index.ts — add Vercel domain to allowed origins
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://notsent-app.vercel.app",   // Vercel preview URL
  "https://notsent.app",              // custom domain (if set)
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) callback(null, true);
    else callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
```

### React Router 404 on refresh

Make sure `app/vercel.json` exists with the `rewrites` rule above. Without it, `/intervention` returns Vercel's 404.

### SSE streaming not working in production

Vercel's Edge Network buffers responses. Add these headers to every SSE endpoint in the backend:

```ts
res.setHeader("Content-Type", "text/event-stream");
res.setHeader("Cache-Control", "no-cache, no-transform");  // no-transform is critical
res.setHeader("Connection", "keep-alive");
res.setHeader("X-Accel-Buffering", "no");  // disables Nginx buffering upstream
res.flushHeaders();
```

Note: this is a backend fix, not a Vercel fix. SSE buffering happens at the backend host (Railway/Render).

---

## Preview deployments

Every push to a non-main branch creates a preview URL. Use this for:
- Testing a feature before merging to main
- Sharing a live demo with stakeholders without touching production

Preview URLs follow the pattern: `notsent-app-<hash>.vercel.app`

Preview deployments use the same env vars as production unless you set branch-specific overrides in the Vercel dashboard.

---

## Production deploy checklist

Before running `vercel --prod`:

- [ ] `npm run build` passes locally with zero errors
- [ ] `VITE_API_URL` points to live backend (not localhost)
- [ ] `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in Vercel dashboard
- [ ] Backend is deployed and `/health` returns 200
- [ ] CORS on backend includes the Vercel domain
- [ ] `app/vercel.json` exists with `rewrites` rule
- [ ] No `.env` files are committed to git

---

## What NOT to do

- **Do not deploy `backend/` to Vercel** — SSE streaming + in-process Socket.io will not work in serverless functions
- **Do not put `SUPABASE_SERVICE_KEY` or `ANTHROPIC_API_KEY` in any Vercel env var** — those are backend-only secrets
- **Do not run `vercel` from the repo root** — always run from `app/`
- **Do not change `vite.config.ts` build output path** — Vercel expects `dist/`
