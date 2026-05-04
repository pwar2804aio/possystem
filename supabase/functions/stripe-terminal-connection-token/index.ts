// supabase/functions/stripe-terminal-connection-token/index.ts
// Issues a Stripe Terminal connection token scoped to the merchant's
// connected account. The Stripe Terminal Android SDK calls this via a
// TokenProvider before pairing with a reader (Stripe M2, WisePOS, S700, etc).
//
// Body: { location_id: "uuid" }
// Returns: { secret: "pst_..." }

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
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);
  const { data: { user: caller } } = await platformDb.auth.getUser(authHeader.replace('Bearer ', ''));
  if (!caller) return json({ error: 'Invalid token' }, 401);

  let body: { location_id?: string };
  try { body = await req.json(); } catch { return json({ error: 'invalid json' }, 400); }
  if (!body.location_id) return json({ error: 'location_id required' }, 400);

  const { data: profile } = await platformDb.from('user_profiles')
    .select('role, org_id').eq('id', caller.id).single();
  const { data: loc, error: locErr } = await platformDb.from('locations')
    .select('id, org_id').eq('id', body.location_id).single();
  if (locErr || !loc) return json({ error: 'location not found' }, 404);
  if (profile?.role !== 'super_admin' && profile?.org_id !== loc.org_id) {
    return json({ error: 'not a member of this location\'s org' }, 403);
  }

  const { data: sub, error: subErr } = await platformDb.from('subscriptions')
    .select('stripe_account_id, charges_enabled')
    .eq('location_id', body.location_id).single();
  if (subErr || !sub?.stripe_account_id) return json({ error: 'no connected stripe account' }, 400);
  if (!sub.charges_enabled) return json({ error: 'connected account cannot accept charges yet' }, 400);

  try {
    const token = await stripe.terminal.connectionTokens.create({}, { stripeAccount: sub.stripe_account_id });
    return json({ secret: token.secret });
  } catch (e) {
    return json({ error: `stripe error: ${(e as Error).message}` }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
