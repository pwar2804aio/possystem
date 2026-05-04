// supabase/functions/stripe-link-merchant/index.ts
// Super-admin flow: paste an existing acct_... and link it to a location.
// Validates the account exists in Stripe, fetches current state, and writes
// to the subscriptions row for that location (Platform DB).
//
// Auth: requires super_admin. Verified via Platform DB user_profiles.role.
//
// Body: { stripe_account_id: "acct_...", location_id: "uuid" }

import Stripe from 'https://esm.sh/stripe@17.4.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-11-20.acacia',
  httpClient: Stripe.createFetchHttpClient(),
});

const platformDb = createClient(
  Deno.env.get('PLATFORM_SUPABASE_URL') ?? '',
  Deno.env.get('PLATFORM_SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { autoRefreshToken: false, persistSession: false } },
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return json({ error: 'method not allowed' }, 405);
  }

  // Auth
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);

  const { data: { user: caller } } = await platformDb.auth.getUser(authHeader.replace('Bearer ', ''));
  if (!caller) return json({ error: 'Invalid token' }, 401);

  const { data: profile } = await platformDb.from('user_profiles')
    .select('role').eq('id', caller.id).single();
  if (profile?.role !== 'super_admin') return json({ error: 'Requires super_admin' }, 403);

  // Body
  let body: { stripe_account_id?: string; location_id?: string };
  try { body = await req.json(); } catch { return json({ error: 'invalid json' }, 400); }
  const { stripe_account_id, location_id } = body;
  if (!stripe_account_id || !location_id) return json({ error: 'stripe_account_id and location_id required' }, 400);
  if (!stripe_account_id.startsWith('acct_')) return json({ error: 'stripe_account_id must start with acct_' }, 400);

  // Validate location exists in Platform DB
  const { data: loc, error: locErr } = await platformDb.from('locations')
    .select('id, org_id, currency').eq('id', location_id).single();
  if (locErr || !loc) return json({ error: 'location not found' }, 404);

  // Fetch the account from Stripe
  let acct: Stripe.Account;
  try {
    acct = await stripe.accounts.retrieve(stripe_account_id);
  } catch (e) {
    return json({ error: `stripe account fetch failed: ${(e as Error).message}` }, 400);
  }

  // Ensure a subscription row exists for this location
  let { data: sub } = await platformDb.from('subscriptions').select('id').eq('location_id', location_id).maybeSingle();
  if (!sub) {
    const { data: created, error: createErr } = await platformDb.from('subscriptions').insert({
      org_id: loc.org_id,
      location_id,
      plan: 'free',
      gmv_this_month: 0,
      monthly_fee: 0,
      billing_period_start: new Date().toISOString().slice(0, 10),
    }).select('id').single();
    if (createErr) return json({ error: `failed to create subscription row: ${createErr.message}` }, 500);
    sub = created;
  }

  // Update the subscription with Stripe Connect fields
  const { error: upErr } = await platformDb.from('subscriptions').update({
    stripe_account_id: acct.id,
    stripe_account_link_method: 'admin_manual',
    charges_enabled: acct.charges_enabled,
    payouts_enabled: acct.payouts_enabled,
    details_submitted: acct.details_submitted,
    stripe_account_country: acct.country ?? null,
    stripe_default_currency: acct.default_currency ?? null,
    stripe_capabilities: acct.capabilities ?? {},
    stripe_requirements: acct.requirements ?? null,
    stripe_linked_at: new Date().toISOString(),
    stripe_linked_by_user_id: caller.id,
  }).eq('id', sub.id);

  if (upErr) return json({ error: `update failed: ${upErr.message}` }, 500);

  return json({
    success: true,
    subscription_id: sub.id,
    account: {
      id: acct.id,
      country: acct.country,
      default_currency: acct.default_currency,
      charges_enabled: acct.charges_enabled,
      payouts_enabled: acct.payouts_enabled,
      details_submitted: acct.details_submitted,
    },
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
