# RPOS session handoff — 29 Apr (v5.5.6)

> Continues from 28 Apr afternoon (v5.4.2). Heavy day on multi-location
> data integrity after Peter saw cross-tenant data bleed in real testing.
> 7 versions shipped this arc. Two regressions caught + hotfixed mid-day.

---

## What shipped today (29 Apr): v5.5.0 → v5.5.6

### Kiosk UI overhaul (Peter's morning priority)
- **v5.5.0**: kiosk theme system in CSS — `[data-kiosk-theme="dark|light"]`
  blocks in globals.css with full var palette (--kFg, --kSurface1/2/3,
  --kBorder1/2/3, --kSurfaceShell, --kSurfaceRaised, --kImageBg,
  --kOverlay, allergen + error). 92+28 hardcoded translucent whites
  swept to vars across KioskApp + KioskProductModal.
- **v5.5.1**: 3-column menu, inline nested modifiers (no more child modal),
  unified product flow (every item routes through KioskProductModal —
  ScreenItemDetail removed), typography pass for kiosk distance
  (name 30→38, options 16→18, etc).

### Multi-location data integrity (Peter's afternoon escalation)
- **v5.5.2**: floor plan corruption fix. BackOfficeApp was reading from
  user_profiles.location_id while every WRITE used the rpos-bo-location
  override via getLocationId(). When they disagreed, upsertFloorTable
  silently rewrote the row's location_id, MOVING tables across locations.
  Five-layer fix: BackOfficeApp respects override; upsertFloorTable +
  deleteFloorTable have cross-location guards; locationId stamped on
  every hydrated table; FloorPlanBuilder filters by current location.
  Also wrote v5.5.2-floor-plan-recovery.sql for diagnosing damage.
- **v5.5.3**: tenant fence — Peter saw Loc 2's first POS test surface
  Loc 1's open orders. Audit found 10 location-scoped localStorage keys
  with bare names (rpos-session-backup, rpos-shared-state,
  rpos-config-snapshot, rpos-printers, rpos-print-routing,
  rpos-device-profiles, rpos-device-config, rpos-terminal-config,
  rpos-config-version, rpos-session-snapshot). Boot-time fence
  (App.jsx) + pair-time fence (PairingScreen) + switch-time fence
  (LocationSwitcher) all converge on enforceTenantFence() in supabase.js.
  Plus comprehensive RLS migration (20260429_tenant_rls.sql) covering
  14 location-scoped tables.
- **v5.5.4**: HOTFIX — v5.5.3's "first boot tag missing → wipe for
  safety" branch fired on EVERY existing terminal upgrading to v5.5.3,
  wiping rpos-device (the pairing record) and bouncing every paired POS
  to PairingScreen. Both Peter's POS at Loc 1 AND Neil's POS at Loc 2
  got kicked off. Same wipe also took rpos-shared-state with it,
  losing in-flight session state.
  Removed the dangerous branch — fence now only wipes on actual
  location MISMATCH. Added rpos-device to keep set. Routed
  setResolvedLocationId through enforceTenantFence so wipe decisions
  use the persistent tag, not the in-memory _resolvedLocationId
  (which is null on every module load → spurious wipes on every BO
  load in v5.5.3).
  ALSO fixed pre-existing course-2+ reprint bug exposed by the wipe:
  save+send was only marking course 0/1 items as status:'sent'.
  Course 2+ (hold/fire-later) items stayed 'pending' even after
  printing — next save+send re-included them, reprinting kitchen
  tickets. Now status (kitchen-saw-it) and fired (kitchen-cook-it)
  are independent.
- **v5.5.5**: customer attribution. Peter reported a Loc 2 order with
  same phone as a Loc 1 customer didn't update Loc 1's record AND
  didn't create a Loc 2 record. Two causes:
    (a) kiosk's submitOrder NEVER called attributeOrderToCustomer —
        bug since v5.0.0. Fixed.
    (b) attributeOrderToCustomer + upsertCustomer silently caught all
        errors with one generic warning. Now every step logs explicit
        success/failure. RPC failures fall through to direct
        customer_locations upsert. closed_checks.customer_id stamp
        scoped by (ref, location_id) instead of ref alone.
  Plus v5.5.5-customer-diagnostics.sql with 8 read-only diagnostic
  queries + interpretation guide.
