-- ═══════════════════════════════════════════════════════════════════════════
-- Restaurant OS — Stripe Connect & Billing Schema (Platform DB)
-- Run this in the PLATFORM Supabase project (yhzjgyrkyjabvhblqxzu),
-- AFTER supabase-auth-schema.sql.
--
-- Architecture:
--   - Customer payments: DIRECT charges on connected account.
--     Merchant is merchant of record. Platform takes NO application_fee.
--   - SaaS fees: Option 2 — calculate per location at period close, fire a
--     Transfer from connected balance to platform balance before payout.
--   - GMV definition: total processed value (cash + card + giftcard + tips),
--     NOT netted of refunds. Tracked rolling on subscriptions.gmv_this_month
--     and snapshotted to billing_invoices at period close.
--   - Tiers: highest reached during period bills for full month. New
--     accounts start 'free'. No first-month proration.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Extend subscriptions with Stripe Connect fields ───────────────────────
-- (Platform DB already has subscriptions per supabase-auth-schema.sql)
alter table subscriptions add column if not exists stripe_account_id text;
alter table subscriptions add column if not exists stripe_account_link_method text
  check (stripe_account_link_method in ('express_onboarding','admin_manual') or stripe_account_link_method is null);
alter table subscriptions add column if not exists charges_enabled boolean default false;
alter table subscriptions add column if not exists payouts_enabled boolean default false;
alter table subscriptions add column if not exists details_submitted boolean default false;
alter table subscriptions add column if not exists stripe_account_country text;
alter table subscriptions add column if not exists stripe_default_currency text;
alter table subscriptions add column if not exists stripe_capabilities jsonb default '{}'::jsonb;
alter table subscriptions add column if not exists stripe_requirements jsonb;
alter table subscriptions add column if not exists stripe_linked_at timestamptz;
alter table subscriptions add column if not exists stripe_linked_by_user_id uuid references user_profiles(id);
alter table subscriptions add column if not exists stripe_last_webhook_at timestamptz;

create unique index if not exists idx_subscriptions_stripe_account
  on subscriptions(stripe_account_id) where stripe_account_id is not null;

-- ── Billing periods + invoices ────────────────────────────────────────────
-- One billing_invoices row per location per closed period. Stores the
-- snapshot of GMV at close, the tier reached, the fee, and the Stripe
-- transfer that skimmed the fee from the connected balance.

create table if not exists billing_invoices (
  id uuid default uuid_generate_v4() primary key,
  org_id uuid references organisations(id) on delete cascade,
  location_id uuid references locations(id) on delete cascade,
  subscription_id uuid references subscriptions(id) on delete cascade,

  period_start date not null,
  period_end date not null,                     -- exclusive
  billing_currency text not null check (billing_currency in ('gbp','usd')),

  gmv_total numeric(12,2) not null,             -- snapshot at close
  tier text not null,                            -- free|starter|growth|scale|enterprise
  fee_amount numeric(8,2) not null,              -- per-location fee in billing_currency

  status text not null default 'draft'
    check (status in ('draft','approved','skim_pending','skim_complete','skim_failed','manual_paid','void')),

  -- Tier override (super_admin: comp month, support credit, etc.)
  override_tier text,
  override_reason text,
  override_by_user_id uuid references user_profiles(id),

  -- Stripe Transfer record (Option 2 skim)
  stripe_transfer_id text,
  stripe_transfer_amount bigint,                 -- minor units
  stripe_transfer_currency text,
  skim_attempted_at timestamptz,
  skim_completed_at timestamptz,
  skim_failure_code text,
  skim_failure_message text,
  skim_attempts integer default 0,

  -- Fallback when connected balance can't cover the skim
  fallback_method text check (fallback_method in ('manual','card_on_file','direct_invoice') or fallback_method is null),

  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (location_id, period_start)
);

create index if not exists idx_billing_invoices_status   on billing_invoices(status);
create index if not exists idx_billing_invoices_location on billing_invoices(location_id);
create index if not exists idx_billing_invoices_org      on billing_invoices(org_id);

-- ── Stripe webhook event log (idempotency + audit) ────────────────────────
create table if not exists stripe_webhook_events (
  id text primary key,                           -- evt_...
  type text not null,
  livemode boolean not null,
  account_id text,                               -- connected acct, if event from one
  payload jsonb not null,
  received_at timestamptz default now(),
  processed_at timestamptz,
  processing_error text
);

create index if not exists idx_swe_type     on stripe_webhook_events(type);
create index if not exists idx_swe_received on stripe_webhook_events(received_at desc);
create index if not exists idx_swe_account  on stripe_webhook_events(account_id);

-- ── Updated get_plan_for_gmv: returns tier + fee in one call ──────────────
-- Existing function returns just the tier name. Add a second function that
-- returns both tier and fee for a given GMV + currency.

create or replace function get_plan_and_fee_for_gmv(gmv numeric, currency text default 'gbp')
returns table (tier text, fee numeric) as $$
begin
  if gmv <= 5000 then
    tier := 'free';
    fee := 0;
  elsif gmv <= 8000 then
    tier := 'starter';
    fee := case when currency = 'usd' then null::numeric else 99 end;
  elsif gmv <= 10000 then
    tier := 'growth';
    fee := case when currency = 'usd' then null::numeric else 149 end;
  elsif gmv <= 20000 then
    tier := 'scale';
    fee := case when currency = 'usd' then null::numeric else 199 end;
  else
    tier := 'enterprise';
    fee := case when currency = 'usd' then null::numeric else 249 end;
  end if;
  return next;
