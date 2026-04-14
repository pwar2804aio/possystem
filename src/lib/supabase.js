import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || '';
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const isMock  = import.meta.env.VITE_USE_MOCK === 'true' || !SUPABASE_URL || !SUPABASE_ANON;

export const supabase = isMock ? null : createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession: true,      // keep session across refreshes
    autoRefreshToken: true,
    storageKey: 'rpos-auth',
  },
});

// Dynamic location ID — resolved from logged-in user's profile
// Falls back to 'loc-demo' only in mock mode
let _resolvedLocationId = null;

export const getLocationId = async () => {
  if (isMock) return 'loc-demo';
  if (_resolvedLocationId) return _resolvedLocationId;
  if (!supabase) return null;

  // Try authenticated user first (back office)
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

  // Fallback: paired device in localStorage (POS has no email auth session)
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
