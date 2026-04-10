import { createClient } from '@supabase/supabase-js';

const url  = import.meta.env.VITE_SUPABASE_URL  || '';
const key  = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const mock = import.meta.env.VITE_USE_MOCK === 'true' || !url || !key;

// In mock mode the client is null — all store functions fall back to localStorage/BroadcastChannel
export const supabase = mock ? null : createClient(url, key, {
  realtime: { params: { eventsPerSecond: 20 } },
  auth: { persistSession: true, autoRefreshToken: true },
});

export const isMock = mock;

// Helper: run a query, return { data, error }
// Falls back gracefully when supabase is null (mock mode)
export async function query(fn) {
  if (!supabase) return { data: null, error: new Error('Mock mode — Supabase not configured') };
  try {
    return await fn(supabase);
  } catch (error) {
    console.error('[Supabase]', error);
    return { data: null, error };
  }
}

export const LOCATION_ID = 'loc-demo'; // replaced by real ID after pairing
export const ORG_ID      = 'org-demo';