- **v5.5.6**: closing-day tighten-up. CRM RLS migration
  (20260429_crm_tenant_rls.sql), kiosk CRM backfill SQL
  (v5.5.5-kiosk-crm-backfill.sql), BroadcastChannel cross-tenant
  guard (messages tagged with locationId; receivers drop mismatches).

---

## v5.5.6 deep dive (fresh context for next session)

### What's actually fixed vs what needs Peter to run SQL

**Application-layer (live in code, deployed via Vercel push):**
- All 7 commits above are merged to develop and deployed.
- POS terminals + kiosks should reload to pick up the new bundle.

**Database-layer (REQUIRES MANUAL SQL RUN by Peter):**
- `supabase/migrations/20260429_tenant_rls.sql` — operational table RLS
- `supabase/migrations/20260429_crm_tenant_rls.sql` — CRM table RLS
  (depends on the above; run them in order)
- `migrations/v5.5.5-kiosk-crm-backfill.sql` — backfill historical
  kiosk orders into the CRM
- `migrations/v5.5.2-floor-plan-recovery.sql` — read-only diagnostic
  for any tables that may have been moved across locations during the
  pre-v5.5.2 corruption window. Includes a careful UPDATE template at
  the bottom for restoring specific rows.
- `migrations/v5.5.5-customer-diagnostics.sql` — read-only customer
  attribution diagnostics; useful if Peter sees a customer fail to
  attribute even on v5.5.5.

### Boot tenant fence — current behaviour

`src/lib/supabase.js` exports three functions used by the fence:
- `getActiveLocationSync()` — reads rpos-bo-location → rpos-device.locationId.
  No DB call. Returns null if neither set.
- `purgeStaleLocationData(reason)` — wipes every rpos-* localStorage +
  sessionStorage key not in TENANT_FENCE_KEEP. Logs the reason.
- `enforceTenantFence(activeLocId?)` — compares to rpos-active-location
  tag in localStorage. Wipes ONLY on real mismatch. Stamps the tag.

TENANT_FENCE_KEEP = {rpos-auth, rpos-bo-location, rpos-active-location,
rpos-device-mode, rpos-theme, rpos-device}.

The fence runs at three places:
1. Top of App.jsx (`enforceTenantFence();`) — fires before any module
   that reads location-scoped localStorage.
2. PairingScreen.handlePair, before writing the new rpos-device.
3. LocationSwitcher.switchTo, before writing the new rpos-bo-location.

### Floor plan cross-location guard

upsertFloorTable now has an in-memory cross-location guard:
- If `table.locationId` is set and differs from the requested write
  location, upsert is REFUSED with explicit error log.
- locationId is stamped on every table from every hydration path
  (useSupabaseInit, SyncBridge POS hydrate, BackOfficeApp.loadLocationData,
  applyConfigUpdate).
- FloorPlanBuilder filters tables by getActiveLocationSync() at render
  time so leaked cross-location data isn't visible to drag.

### Save+send / fired-courses

In `store/index.js` save+send path (sendToKitchen):
- Every pending non-voided item that goes to kitchen flips to
  status:'sent' regardless of course.
- The `fired` boolean is independent: true for course 0/1 (auto-fire),
  false for course 2+ (hold; flips to true when fireCourse(N) runs).
- Items with status:'sent' are excluded from pendingItems on next
  save+send → no reprint.

### Kiosk customer attribution

`src/surfaces/KioskApp.jsx` submitOrder now calls
`useStore.getState().attributeOrderToCustomer({customer, orderRecord})`
after closed_checks.insert succeeds. Channel tag = 'kiosk'.

`src/store/index.js` attributeOrderToCustomer + upsertCustomer have
explicit step-by-step logging — every failure mode tells you why.
The upsert_customer_visit RPC has a fallback that writes
customer_locations directly if the RPC errors out.

---

## Live database state (Foster City / Loc 1)

