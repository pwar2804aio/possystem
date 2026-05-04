// ============================================================
// src/lib/customerLookup.js — phone-keyed customer lookup for kiosk
// ============================================================
// Looks up an existing customer record by normalized phone, scoped to the
// kiosk's org. Returns the customer's saved name + email so the kiosk can
// pre-fill those fields, plus a `rewards` slot that the loyalty system will
// populate when it ships.
//
// Today (v5.5.37): rewards / credit / discounts are STUBS. They always
// return empty / zero. The contract is locked in here so that when loyalty
// gets built, only this file changes — the kiosk UI doesn't need rewiring.
//
// Loyalty integration TODO (separate sprint):
//   - Add a `customer_rewards` table (or column on customers): { reward_id,
//     customer_id, label, value, expires_at, redeemed_at }
//   - In fetchCustomerByPhone(): SELECT eligible rewards alongside the
//     customer record, return them in the `rewards: []` array
//   - Add a `loyaltyCredit` numeric balance — extend the return shape with
//     { credit: number } when the loyalty wallet is built
//   - The kiosk UI in ScreenDetails already reserves layout space for
//     "Welcome back, NAME" + a rewards/credit list block — it only renders
//     when fetchCustomerByPhone returns a knownCustomer:true with non-empty
//     rewards/credit
//
// Phone normalization matches store/index.js _normalisePhone exactly so the
// same key resolves whether saved via POS or kiosk.
// ============================================================

import { supabase, getLocationId } from './supabase';

// Mirror of store._normalisePhone — kept local so this util can be used
// without depending on the Zustand store (the kiosk's customer-details
// screen runs without store hydration in some flows).
export function normalisePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/[^\d+]/g, '');
  if (!digits) return null;
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('07') && digits.length === 11) return '+44' + digits.slice(1);
  if (digits.startsWith('44')) return '+' + digits;
  return digits;
}

// Cache the org_id for the active location so we don't refetch on every keystroke.
let _cachedLocId = null;
let _cachedOrgId = null;

async function resolveOrgIdForLocation(locId) {
  if (!locId || !supabase) return null;
  if (_cachedLocId === locId && _cachedOrgId) return _cachedOrgId;
  try {
    const { data, error } = await supabase
      .from('locations')
      .select('org_id')
      .eq('id', locId)
      .single();
    if (error) {
      console.warn('[customerLookup] failed to resolve org_id:', error.message);
      return null;
    }
    _cachedLocId = locId;
    _cachedOrgId = data?.org_id || null;
    return _cachedOrgId;
  } catch (e) {
    console.warn('[customerLookup] resolveOrgIdForLocation error:', e?.message || e);
    return null;
  }
}

/**
 * Look up a customer by phone in the current org. Returns null if no match
 * (or if lookup fails for any reason — caller should treat null and a
 * not-found result the same way).
 *
 * @param {string} rawPhone — phone as the customer typed it
 * @param {string} [locationId] — optional, defaults to getLocationId()
 * @returns {Promise<null | {
 *   customerId: string,
 *   name: string,
 *   email: string|null,
 *   marketingOptIn: boolean,
 *   knownCustomer: true,
 *   rewards: Array<{id: string, label: string, value: number}>, // STUB: always [] today
 *   credit: number,                                              // STUB: always 0 today
 * }>}
 */
export async function fetchCustomerByPhone(rawPhone, locationId) {
  const phoneN = normalisePhone(rawPhone);
  if (!phoneN || phoneN.length < 7) return null;

  const locId = locationId || await getLocationId();
  if (!locId) return null;

  const orgId = await resolveOrgIdForLocation(locId);
  if (!orgId) return null;

  try {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, email, marketing_opt_in')
      .eq('org_id', orgId)
      .eq('phone', phoneN)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) {
      console.warn('[customerLookup] query failed:', error.message);
      return null;
    }
    if (!data) return null;
    return {
      customerId: data.id,
      name: data.name || '',
      email: data.email || null,
      marketingOptIn: !!data.marketing_opt_in,
      knownCustomer: true,
      // STUB. Loyalty system not built yet. When it ships, populate from a
      // sibling SELECT or extend this function to JOIN against rewards.
      rewards: [],
      credit: 0,
    };
  } catch (e) {
    console.warn('[customerLookup] unexpected error:', e?.message || e);
    return null;
  }
}
