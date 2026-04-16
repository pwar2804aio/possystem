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
