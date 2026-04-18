# CLAUDE.md — RPOS Persistent Knowledge Base

> **Read this file at the start of every session before touching any code.**
> Also read: `DECISIONS.md`, `INVARIANTS.md`, `CURRENT_WORK.md`

---

## Project Overview

**RPOS** — Restaurant OS. A multi-tenant, multi-device SaaS POS system for hospitality.
Live at: https://possystem-liard.vercel.app  
GitHub: pwar2804aio/possystem  
Current version: see `src/lib/version.js` (currently ~v4.0.7)

Operators access three layers:
1. **POS Surface** (`?mode=pos`) — front-of-house terminal for taking orders
2. **Back Office** (`?mode=office`) — menu management, floor plan, reports, config
3. **KDS / Bar / Kiosk / Orders** — specialist surfaces for kitchen/bar/self-service

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI | React 19 + Vite 8 (no TypeScript) |
| State | Zustand 5 (single store in `src/store/index.js`) |
| Database | Supabase (Postgres + Realtime + Storage) |
| Auth | Supabase Auth (back office) + device pairing (POS) |
| Deploy | Vercel (frontend) + Vercel serverless (AI API) |
| Print | Node.js print agents (`print-agent.js`, `print-bridge.js`) |
| Mobile | Android wrapper in `android/` |
| PWA | `public/manifest.json` + `public/sw.js` |

**No test framework. No TypeScript. No SSR.**

---

## Folder Structure

```
src/
  App.jsx            — Root router, surface switcher, CHANGELOG array, version display
  main.jsx           — React entry point, ErrorBoundary
  store/index.js     — Single Zustand store; also contains sbUpsertCategory + other direct DB writers
  lib/
    supabase.js      — Two Supabase clients (ops + platform); getLocationId(); isMock sentinel
    db.js            — Data access layer (upsertMenuItem, upsertMenuCategory, etc.)
    version.js       — Single source of truth for version string (update on every deploy)
    aiTools.js       — AI assistant tool definitions
    tax.js           — Tax calculation logic
    serviceCharge.js — Service charge logic
    printer.js       — ESC/POS print formatting
  surfaces/
    POSSurface.jsx   — Main POS UI (largest surface)
    BarSurface.jsx   — Bar tabs surface
    TablesSurface.jsx— Floor plan / table management
    KioskSurface.jsx — Self-service kiosk
    OrdersHub.jsx    — Orders management view
    PINScreen.jsx    — Staff PIN login
    DeviceSetup.jsx  — Device pairing flow
  backoffice/
    BackOfficeApp.jsx       — Back office root, auth, "Push to POS" logic
    sections/MenuManager.jsx — Menu, categories, items, modifiers (largest file ~2700 lines)
    sections/BOReports.jsx   — Analytics/reporting
    sections/FloorPlanBuilder.jsx — Table layout editor
    sections/DeviceProfiles.jsx   — Terminal configuration
    (+ other sections)
  components/        — Shared modals and UI (InlineItemFlow, ItemInfoModal, AIChat, etc.)
  sync/
    SyncBridge.jsx         — Boot loader, BroadcastChannel sync, category/item mapping from DB
    SessionSync.js         — Table sessions written to Supabase on change
    SessionReconciler.js   — Polls active_sessions every 10s for cross-device consistency
    OfflineQueue.js        — Durable write queue for offline resilience
    DataSafe.js            — Pending check reconciliation on reconnect
    MasterSync.js          — Master/child device heartbeat
  data/              — Seed data and mock items for dev/mock mode
  styles/globals.css — CSS custom properties (--bg, --acc, --t1, etc.)
api/
  ai.js              — Vercel serverless: Claude AI endpoint
supabase-schema.sql        — Ops DB schema (reference — not auto-run)
supabase-auth-schema.sql   — Platform DB schema
```

---

## Two Supabase Projects

| | Ops DB | Platform DB |
|---|---|---|
| Project ID | `tbetcegmszzotrwdtqhi` | `yhzjgyrkyjabvhblqxzu` |
| Purpose | All POS operational data | Company/user/org management |
| Client | `supabase` from `lib/supabase.js` | `platformSupabase` from `lib/supabase.js` |
| Auth | Supabase Auth (back office users) | Supabase Auth (platform admins) |
| Location UUID | `7218c716-eeb4-4f96-b284-f3500823595c` | — |

---

## Domain Concepts

- **Location** — a single venue. All data is scoped to `location_id`.
- **Device Profile** — configuration for a terminal (POS counter, bar, kiosk, etc.)
- **Session** — an open table order; stored in `active_sessions`, loaded at boot, synced via Realtime
- **Config Push** — back office broadcasts a snapshot to all POS devices via `config_pushes` table
- **Menu** → **Categories** → **Items** → **Modifier Groups** → **Options** (the menu hierarchy)
- **Course** — item firing timing: 0=Immediate, 1=Course 1 (starters), 2=Course 2 (mains), 3=desserts. Set per **category** as `defaultCourse`, inherited by items.
- **86'd** — item marked out of stock (`eightySixIds[]` in store)
- **Quick Screen** — curated grid of fast-access items on POS; IDs stored in `locations.quick_screen_ids`
- **Spacer** — blank layout cell in menu grid; stored as `spacerSlots: [{id, sortOrder}]` on `menu_categories.spacer_slots`

