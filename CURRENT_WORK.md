# CURRENT_WORK.md — Session Tracking

## Last Session Summary

**Date:** 17 April 2026
**Version shipped:** v4.0.8

### What was done:
- **Modifier +/− fixed, image upload fixed, loc-demo trap fixed** (v3.9.3–v3.9.7)
- **Modifier min picks, modifier images inherit from sub-items** (v3.9.4–v3.9.8)
- **Quick Screen saves to Supabase** (v4.0.0–v4.0.3) — direct supabase UPDATE, no dynamic imports
- **86 button moved to long-press modal** (v4.0.2)
- **Course bug fixed** (v4.0.6–v4.0.7) — `defaultCourse` was never mapped from `default_course` in either SyncBridge or BackOfficeApp. Both fixed. `sbUpsertCategory` also now writes it.
- **Spacers** (v4.0.5–v4.0.8) — stored as `[{id, sortOrder}]` in `menu_categories.spacer_slots`. Draggable via `reorderGrid()`. Persist correctly after v4.0.8 fix.
- **Knowledge base created** — CLAUDE.md, DECISIONS.md, INVARIANTS.md, CURRENT_WORK.md, .claudeignore committed.

## In Progress

- Table sync cross-device (Sunmi → Test 1) — partially fixed, needs monitoring in production.

## Next Up

- Verify Push to POS includes `spacerSlots` in category snapshot so POS shows spacers after a push.
- Confirm course assignment is correct on all items after `defaultCourse` fix — do a Push to POS.
- Investigate whether `subscribeToSessions()` in SessionSync.js is actually being called at boot.

## Known Issues / Landmines

- **Three category mapping locations** — SyncBridge, BackOfficeApp, sbUpsertCategory in store. All three must stay in sync when adding category fields. This caused the spacer and course bugs.
- **sbUpsertCategory (store) ≠ upsertMenuCategory (db.js)** — two separate functions, both must be updated together.
- **Config push snapshot** — Quick Screen loads from Supabase directly at boot, NOT from the config push. Spacers load via category data which IS in the config push, but only if the snapshot was created after v4.0.7.

## Open Questions

- Should the two category upsert functions be merged into one?
- Is the `spacer_slots` column included in the config push snapshot sent by Push to POS?
