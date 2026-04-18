# DECISIONS.md — Architectural Decision Records

Short ADR entries for non-obvious choices in the codebase.

---

## ADR-001: Single Zustand Store for All State

**Context:** Multi-surface app (POS, Bar, KDS, Back Office) with shared state (tables, menu, sessions, 86 list, etc.).

**Decision:** One flat Zustand store (`src/store/index.js`) shared across all surfaces via `useStore()`.

**Consequences:** Simple cross-surface access; large file (~1300 lines); no selector memoisation discipline required but store updates re-render all subscribers.

---

## ADR-002: Two Supabase Projects (Ops DB + Platform DB)

**Context:** Need to separate POS operational data from company/user management to allow multi-tenancy and independent scaling.

**Decision:** Ops DB (`tbetcegmszzotrwdtqhi`) holds all POS data scoped by `location_id`. Platform DB (`yhzjgyrkyjabvhblqxzu`) holds orgs, users, billing.

**Consequences:** Two clients in `lib/supabase.js`; joins across projects not possible at DB level; all cross-project logic is in application code.

---

## ADR-003: `loc-demo` as Mock Sentinel (Not Null)

**Context:** `LOCATION_ID` needs a default value. Empty string would be falsy and break URL construction; null would be falsy.

**Decision:** `LOCATION_ID = 'loc-demo'` exported from `supabase.js` as a truthy sentinel for mock/dev mode.

**Consequences:** **Critical gotcha** — all db functions must check `=== 'loc-demo'` not just falsy. Any function that forgets this will silently write to a non-existent location. See INVARIANTS.md.

---

## ADR-004: Config Push Architecture (Back Office → POS)

**Context:** POS devices (Sunmi terminals) need to receive menu/config updates from back office without a page reload.

**Decision:** Back office writes a `config_pushes` snapshot to Supabase. POS loads latest snapshot at boot AND listens for new pushes via Realtime. `SyncBridge.jsx` handles both paths.

**Consequences:** POS always has a config snapshot from the last push. Changes to categories/menus/items require a manual "Push to POS" from back office. Quick Screen and session data load separately (direct Supabase query, not config push).

---

## ADR-005: BroadcastChannel for Same-Machine Multi-Tab Sync

**Context:** Multiple browser tabs on the same machine (e.g., dev testing) need to share operational state (tables, 86 list, KDS tickets).

**Decision:** `SyncBridge.jsx` uses `BroadcastChannel` to sync `SHARED_KEYS` state between tabs on the same origin.

**Consequences:** Same-machine tabs stay in sync instantly. Cross-device sync relies on Supabase Realtime + `SessionSync.js` + `SessionReconciler.js` (10s poll fallback).

---

## ADR-006: Session Sync — Write on Item Add, Reconcile Every 10s

**Context:** Table sessions (open orders) must be visible on all devices in real-time.

**Decision:** `SessionSync.js` writes to `active_sessions` on any meaningful state change (item add/remove, open/close, covers). `SessionReconciler.js` polls every 10s and reconciles by item count (Supabase wins if it has more items).

**Consequences:** Near-real-time cross-device session visibility. Reconciler won't overwrite the `activeTableId` (currently being edited) to avoid clobbering work in progress.

---

## ADR-007: Spacers as Category Metadata, Not Menu Items

**Context:** Operators want to add blank grid cells between POS buttons to improve visual layout.

**Decision:** Spacers are stored as `spacerSlots: [{id, sortOrder}]` on `menu_categories.spacer_slots` (jsonb column). They're merged with real items at render time by `sortOrder`. They are NOT menu items — no `menu_items` rows created.

**Consequences:** Zero data model complexity; spacers don't appear in search, allergen filters, or item counts; they survive Push to POS because category data is included in config snapshots.

---

## ADR-008: Static Imports Only in Bundled Code

**Context:** Dynamic `import('../lib/db.js').then(...)` was used inside event handlers to lazy-load the db module.

**Decision:** All imports must be static (top-level `import` statements) in any file that's part of the Vite bundle.

**Consequences:** Vite correctly tree-shakes and chunks static imports. Dynamic imports inside callbacks silently fail in the production bundle (the Promise never resolves, no error thrown). This caused multiple data-loss bugs before being identified.

---

## ADR-009: Version String as Single Source of Truth

**Context:** Version badge appears in POS header, back office header, and What's New modal.

**Decision:** `src/lib/version.js` exports `VERSION`. `App.jsx` imports it and uses it for all display. `CHANGELOG` array in `App.jsx` is the in-app changelog.

**Consequences:** Every deploy requires updating `version.js` AND adding a `CHANGELOG` entry. Forgetting either makes the version badge stale.

---

## ADR-010: No TypeScript, No Tests

**Context:** Rapid iteration speed was prioritised; project started as a prototype.

**Decision:** Plain JavaScript with JSDoc comments where helpful. No unit or integration tests.

**Consequences:** Must verify correctness manually. Type errors only surface at runtime. `npm run build` is the only automated check — run it before every deploy.
