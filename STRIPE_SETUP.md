# Stripe Connect — setup guide for `feat/stripe-connect`

This branch adds the Stripe Connect platform-billing scaffold for POSUP merchant services. End-to-end test payment in sandbox after the deploy steps below.

## Architecture summary

- **Customer payments**: DIRECT charges on connected account. Merchant is merchant of record. Platform takes NO `application_fee` per transaction.
- **SaaS fees**: Option 2 — calculated monthly per location based on rolling GMV (cash + card + giftcard + tips, NOT netted of refunds). At period close, a Transfer skims the fee from the connected balance to platform balance before payout. Cron lives in next-session work.
- **Tier definitions**: Already in Platform DB via `get_plan_for_gmv()`. This branch adds `get_plan_and_fee_for_gmv()` that returns both tier and fee.
- **GMV bumping**: app code calls `increment_gmv(location_id, amount)` RPC after every closed_check finalize. Atomically updates `subscriptions.gmv_this_month` + auto-promotes plan if a tier boundary is crossed.
- **Currencies**: GBP for UK, USD for US. USD tier prices not yet set — `get_plan_and_fee_for_gmv` returns NULL fee for USD until you fill in.
- **Card-present**: M2 reader via Stripe Terminal Android SDK on Sunmi D3 Pro. The Sunmi APK calls `stripe-terminal-connection-token` for pairing tokens.

## Files in this branch

```
supabase-billing-schema.sql                    NEW migration for Platform DB
supabase/functions/
  stripe-webhook/                              Platform events
  stripe-webhook-connect/                      Connected account events
  stripe-link-merchant/                        Admin-manual paste-acct link
  stripe-create-payment-intent/                Direct-charge PI on connected acct
  stripe-terminal-connection-token/            M2 / Terminal SDK pairing tokens
src/lib/
  stripeClient.js                              Stripe.js loader + edge fn helpers
  billing.js                                   incrementGmv RPC wrapper
src/backoffice/sections/
  BillingManager.jsx                           Per-location Stripe status + GMV
  StripeTestHarness.jsx                        End-to-end PI test (TEST MODE ONLY)
src/backoffice/BackOfficeApp.jsx               (modified) NAV + routes
package.json                                   (modified) +@stripe/stripe-js, +@stripe/react-stripe-js
```

## Deploy steps (in order)

### 1. Run the SQL migration on PLATFORM DB

Project: `yhzjgyrkyjabvhblqxzu` (Platform DB). Paste `supabase-billing-schema.sql` into SQL editor → run.

It is **idempotent** (uses `if not exists`, `add column if not exists`). It extends `subscriptions` with Stripe Connect fields, adds `billing_invoices` and `stripe_webhook_events` tables, and adds three functions (`get_plan_and_fee_for_gmv`, `increment_gmv`, `close_billing_period`).

### 2. Set Edge Function secrets on the OPS project

Functions deploy to Ops (`tbetcegmszzotrwdtqhi`) alongside `create-user`. They reach the Platform DB via service role.

```bash
supabase link --project-ref tbetcegmszzotrwdtqhi
supabase secrets set STRIPE_SECRET_KEY=sk_test_51TTR9A...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...                  # platform endpoint
supabase secrets set STRIPE_CONNECT_WEBHOOK_SECRET=whsec_...          # connect endpoint
supabase secrets set PLATFORM_SUPABASE_URL=https://yhzjgyrkyjabvhblqxzu.supabase.co
supabase secrets set PLATFORM_SUPABASE_SERVICE_ROLE_KEY=<platform service role>
# SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY auto-injected (Ops)
```

### 3. Deploy functions

```bash
supabase functions deploy stripe-webhook                  --no-verify-jwt
supabase functions deploy stripe-webhook-connect          --no-verify-jwt
supabase functions deploy stripe-link-merchant
supabase functions deploy stripe-create-payment-intent
supabase functions deploy stripe-terminal-connection-token
```

`--no-verify-jwt` on webhook fns is required: Stripe doesn't send a Supabase JWT, it signs with `stripe-signature`. The other fns verify the user JWT in code.

### 4. Update Stripe webhook endpoint URLs

In `dashboard.stripe.com/test/webhooks`:

