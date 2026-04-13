import { createClient } from '@supabase/supabase-js';

const url  = import.meta.env.VITE_SUPABASE_URL  || '';
const key  = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const mock = import.meta.env.VITE_USE_MOCK === 'true' || !url || !key;

let supabase = null;
try {
  if (!mock) {
    supabase = createClient(url, key, {
      realtime: { params: { eventsPerSecond: 20 } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
} catch (e) {
  console.warn('[Supabase] init failed, running in mock mode:', e.message);
}

export { supabase };
export const isMock = !supabase;
export const LOCATION_ID = 'loc-demo';
export const ORG_ID      = 'org-demo';

export async function query(fn) {
  if (!supabase) return { data: null, error: new Error('Mock mode') };
  try { return await fn(supabase); } catch (error) { return { data: null, error }; }
}
