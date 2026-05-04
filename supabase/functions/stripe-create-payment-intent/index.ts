// supabase/functions/stripe-create-payment-intent/index.ts
// Creates a DIRECT-charge PaymentIntent on a merchant's connected account.
// Used for both online (Stripe.js confirm) and card-present (Terminal SDK).
//
// Direct charges = merchant is merchant of record. Platform takes NO
// application_fee per transaction. SaaS fees are collected separately via
// Transfer skim before payout.
//
// Body:
//   {
//     location_id: "uuid",
//     amount_minor: 1234,          // total in pence/cents
//     currency: "gbp" | "usd",
//     payment_method_types: ["card"] | ["card_present"],
//     capture_method: "automatic" | "manual",   default automatic
//     closed_check_id?: "uuid",                  // POSUP order id (echoed in metadata)
//     description?: "Order R42",
//     statement_descriptor_suffix?: "POSUP",     // max 22 chars
//     metadata?: {...}
//   }
//
// Returns: { client_secret, payment_intent_id, status, stripe_account }

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

interface Body {
  location_id?: string;
  amount_minor?: number;
  currency?: 'gbp' | 'usd';
  payment_method_types?: string[];
  capture_method?: 'automatic' | 'manual';
  closed_check_id?: string;
  description?: string;
  statement_descriptor_suffix?: string;
  metadata?: Record<string, string>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  // Auth — any authenticated org member of the location
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);

  const { data: { user: caller } } = await platformDb.auth.getUser(authHeader.replace('Bearer ', ''));
  if (!caller) return json({ error: 'Invalid token' }, 401);

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: 'invalid json' }, 400); }

  const {
    location_id,
    amount_minor,
    currency,
    payment_method_types,
    capture_method = 'automatic',
    closed_check_id,
    description,
    statement_descriptor_suffix,
    metadata = {},
  } = body;

  if (!location_id) return json({ error: 'location_id required' }, 400);
  if (!amount_minor || amount_minor <= 0) return json({ error: 'amount_minor must be > 0' }, 400);
  if (currency !== 'gbp' && currency !== 'usd') return json({ error: 'currency must be gbp or usd' }, 400);
  if (!payment_method_types?.length) return json({ error: 'payment_method_types required' }, 400);

  // Verify caller is in the location's org (super_admin bypasses)
  const { data: profile } = await platformDb.from('user_profiles')
    .select('role, org_id').eq('id', caller.id).single();

  const { data: loc, error: locErr } = await platformDb.from('locations')
    .select('id, org_id').eq('id', location_id).single();
  if (locErr || !loc) return json({ error: 'location not found' }, 404);

  if (profile?.role !== 'super_admin' && profile?.org_id !== loc.org_id) {
    return json({ error: 'not a member of this location\'s org' }, 403);
  }

  // Lookup connected account from subscriptions row
  const { data: sub, error: subErr } = await platformDb.from('subscriptions')
    .select('stripe_account_id, charges_enabled')
    .eq('location_id', location_id).single();

  if (subErr || !sub?.stripe_account_id) {
    return json({ error: 'location has no connected Stripe account' }, 400);
  }
  if (!sub.charges_enabled) {
    return json({ error: 'connected account cannot accept charges yet (onboarding incomplete)' }, 400);
  }

  // Create the PaymentIntent on the connected account (direct charge)
  let pi: Stripe.PaymentIntent;
  try {
    pi = await stripe.paymentIntents.create(
      {
        amount: amount_minor,
        currency,
        payment_method_types: payment_method_types as Stripe.PaymentIntentCreateParams.PaymentMethodType[],
        capture_method,
        description,
        statement_descriptor_suffix,
        metadata: {
          ...metadata,
          location_id,
          ...(closed_check_id ? { closed_check_id } : {}),
          posup_user_id: caller.id,
        },
      },
      { stripeAccount: sub.stripe_account_id },
    );
  } catch (e) {
    const err = e as Stripe.errors.StripeError;
    return json({
      error: `stripe error: ${err.message}`,
      code: err.code,
      type: err.type,
    }, 400);
  }

  return json({
    success: true,
    client_secret: pi.client_secret,
    payment_intent_id: pi.id,
    status: pi.status,
    stripe_account: sub.stripe_account_id,
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