---

## How to Run / Build / Deploy

```bash
# Dev (mock mode — no Supabase needed)
npm run dev

# Build
npm run build

# Preview built output
npm run preview

# Deploy — push to main, Vercel auto-deploys
git add -A && git commit -m "vX.Y.Z — description" && git push origin main
```

**Environment variables (set in Vercel dashboard, NOT in git):**
```
VITE_SUPABASE_URL=https://tbetcegmszzotrwdtqhi.supabase.co
VITE_SUPABASE_ANON_KEY=<real key>
VITE_USE_MOCK=false
VITE_PLATFORM_SUPABASE_URL=https://yhzjgyrkyjabvhblqxzu.supabase.co
VITE_PLATFORM_SUPABASE_ANON_KEY=<real key>
```

Local `.env.local` has placeholder values — `isMock=true` locally, real values on Vercel.

**Every deploy MUST:**
1. Update `src/lib/version.js` with new version string
2. Add a new entry at the top of `CHANGELOG` in `src/App.jsx`
3. `npm run build` — verify clean before pushing

---

## Conventions

- **camelCase in store/JS, snake_case in Supabase.** Always map both directions explicitly.
- **Static imports only in bundled code.** Dynamic `import(...).then()` silently fails in the Vite bundle. Use static `import` at the top of the file.
- **No localStorage for persistent data.** Everything must go to Supabase. localStorage is only for offline fallback caching.
- **Always resolve locationId before any DB write.** Never use `LOCATION_ID = 'loc-demo'` as a real value.
- **Version bump on every deploy** — `version.js` + `CHANGELOG` in `App.jsx`.
- **No TypeScript, no tests** — be careful with types, validate manually.
- **CSS custom properties** — use `var(--bg)`, `var(--acc)`, `var(--t1)` etc., never hardcode colours.

---

## Gotchas (Lessons Learned the Hard Way)

### The `loc-demo` Trap
`LOCATION_ID = 'loc-demo'` is exported from `supabase.js` and used as default parameter in db.js. It is **truthy**, so naive `if (!locationId)` checks don't catch it. **Every db function must check `!locationId || locationId === 'loc-demo'`**.

### Two Category Save Paths
`sbUpsertCategory()` in `store/index.js` and `upsertMenuCategory()` in `db.js` are **separate functions**. When a field is added to one, it must be added to the other. `store/index.js` is what actually fires on every `updateCategory()` call.

### Dynamic Imports Break in Bundle
`import('../lib/db.js').then(...)` inside event handlers or callbacks silently fails in the Vite production bundle. Always use static top-level imports.

### Snake_case ↔ CamelCase Mapping
Supabase returns `default_course`, `parent_id`, `sort_order`, `spacer_slots` etc. The store expects `defaultCourse`, `parentId`, `sortOrder`, `spacerSlots`. The mapping lives in `SyncBridge.jsx` `catsRes.data.map()`. If you add a new column, add the mapping there AND in `sbUpsertCategory`.

### Spacer Slots
Spacers are NOT menu items. They're stored as `spacerSlots: [{id, sortOrder}]` on the category in memory and as `spacer_slots jsonb` in `menu_categories`. They're merged with real items by `sortOrder` at render time. They show as empty cells on POS, dashed placeholders in back office.

### Config Push vs Supabase Direct
The POS loads data two ways at boot:
1. `fetchLatestConfigPush()` — snapshot from back office "Push to POS" (contains menu, categories, etc.)
2. Direct Supabase queries — floor plan, sessions, modifier groups, quick screen IDs
If something isn't in both paths, it may not appear on the POS after reload.

### Course Assignment
`defaultCourse` is set per **category**, inherited by items at the moment they're added to an order (in `addItem` in store). The `fired` flag (immediate-fire) must use the **same category fallback chain** as `course`. Both must walk: `item.cat → item.cats[0] → parentItem.cat`.

### isMock Mode
If `VITE_SUPABASE_ANON_KEY` is missing/placeholder, `isMock=true` and `supabase=null`. All db writes silently return early. This is the local dev state. Production Vercel has real keys.

---

## Rules for Claude

1. **Always read `CLAUDE.md`, `DECISIONS.md`, `INVARIANTS.md`, and `CURRENT_WORK.md` at the start of every chat before editing code.**
2. Never modify files outside the scope given without asking.
3. Run `npm run build` before and after changes and fix any errors before deploying.
4. Prefer small, reviewable diffs — fix one thing at a time.
5. If a change would violate `INVARIANTS.md`, stop and ask.
6. Update `CURRENT_WORK.md` at the end of each session with what was done, what's in progress, and what's next.
7. Every deploy: update `src/lib/version.js` AND add a top-of-CHANGELOG entry in `src/App.jsx`.
8. Never use dynamic imports inside bundled component code — static imports only.
9. Never write `loc-demo` to Supabase — always resolve the real locationId first.
10. When adding a DB column, update: the SQL schema, `sbUpsertCategory`/`upsertMenuCategory` (both!), and the SyncBridge mapping.
11. The 6 Build Pillars: (1) New schema for large features (2) Don't break existing functionality (3) Build for scale/stability/no data loss (4) Forward thinking (5) Update AI with new capabilities (6) Always resolve properly, not with patches.
