// src/lib/billing.js
// Bumps GMV on the Platform DB subscriptions row after every closed_check
// finalize. Call from store/index.js recordClosedCheck (and walk-in variant).
//
// GMV = total processed value (cash + card + giftcard + tips), NOT netted of
// refunds. Bump regardless of payment method.
//
// Uses platformSupabase (Platform DB) — billing tables live there per ADR-002.

import { platformSupabase } from './supabase';

/**
 * Increment GMV for a location. Atomically updates subscriptions.gmv_this_month
 * and auto-promotes plan if a tier boundary is crossed.
 *
 * @param {object} args
 * @param {string} args.locationId  - Platform DB locations.id (uuid)
 * @param {number} args.amount       - Amount in major units (£12.34, not pence)
 * @returns {Promise<{subscription_id, gmv_this_month, plan, monthly_fee} | null>}
 */
export async function incrementGmv({ locationId, amount }) {
  if (!platformSupabase) {
    console.warn('[billing] platformSupabase not configured (missing VITE_PLATFORM_SUPABASE_*)');
    return null;
  }
  if (!locationId) {
    console.warn('[billing] incrementGmv missing locationId');
    return null;
  }
  if (!amount || amount <= 0) return null;

  const { data, error } = await platformSupabase.rpc('increment_gmv', {
    p_location_id: locationId,
    p_amount: amount,
  });
  if (error) {
    console.error('[billing] increment_gmv RPC failed', error);
    return null;
  }
  return data;
}

/**
 * Take a closed_check object and compute the GMV amount to bump.
 * Includes everything processed regardless of method.
 *
 * Adapt field names if your closed_checks schema differs.
 */
export function computeGmvAmount(closedCheck) {
  if (!closedCheck) return 0;
  // closed_checks total is typically in major units already
  const total = Number(closedCheck.total ?? closedCheck.total_minor ?? 0);
  if (closedCheck.total_minor != null && closedCheck.total == null) {
    return total / 100; // legacy minor-units row
  }
  return total;
}
