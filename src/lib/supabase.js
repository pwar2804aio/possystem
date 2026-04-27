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

export const setResolvedLocationId = (id) => { _resolvedLocationId = id; };
export const clearResolvedLocationId = () => { _resolvedLocationId = null; };
export const LOCATION_ID = 'loc-demo';


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