- Platform endpoint → `https://tbetcegmszzotrwdtqhi.supabase.co/functions/v1/stripe-webhook`
- Connect endpoint → `https://tbetcegmszzotrwdtqhi.supabase.co/functions/v1/stripe-webhook-connect`

Confirm "Listen to events on Connected accounts" is ticked on the Connect endpoint.

### 5. Frontend env vars (Vercel)

In Vercel dashboard → Environment Variables, add:

```
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_51TTR9A...
```

`VITE_SUPABASE_URL`, `VITE_PLATFORM_SUPABASE_URL`, `VITE_PLATFORM_SUPABASE_ANON_KEY` should already be set per existing `lib/supabase.js`.

### 6. Merge + deploy

```bash
git checkout main
git merge feat/stripe-connect
# Per CLAUDE.md, before deploying main:
#   - bump src/lib/version.js (e.g. 5.5.38 if continuing the kiosk-sprint stream, or new version per your scheme)
#   - add CHANGELOG entry at top of array in src/App.jsx
#   - npm run build
git push origin main
```

Vercel auto-deploys.

## End-to-end test (after deploy)

1. **Create a test connected account in Stripe.** Dashboard → `dashboard.stripe.com/test/connect/accounts` → "Create" → Express → Country: UK → fake business details. Note the `acct_...` ID.

2. **Onboard to charges-enabled.** Stripe shows an Express onboarding link in test mode with a "use test data" autofill. Click through. Refresh — `charges_enabled` flips to true.

3. **Link to a POSUP location.** Open BO → Billing → click "Link Stripe account" on a location → paste the `acct_...`. Card flips to "Live (charges enabled)" with period stats.

4. **Fire a test payment.** BO → Stripe test → pick the linked location → £12.34 → "Create PaymentIntent" → enter `4242 4242 4242 4242` / any future expiry / any CVC → Confirm. Should see `status: succeeded`.

5. **Verify the loop:**
   - Stripe dashboard → connected account → Payments → £12.34 charge present
   - Platform DB → `stripe_webhook_events` → `payment_intent.succeeded` row, `processed_at` set
   - Platform DB → `subscriptions` row for that location → `stripe_last_webhook_at` updated

If all five pass, the platform → fns → Stripe → webhook → DB loop is alive in test mode.

## Wiring real payments into kiosk/POS (next session)

In `src/store/index.js`, after `recordClosedCheck` (and walk-in variant) inserts the row:

```js
import { incrementGmv, computeGmvAmount } from '../lib/billing';

// after the closed_check row is inserted successfully:
const platformLocId = /* resolved from Platform DB user_profiles.location_id or device pairing */;
await incrementGmv({
  locationId: platformLocId,
  amount: computeGmvAmount(closedCheck),
});
```

Note: `closed_checks` lives in Ops DB with `location_id` as text (legacy, may be `loc-demo`). `subscriptions.location_id` in Platform DB is UUID. App code must map between them — typically the Platform UUID is the canonical id and the Ops text id is the same UUID stringified for Foster City etc. Verify your mapping.

For the card payment flow specifically, replace any "Simulate paid" demo with:
1. Call `createPaymentIntent({...})` from `lib/stripeClient.js`
2. Online: use Stripe.js `confirmCardPayment(clientSecret)` (or PaymentElement)
3. Card-present (M2): use Stripe Terminal Android SDK `collectPaymentMethod()` then `processPayment()`
4. Webhook fires async, updates closed_check via metadata.closed_check_id

## Open follow-ups (out of scope for this branch)

- USD tier prices — fill in `get_plan_and_fee_for_gmv` USD branch
- `debit_negative_balances` policy for cash-heavy merchants
- Stripe Terminal Android SDK Kotlin TokenProvider in Sunmi APK (server-side endpoint is ready)
- `stripe-billing-skim` cron — runs at period close, fires Transfer
- Express onboarding UI (admin-manual paste covers Phase 1)
- US Connect platform onboarding for UK Ltd → US merchants (Stripe sales gate)
- Tier override UI in BillingManager
- Skim history / invoice list in BillingManager
- GMV bump wiring into existing `recordClosedCheck` path
