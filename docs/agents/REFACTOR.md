# REFACTOR Agent — NOTSENT Code Cleanup

> Load this file when cleaning up, consolidating, or removing dead code. Read `CLAUDE.md` first.

---

## Dead code to delete immediately

These files exist but are never imported by live code. Delete them without hesitation.

### Backend root-level dead code

| File/Dir | Why dead | Action |
|---|---|---|
| `backend/server.js` | Superseded by `backend/src/index.ts` | Delete |
| `backend/server.ts` | Same — superseded | Delete |
| `backend/connectors/email.ts` | Top-level connectors not in `src/` | Delete |
| `backend/connectors/imessage.ts` | Same | Delete |
| `backend/connectors/slack.ts` | Same | Delete |
| `backend/engine/conversationEngine.ts` | Top-level engine not in `src/` | Delete |
| `backend/engine/riskAnalysis.ts` | Same | Delete |
| `backend/engine/sendController.ts` | Same | Delete |

After deleting, verify `backend/src/index.ts` still starts cleanly.

### Frontend dead code

| File/Dir | Why dead | Action |
|---|---|---|
| `app/src/pages/Compose.tsx` | Screens use `screens/`, not `pages/` | Delete |
| `app/src/pages/Inbox.tsx` | Same | Delete |
| `app/src/pages/Review.tsx` | Same | Delete |
| `app/src/core/` (entire dir) | Transport layer — not wired in App.tsx | Confirm unused → delete |
| `app/src/adapters/webTransport.ts` | Same | Confirm unused → delete |
| `app/src/components/MainLayout.tsx` | Check if used — if not, delete |
| `app/src/components/PageLayout.tsx` | Check if used — if not, delete |
| `app/src/components/TabNav.tsx` | AppShell handles tabs — check if used |
| `app/src/components/TabNavIcons.tsx` | Same |
| `app/src/components/Container.tsx` | Check if used — shadcn replaces ad-hoc containers |
| `app/src/components/AppBarActions.tsx` | Check if used |
| `app/src/components/layout/Container.tsx` | Duplicate of above? Check |
| `app/src/components/layout/Navbar.tsx` | Check if used |

**How to confirm unused:** `grep -r "import.*[ComponentName]" app/src` — if zero results outside the file itself, delete.

---

## Consolidation targets

### 1. Duplicate type definitions

`UserContext` is defined in both `app/src/types.ts` and `backend/src/types.ts` with slight differences. They should diverge intentionally (backend doesn't need `noContactDays` in some paths) but must be synchronized.

Action:
- Audit what fields each side actually uses
- Sync field names (frontend has `noContactDays`, backend does not — add to backend)
- Add `conversationContext` to backend `UserContext` type

### 2. API calls scattered in screens

Any `fetch()` call outside `app/src/api.ts` is a violation. Audit:

```bash
grep -r "fetch(" app/src/screens
grep -r "fetch(" app/src/components
```

Move all found calls to `api.ts` as named functions.

### 3. Multiple CLAUDE.md / architecture docs

`app/ARCHITECTURE.md` and `docs/ARCHITECTURE.md` are now superseded by `CLAUDE.md` at the root and `docs/agents/`. After agents are set up:
- Archive (or delete) `app/ARCHITECTURE.md`
- Archive (or delete) `docs/ARCHITECTURE.md`
- The root `CLAUDE.md` is the single source of truth

### 4. Backend package.json scripts

`backend/package.json` may still reference `server.js` as the start script. Update to:
```json
"scripts": {
  "dev": "tsx watch src/index.ts",
  "start": "node --loader ts-node/esm src/index.ts",
  "build": "tsc"
}
```

---

## Code quality rules (enforce on all new + touched code)

### TypeScript

- No `any` — use `unknown` and narrow, or define a proper type
- No non-null assertions (`!`) unless the value is provably non-null from context
- No `@ts-ignore` — fix the type instead
- All function parameters and return values typed explicitly

### React

- No class components — hooks and functions only
- No `useEffect` with empty dependency array that sets state — use `useMemo` or derive
- No direct DOM manipulation — use React state and refs
- No prop drilling more than 2 levels — use context or co-locate state

### Naming

- No abbreviations in variable/function names (`msg` → `message`, `ctx` → `context`)
- Boolean variables start with `is`, `has`, `should` (`isLoading`, `hasError`)
- Handler functions start with `handle` (`handleSend`, `handleClose`)
- Event props start with `on` (`onSend`, `onClose`)

### Files

- No file longer than 300 lines — split into helpers or sub-components
- No component that does API calls AND renders UI AND manages its own storage — separate concerns
- One exported thing per file (default export = component, named exports = helpers/types)

### Backend

- No route handler longer than 40 lines — extract to engine functions
- No business logic in `index.ts` — only middleware, route mounting
- No hardcoded strings for outcomes, roles, or event names — use constants or enums

---

## Performance quick wins

1. **localStorage reads on every render**: wrap `getFlaggedContacts()` and `getSessions()` in `useMemo` or read once in effect — don't call in render body
2. **Unthrottled socket events**: `conversation_update` may fire per token — debounce or batch before re-rendering conversation list
3. **SSE connection leak**: ensure `InterventionChat` and `AIChatScreen` cancel the fetch/reader on unmount using `AbortController`
4. **Vite bundle size**: run `npx vite-bundle-visualizer` — if bundle > 400kb gzipped, code-split lazy screens

---

## Refactor checklist (in order)

- [ ] Delete all dead backend root files (`server.js`, `server.ts`, top-level `connectors/`, top-level `engine/`)
- [ ] Delete `app/src/pages/`
- [ ] Audit and delete unused components in `app/src/components/` (non-ui/)
- [ ] Confirm `app/src/core/` and `app/src/adapters/` are unused → delete
- [ ] Sync `UserContext` type between frontend and backend
- [ ] Audit for any `fetch()` outside `api.ts` → move to `api.ts`
- [ ] Fix any `any` types found in screens or routes
- [ ] Update `backend/package.json` start script to point to `src/index.ts`
- [ ] Archive old architecture docs
