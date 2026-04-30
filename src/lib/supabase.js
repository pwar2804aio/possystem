import { createClient } from '@supabase/supabase-js';

// ── Ops DB (POS operational data — source of truth for all POS operations) ───
const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || '';
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const isMock  = import.meta.env.VITE_USE_MOCK === 'true' || !SUPABASE_URL || !SUPABASE_ANON;

export const supabase = isMock ? null : createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'rpos-auth',
  },
});

// ── Platform DB (company/user management — separate project) ──────────────────
const PLATFORM_URL  = import.meta.env.VITE_PLATFORM_SUPABASE_URL  || '';
const PLATFORM_ANON = import.meta.env.VITE_PLATFORM_SUPABASE_ANON_KEY || '';
export const platformSupabase = (PLATFORM_URL && PLATFORM_ANON)
  ? createClient(PLATFORM_URL, PLATFORM_ANON, { auth: { persistSession: false } })
  : null;

// Dynamic location ID — resolved from user_profiles in Ops DB
let _resolvedLocationId = null;

export const getLocationId = async () => {
  if (isMock) return 'loc-demo';
  if (_resolvedLocationId) return _resolvedLocationId;
  if (!supabase) return null;

  // Back office explicit location override
  try {
    const boLoc = JSON.parse(localStorage.getItem('rpos-bo-location') || 'null');
    if (boLoc) { _resolvedLocationId = boLoc; return boLoc; }
  } catch {}

  // Authenticated user — read location from user_profiles in Ops DB
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from('user_profiles').select('location_id').eq('id', user.id).single();
      if (profile?.location_id) {
        _resolvedLocationId = profile.location_id;
        return _resolvedLocationId;
      }
    }
  } catch {}

  // POS fallback: paired device locationId
  try {
    const paired = JSON.parse(localStorage.getItem('rpos-device') || 'null');
    if (paired?.locationId) {
      _resolvedLocationId = paired.locationId;
      return _resolvedLocationId;
    }
  } catch {}

  return null;
};

export const setResolvedLocationId = (id) => {
  // v5.5.3: routed through the unified tenant-fence path so any code that calls
  // setResolvedLocationId benefits from the same logic as the boot-time + pairing-time
  // fence. If id matches the currently-active location, this is a no-op. If different,
  // every location-scoped localStorage / sessionStorage key is wiped before _resolvedLocationId
  // is updated. This was previously inlined here, but the same logic is needed in two
  // other call sites (boot, pairing) so it's centralised below.
  if (id !== _resolvedLocationId) {
    purgeStaleLocationData('setResolvedLocationId: ' + (_resolvedLocationId || '<none>') + ' -> ' + id);
  }
  _resolvedLocationId = id;
};
export const clearResolvedLocationId = () => { _resolvedLocationId = null; };
export const LOCATION_ID = 'loc-demo';


// ──────────────────────────────────────────────────────────────────
// v5.5.3 — TENANT FENCE
//
// Every boot, pairing, and explicit location switch routes through enforceTenantFence
// to guarantee that location-scoped localStorage state from a previously-active
// location is wiped before the new location's app initialisation reads from it.
//
// Without this, a single browser used at Loc 1 then re-paired (or BO-switched) to
// Loc 2 would carry Loc 1's open sessions, closed checks, KDS tickets, config
// snapshot, printers, device profiles, etc. into Loc 2's hydrated state — because
// every one of those localStorage keys is bare-named (no location_id in the key).
//
// The fence works in two parts:
//   1. enforceTenantFence(activeLocId): on every boot/pair/switch, compare the
//      active location to the rpos-active-location tag in localStorage. If they
//      differ, purgeStaleLocationData() wipes every rpos-* key except the
//      always-keep set, then stamps the new tag.
//   2. Application code calls enforceTenantFence as the very first thing in its
//      boot path so the wipe happens before any reader hydrates from localStorage.
//
// Keys that always survive a wipe:
//   rpos-auth          — Supabase auth token; lives across all locations
//   rpos-bo-location   — the BO location override; the wipe trigger itself
//   rpos-active-location — the tenant fence tag; written immediately after wipe
//   rpos-device-mode   — pos|office|admin selector; cross-location
//   rpos-theme         — UI preference; cross-location
// ──────────────────────────────────────────────────────────────────

const TENANT_FENCE_KEEP = new Set([
  'rpos-auth',
  'rpos-bo-location',
  'rpos-active-location',
  'rpos-device-mode',
  'rpos-theme',
]);

/**
 * Synchronously resolve the location_id this browser is currently scoped to.
 * Reads localStorage only — no Supabase call. Used by the boot-time tenant
 * fence which must run before any async work.
 *
 * Priority matches getLocationId() so the fence agrees with later resolution:
 *   1. rpos-bo-location    (set by LocationSwitcher; BO mode override)
 *   2. rpos-device         (POS pairing; carries locationId)
 *   3. null                (no location yet — pre-pairing or unauthenticated)
 */
