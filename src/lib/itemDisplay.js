// ============================================================
// src/lib/itemDisplay.js — customer-facing item field resolvers
// ============================================================
// Two name fields exist on a menu_items row:
//   - `name`     — internal/admin string. Stable identity, used by BO list
//                  views, POS button text default, modifier-option name
//                  match.
//   - `menuName` (DB column `menu_name`) — customer-facing display name. The
//                  field operators edit when they "rename" something for
//                  the kiosk / online surfaces.
//
// Different load paths give different shapes:
//   - Zustand store (POS): rows normalized to camelCase via SyncBridge → use
//                          `menuName`.
//   - Kiosk's useKioskMenu: raw Supabase rows → use `menu_name`.
//
// displayName() reads either shape, falling back to `name` so legacy data or
// fresh inserts that haven't set menuName yet still render something.
// ============================================================

export function displayName(item) {
  if (!item) return '';
  return item.menuName ?? item.menu_name ?? item.name ?? '';
}