end;
$$ language plpgsql immutable;

-- ── increment_gmv RPC: bump rolling GMV on subscriptions row ──────────────
-- Called from app code on every closed_check finalize (Ops DB).
-- Atomically updates subscriptions.gmv_this_month for the location.
-- Auto-promotes plan if the new GMV crosses a tier boundary.

create or replace function increment_gmv(
  p_location_id uuid,
  p_amount numeric                                -- in major units (£12.34, not pence)
) returns jsonb as $$
declare
  v_sub subscriptions%rowtype;
  v_new_gmv numeric;
  v_new_plan text;
  v_new_fee numeric;
  v_currency text;
begin
  -- Lock the subscription row
  select * into v_sub
    from subscriptions
   where location_id = p_location_id
   for update;

  if not found then
    -- Auto-create a free subscription for this location
    insert into subscriptions (org_id, location_id, plan, gmv_this_month, billing_period_start, monthly_fee)
    select org_id, p_location_id, 'free', 0,
           (date_trunc('month', now() at time zone coalesce(timezone, 'Europe/London'))::date),
           0
      from locations where id = p_location_id
    returning * into v_sub;
  end if;

  -- Get currency (subscriptions doesn't store it; pull from location)
  select coalesce(currency, 'GBP') into v_currency from locations where id = p_location_id;
  v_currency := lower(v_currency);

  v_new_gmv := coalesce(v_sub.gmv_this_month, 0) + coalesce(p_amount, 0);

  -- Highest-tier-wins: only PROMOTE plan, never demote within a period
  select tier, fee into v_new_plan, v_new_fee
    from get_plan_and_fee_for_gmv(v_new_gmv, v_currency);

  -- If current plan is higher than calculated, keep current
  if v_sub.plan in ('enterprise')
     or (v_sub.plan = 'scale'      and v_new_plan in ('free','starter','growth'))
     or (v_sub.plan = 'growth'     and v_new_plan in ('free','starter'))
     or (v_sub.plan = 'starter'    and v_new_plan = 'free')
  then
    v_new_plan := v_sub.plan;
    v_new_fee  := v_sub.monthly_fee;
  end if;

  update subscriptions
     set gmv_this_month = v_new_gmv,
         plan = v_new_plan,
         monthly_fee = v_new_fee,
         updated_at = now()
   where id = v_sub.id;

  return jsonb_build_object(
    'subscription_id', v_sub.id,
    'gmv_this_month', v_new_gmv,
    'plan', v_new_plan,
    'monthly_fee', v_new_fee
  );
end;
$$ language plpgsql security definer;

grant execute on function increment_gmv(uuid, numeric) to authenticated, anon, service_role;

-- ── close_billing_period RPC: snapshot GMV → invoice, reset rolling ───────
-- Called from a monthly cron job at period boundary (next session).
-- Creates the billing_invoices row with current GMV + tier, then resets
-- gmv_last_month / gmv_this_month and rolls the period_start forward.

create or replace function close_billing_period(p_location_id uuid)
returns jsonb as $$
declare
  v_sub subscriptions%rowtype;
  v_invoice_id uuid;
  v_currency text;
  v_period_end date;
begin
  select * into v_sub from subscriptions where location_id = p_location_id for update;
  if not found then return jsonb_build_object('error','no_subscription'); end if;

  select coalesce(lower(currency),'gbp') into v_currency from locations where id = p_location_id;
  v_period_end := (coalesce(v_sub.billing_period_start, current_date) + interval '1 month')::date;

  insert into billing_invoices (
    org_id, location_id, subscription_id,
    period_start, period_end, billing_currency,
    gmv_total, tier, fee_amount, status
  ) values (
    v_sub.org_id, p_location_id, v_sub.id,
    coalesce(v_sub.billing_period_start, current_date - interval '1 month'),
    v_period_end, v_currency,
    coalesce(v_sub.gmv_this_month, 0),
    v_sub.plan,
    coalesce(v_sub.monthly_fee, 0),
    'draft'
  )
  on conflict (location_id, period_start) do nothing
  returning id into v_invoice_id;

  -- Roll the subscription forward
  update subscriptions
     set gmv_last_month = coalesce(gmv_this_month, 0),
         gmv_this_month = 0,
         plan = 'free',                                  -- new period starts FOC
         monthly_fee = 0,
         billing_period_start = v_period_end,
         updated_at = now()
   where id = v_sub.id;

  return jsonb_build_object('invoice_id', v_invoice_id, 'subscription_id', v_sub.id);
end;
$$ language plpgsql security definer;

grant execute on function close_billing_period(uuid) to service_role;

-- ── RLS policies ──────────────────────────────────────────────────────────
alter table billing_invoices enable row level security;
alter table stripe_webhook_events enable row level security;

create policy "users read own invoices" on billing_invoices
  for select using (
    org_id in (select org_id from user_profiles where id = auth.uid())
  );

create policy "super_admin all invoices" on billing_invoices
  for all using (
    exists (select 1 from user_profiles where id = auth.uid() and role = 'super_admin')
  );

create policy "super_admin webhook events" on stripe_webhook_events
  for all using (
    exists (select 1 from user_profiles where id = auth.uid() and role = 'super_admin')
  );

-- ── Updated-at triggers ───────────────────────────────────────────────────
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_inv_updated on billing_invoices;
create trigger trg_inv_updated before update on billing_invoices
  for each row execute function set_updated_at();
