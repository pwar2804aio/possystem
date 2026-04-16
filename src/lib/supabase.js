import { createClient } from '@supabase/supabase-js';

// ── Ops DB (POS operational data) ────────────────────────────────────────────
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

// ── Platform DB (user/company/location management) ────────────────────────────
const PLATFORM_URL  = import.meta.env.VITE_PLATFORM_SUPABASE_URL  || '';
const PLATFORM_ANON = import.meta.env.VITE_PLATFORM_SUPABASE_ANON_KEY || '';
export const platformSupabase = (PLATFORM_URL && PLATFORM_ANON)
  ? createClient(PLATFORM_URL, PLATFORM_ANON, {
      auth: { persistSession: false }, // auth lives in ops DB, platform is data-only
    })
  : null;

// Dynamic location ID — resolved from Platform DB first, then fallbacks
let _resolvedLocationId = null;

export const getLocationId = async () => {
  if (isMock) return 'loc-demo';
  if (_resolvedLocationId) return _resolvedLocationId;

  // Back office explicit location override (from location switcher)
  try {
    const boLoc = JSON.parse(localStorage.getItem('rpos-bo-location') || 'null');
    if (boLoc) { _resolvedLocationId = boLoc; return boLoc; }
  } catch {}

  // 1. Try Platform DB — look up user's ops_location_id
  if (platformSupabase && supabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await platformSupabase
          .from('user_access')
          .select('locations(ops_location_id)')
          .eq('user_id', user.id)
          .limit(1)
          .single();
        const opsLocId = data?.locations?.ops_location_id;
        if (opsLocId) {
          _resolvedLocationId = opsLocId;
          return opsLocId;
        }
      }
    } catch {}
  }

  // 2. Fallback: ops DB user_profiles (legacy — keeps existing installs working)
  if (supabase) {
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
  }

  // 3. POS fallback: paired device locationId
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

// Legacy constant — only safe to use in mock mode or before auth is ready
export const LOCATION_ID = 'loc-demo';
