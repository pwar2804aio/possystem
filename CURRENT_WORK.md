# CURRENT_WORK.md — Session Tracking

Update this file at the end of every session.

---

## Last Session Summary

**Date:** 17 April 2026  
**Version shipped:** v4.0.7

### What was done:
- **Modifier +/− buttons fixed** (v3.9.3): `ModifierStep` is a child component — `setSelections`, `addMulti`, `removeMulti` were not in scope. Added `onQtyChange` prop and wired all handlers through props.
- **Image upload persistence fixed** (v3.9.7): `ItemImageUpload` now does a direct targeted `UPDATE (image, updated_at) WHERE id=item.id` to Supabase. Bypasses store upsert path entirely.
- **`loc-demo` sentinel fixed** (v3.9.6): All db.js functions now check `!locationId || locationId === 'loc-demo'` before using the value.
- **Modifier option images inherit from sub-items** (v3.9.4/v3.9.5): `resolveOptImage()` in `ModifierStep` checks the option's own image first, then looks up matching sub-item by name.
- **Modifier group min picks control** (v3.9.8): Required toggle now reveals a Min picks row with 1-5 buttons + custom N.
- **Quick Screen** (v4.0.0–v4.0.3): `quickScreenIds` in Supabase `locations.quick_screen_ids`. Save uses direct supabase UPDATE from `MenuManager.jsx` (static import). Boot loads from DB in parallel.
- **86 button moved** (v4.0.2): Removed from POS card, added to `ItemInfoModal` long-press footer.
- **Spacers** (v4.0.5–v4.0.7): Pure layout cells stored as `spacerSlots: [{id, sortOrder}]` on `menu_categories.spacer_slots`. Draggable via `reorderGrid()`. Invisible on POS.
- **Course bug fixed** (v4.0.6–v4.0.7): `defaultCourse` was never mapped from `default_course` in SyncBridge category load. Also `sbUpsertCategory` wasn't writing `default_course`. Both fixed.

---

## In Progress

- **Table sync across devices** — partially fixed (item count triggers flush, reconciler compares item counts) but may still have edge cases. The original comment `// Item add/remove intentionally excluded` was there for a reason (echo-back risk). Monitor carefully.
- **Spacer drag reorder** — `reorderGrid()` reassigns all sortOrders sequentially. Verify this works correctly in practice.

---

## Next Up

- Audit `Push to POS` snapshot to confirm all new fields (`default_course`, `spacer_slots`) are included in config push so POS always loads them correctly after a push.
- Consider adding `default_course` to the config push category mapping in `BackOfficeApp.jsx`.
- Table sync root cause (cross-device) needs a proper fix — `subscribeToSessions()` in `SessionSync.js` may not be started correctly at boot.
- TypeScript migration (long-term consideration).

---

## Known Issues

- **Table sync**: Items added on Sunmi may not appear on Test 1 immediately. The `SessionReconciler` catches it within 10s but real-time sync via Supabase Realtime is not confirmed working end-to-end.
- **Quick Screen hard reload**: After saving Quick Screen items, the POS needs a hard refresh to show them (boot loads from Supabase). Acceptable for now.
- **Spacer in config push**: Spacers may not appear on POS after a Push to POS if the config push snapshot doesn't include the updated category `spacerSlots`. Needs verification.

---

## Open Questions

- Should `sbUpsertCategory` and `upsertMenuCategory` be merged into one canonical function to avoid drift?
- Is the `VITE_SUPABASE_ANON_KEY` properly set in Vercel for all environments (production, preview)?
- What is the intended behaviour when the Sunmi goes offline — does the OfflineQueue replay correctly?
- Should courses be configurable per-item (override) as well as per-category?