export function getActiveLocationSync() {
  try {
    const bo = JSON.parse(localStorage.getItem('rpos-bo-location') || 'null');
    if (bo) return bo;
  } catch { /* fall through */ }
  try {
    const dev = JSON.parse(localStorage.getItem('rpos-device') || 'null');
    if (dev?.locationId) return dev.locationId;
  } catch { /* fall through */ }
  return null;
}

/**
 * Wipe every location-scoped key from localStorage and sessionStorage. Reason
 * is logged so any unexplained state loss in production is traceable.
 */
export function purgeStaleLocationData(reason) {
  let wiped = 0;
  try {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('rpos-') && !TENANT_FENCE_KEEP.has(k)) toRemove.push(k);
    }
    toRemove.forEach(k => { localStorage.removeItem(k); wiped++; });
  } catch (e) {
    console.warn('[tenantFence] localStorage wipe failed:', e?.message || e);
  }
  try {
    const toRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith('rpos-') && !TENANT_FENCE_KEEP.has(k)) toRemove.push(k);
    }
    toRemove.forEach(k => { sessionStorage.removeItem(k); wiped++; });
  } catch (e) {
    console.warn('[tenantFence] sessionStorage wipe failed:', e?.message || e);
  }
  console.warn('[tenantFence] purged', wiped, 'stale keys —', reason);
}

/**
 * The boot-time + pair-time fence. Compares the currently-active location to
 * the last-recorded active-location tag. If they differ, purges all stale data.
 * Returns the activeLocId so callers can chain.
 *
 * Pass an explicit activeLocId when you know the value (e.g. immediately after
 * pairing). Pass undefined to have it read from localStorage.
 */
export function enforceTenantFence(activeLocId) {
  if (activeLocId === undefined) activeLocId = getActiveLocationSync();
  let lastActive = null;
  try { lastActive = localStorage.getItem('rpos-active-location'); } catch { /* fall through */ }

  if (activeLocId && lastActive && activeLocId !== lastActive) {
    purgeStaleLocationData('tenantFence: location changed ' + lastActive + ' -> ' + activeLocId);
  } else if (activeLocId && !lastActive) {
    // First-ever boot at this location, OR an upgrade from pre-v5.5.3 where the tag
    // didn't exist. Either way the localStorage state may be from a different
    // location — safest action is to wipe.
    purgeStaleLocationData('tenantFence: first boot tag missing, wiping for safety');
  }

  if (activeLocId) {
    try { localStorage.setItem('rpos-active-location', activeLocId); } catch { /* fall through */ }
  }
  return activeLocId;
}


// ──────────────────────────────────────────────────────────────────
// v4.7.1 — Back Office location switching
//
// The existing getLocationId() reads 'rpos-bo-location' from localStorage
// as a manual override. setLocationId writes to that key, clears the
// in-memory resolver cache, and emits a custom event so consumers can
// re-fetch their data.
//
// getAvailableLocations() returns every location the current authenticated
// user has access to via user_locations + a join to locations.
// ──────────────────────────────────────────────────────────────────

export const setLocationId = (locId) => {
  if (locId == null) {
    localStorage.removeItem('rpos-bo-location');
  } else {
    localStorage.setItem('rpos-bo-location', JSON.stringify(locId));
  }
  // Bust the cached resolved id so the next getLocationId() picks up the change.
  _resolvedLocationId = locId || null;
  // Notify consumers — the back office can listen for this and reload data.
  try { window.dispatchEvent(new CustomEvent('rpos-location-changed', { detail: { locationId: locId } })); } catch {}
  return locId;
};

/**
 * Returns the locations the current user has access to. Uses user_locations
 * join. Falls back to the user's profile location if user_locations is empty.
 * Mock-mode returns a single sentinel location.
 */
export const getAvailableLocations = async () => {
  if (isMock) return [{ id: 'loc-demo', name: 'Demo Location' }];
  if (!supabase) return [];
  try {
    const { data: { user } = {} } = await supabase.auth.getUser();
    if (!user) return [];
    // user_locations row(s) for this user
    const { data: links, error: e1 } = await supabase
      .from('user_locations')
      .select('location_id, role')
      .eq('user_id', user.id);
    if (e1 || !links) return [];
    if (links.length === 0) return [];
    const locIds = [...new Set(links.map(r => r.location_id).filter(Boolean))];
    if (locIds.length === 0) return [];
    const { data: locs, error: e2 } = await supabase
      .from('locations')
      .select('id, name, org_id')
      .in('id', locIds)
      .order('name');
    if (e2) return [];
    return locs || [];
  } catch (e) {
    console.warn('[supabase] getAvailableLocations failed:', e?.message || e);
    return [];
  }
};