- Kiosk: `2b7334b3-228d-4fab-a8a3-d9b8e105a6cc` paired, profile_id
  `prof-1777423218536`
- Org: `a59a6d97-ffaa-470e-8bb7-04cba789f335`
- Loc 1: `7218c716-eeb4-4f96-b284-f3500823595c`
- Loc 2: (Neil's location — Peter has the UUID)
- Theme: light, brand color #ff7070
- Latte references mod group `mgd-1776287941070` which doesn't exist
  (orphan from old data). Console warns. Operator should clean up in
  MenuManager.
- Latte's working group is `mgd-1776289719220` (Milk) with each option
  carrying `subGroupId: 'mgd-1776292974106'` → "Coffee Temp" (HOT/COLD)
- Foster City attract video is .mov — needs MP4 reupload (still unfixed)

---

## What's working end-to-end after v5.5.6

- Kiosk: full 8-screen flow with inline nested modifiers, 3-col menu,
  unified product UI, light/dark theme, customer attribution to CRM,
  closed_checks + kds_tickets writes scoped to location.
- POS: tables/sessions/closed_checks/kds_tickets all location-scoped
  on read AND write. Floor plan editor is location-aware. Save+send
  no longer reprints fired courses. Customer attribution works for
  POS dine-in / walk-in / bar-tab paths.
- Multi-location: switching via BO LocationSwitcher works correctly.
  Re-pairing a POS to a different location wipes stale state. Multiple
  tabs at different locations don't cross-pollinate via BroadcastChannel.

---

## What's NOT working / pending (priority order)

### Highest priority
1. **POS receives kiosk orders in real-time.** The original priority
   from yesterday's gist that we deferred for the data-integrity work.
   Plan: realtime sub on `closed_checks` filtered to source='kiosk' +
   location_id, toast popup with sound, click → read-only order panel.

### Medium
2. **menu_items + bar_tabs cross-location guard.** Same
   upsert(onConflict:'id') pattern as floor_tables. RLS covers the
   write at the DB but the application-level guard (matching the
   v5.5.2 pattern for tables) isn't in place. Risk of cross-location
   move if BO read/write paths ever disagree on these tables. Apply
   the same pattern: stamp locationId on hydration; refuse upsert if
   table.locationId differs from current.

3. **Schema-level (id, location_id) unique constraint.** Proper
   structural fix that makes cross-location moves impossible at the
   PK level, regardless of app code or RLS. Needs FK rebuild on
   closed_checks.table_id and active_sessions.table_id. Dedicated
   focused migration.

4. **Light mode still has unreadable spots on kiosk.** Need user to
   point at specific screen. Don't sweep without testing.

5. **Real card terminal integration** — currently "Simulate paid" demo
   button. Plan: webhook from terminal → mark order paid. Postponed
   until Peter has a payment provider.

6. **SMS provider integration** — currently capture phone but don't
   send. Plan: Twilio. Peter doesn't have Twilio yet.

### Low
7. **Allergen forced confirm modal** — if customer ignored filter,
   items with allergen-confirm flag should pop a confirm dialog at
   add-to-cart on kiosk.
8. **Orphaned mod group cleanup** — Latte references missing
   `mgd-1776287941070`. Tell Peter to clean up in MenuManager
   Modifier Groups.
9. **.mov video on Peter's profile** — needs reupload as MP4.
   v5.2.3 added a hard reject for .mov uploads but the existing one
   is still there.

---

## Architecture cheat sheet (key file paths + patterns)

### Multi-location safety
- `src/lib/supabase.js` — getLocationId, getActiveLocationSync,
  enforceTenantFence, purgeStaleLocationData, setResolvedLocationId.
  TENANT_FENCE_KEEP is the source of truth for which localStorage keys
  survive a wipe.
- `src/lib/db.js` — all CRUD with explicit `.eq('location_id', ...)` filters.
  upsertFloorTable + deleteFloorTable have cross-location guards.
- `src/sync/SyncBridge.jsx` — BroadcastChannel locationId tagging on
  every postMessage; receiver drops cross-location messages.
- `supabase/migrations/20260429_tenant_rls.sql` — operational RLS
- `supabase/migrations/20260429_crm_tenant_rls.sql` — CRM RLS
- `src/backoffice/BackOfficeApp.jsx` — reads rpos-bo-location override
  FIRST then user_profiles fallback (line 79 onwards). Don't regress
  this — the v5.5.2 bug was BackOfficeApp ignoring the override.

### Kiosk
- `src/surfaces/KioskApp.jsx` (~70KB) — main orchestrator + all 8
  screens inline. submitOrder calls attributeOrderToCustomer for CRM.
- `src/surfaces/KioskProductModal.jsx` (~25KB) — inline nested mod
  configurator. Pre-fetches sub-groups on mount.
- `src/styles/globals.css` — kiosk theme vars under [data-kiosk-theme]
  blocks.

### POS
- `src/store/index.js` save+send path (~line 1421) — status/fired
  separation per v5.5.4. attributeOrderToCustomer + upsertCustomer with
  explicit logging per v5.5.5.
- `src/surfaces/POSSurface.jsx` — order panel; close paths route through
  recordClosedCheck / recordWalkInClosedCheck / recordWalkInClosed which
  all call attributeOrderToCustomer when customer.phone is set.

---

## Process lessons (from today)

1. **Destructive defaults need explicit evidence.** v5.5.3's "first
   boot tag missing → wipe for safety" was added on a hunch about
   edge cases and bit every existing terminal. Lesson: when adding a
   destructive op (wiping localStorage), the default should be "don't
   unless I have explicit evidence the data is stale."
2. **Always test the upgrade path.** The first wipe fired specifically
   on the upgrade from pre-v5.5.3 → v5.5.3 because the tag didn't
   exist yet. That class of bug is invisible if you only test the
   second-and-later boot.
3. **Same-class bugs cluster.** The floor_tables corruption,
   active_sessions leak, and customer attribution miss are all the
   same shape — location_id is on the row but the app code didn't
   reliably scope reads/writes to it. Fix them all at once if
   possible.
4. **Silent error handlers hide root causes.** Three of today's bugs
   were diagnosed by adding explicit logging where there'd previously
   been a single generic catch. Default for new code: log every
   distinct failure mode separately.
5. **Browser tabs share localStorage.** v5.5.6's BroadcastChannel
   guard exists because two tabs of the same browser at different
   locations can pollute each other. Subtle but real.

---

## Three big follow-ups still queued (carried over from yesterday)

1. **POS receives kiosk orders in real-time** — ready to start; not
   blocked.
2. **Online ordering** — not started. Likely Deliverect short-circuit.
3. **Mobile POS for handhelds** — not started. Same backend, smaller
   render.

---

## DO BEFORE NEXT SESSION (Peter)

In Supabase SQL editor (project tbetcegmszzotrwdtqhi):

1. **Take a backup snapshot.** Database → Backups → Create.
2. Run **`supabase/migrations/20260429_tenant_rls.sql`** — operational
   table RLS (covers floor_tables, active_sessions, closed_checks,
   kds_tickets, menu_items, etc).
3. Run **`supabase/migrations/20260429_crm_tenant_rls.sql`** — CRM
   table RLS (depends on #2; run after).
4. Run query (a) from **`migrations/v5.5.5-kiosk-crm-backfill.sql`** to
   preview how many kiosk orders need backfilling.
5. If counts look right, run queries (b)-(f) from the same file to
   backfill. Re-run query (f) to verify zero unattributed remain.
6. Optional: query 4 from **`migrations/v5.5.2-floor-plan-recovery.sql`**
   to see if any tables show signs of having been moved across locations
   pre-v5.5.2. Use the restoration template at the bottom for any
   confirmed cases.

After running 2 + 3, cross-tenant data leaks become structurally
impossible at the database level — the application-layer fence + guards
are belt-and-suspenders.

---

Session milestone marker: **multi-location data integrity locked down at
both app + DB layers. Kiosk UI overhaul shipped.** Next session resumes
on POS-receives-kiosk-orders + the deferred cross-location guards on
menu_items + bar_tabs.
