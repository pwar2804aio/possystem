-- ═══════════════════════════════════════════════════════════════════════════
-- Restaurant OS — Auth & Multi-Tenant Schema
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Organisations (restaurant groups / companies) ─────────────────────────
create table if not exists organisations (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  slug text unique,                        -- dougboy-donuts
  status text default 'active',           -- active | suspended | trial
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Locations (individual sites within an org) ────────────────────────────
create table if not exists locations (
  id uuid default uuid_generate_v4() primary key,
  org_id uuid references organisations(id) on delete cascade,
  name text not null,                      -- Oxford Street
  address text,
  timezone text default 'Europe/London',
  currency text default 'GBP',
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── User Profiles (extends Supabase auth.users) ───────────────────────────
create table if not exists user_profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  org_id uuid references organisations(id) on delete set null,
  location_id uuid references locations(id) on delete set null,
  full_name text,
  role text default 'owner',              -- super_admin | owner | manager | staff
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Subscriptions (one per location) ─────────────────────────────────────
create table if not exists subscriptions (
  id uuid default uuid_generate_v4() primary key,
  org_id uuid references organisations(id) on delete cascade,
  location_id uuid references locations(id) on delete cascade unique,
  plan text default 'free',               -- free | starter | growth | scale | enterprise
  gmv_this_month numeric(12,2) default 0,
  gmv_last_month numeric(12,2) default 0,
  billing_period_start date,
  monthly_fee numeric(8,2) default 0,
  stripe_subscription_id text,
  stripe_customer_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Location Features (feature flags per location) ────────────────────────
create table if not exists location_features (
  id uuid default uuid_generate_v4() primary key,
  location_id uuid references locations(id) on delete cascade,
  feature text not null,                  -- kiosk | qr_ordering | loyalty | gift_cards | menu_boards | kds
  enabled boolean default false,
  price_per_month numeric(8,2) default 0,
  stripe_add_on_id text,
  unique(location_id, feature)
);

-- ── Device Pairing ────────────────────────────────────────────────────────
create table if not exists devices (
  id uuid default uuid_generate_v4() primary key,
  location_id uuid references locations(id) on delete cascade,
  name text not null,
  type text default 'pos',                -- pos | kds | kiosk | display
  pairing_code text unique,              -- DONUT-4821
  paired_at timestamptz,
  status text default 'unpaired',        -- unpaired | active | offline
  last_seen timestamptz,
  profile_id text,                        -- links to device_profiles in store
  created_at timestamptz default now()
);

-- ── Update existing tables to add org/location scope ─────────────────────
alter table menus add column if not exists org_id uuid references organisations(id);
alter table menus add column if not exists location_id_fk uuid references locations(id);

alter table menu_categories add column if not exists org_id uuid references organisations(id);
alter table menu_items add column if not exists org_id uuid references organisations(id);
alter table closed_checks add column if not exists org_id uuid references organisations(id);
alter table kds_tickets add column if not exists org_id uuid references organisations(id);

-- ── RLS Policies ──────────────────────────────────────────────────────────
alter table organisations enable row level security;
alter table locations enable row level security;
alter table user_profiles enable row level security;
alter table subscriptions enable row level security;
alter table location_features enable row level security;
alter table devices enable row level security;

-- Users can read their own org
create policy "users read own org" on organisations
  for select using (
    id in (select org_id from user_profiles where id = auth.uid())
  );

-- Super admins (your internal team) can do everything
create policy "super_admin all orgs" on organisations
  for all using (
    exists (select 1 from user_profiles where id = auth.uid() and role = 'super_admin')
  );

-- Users see locations in their org
create policy "users read own locations" on locations
  for select using (
    org_id in (select org_id from user_profiles where id = auth.uid())
  );

create policy "super_admin all locations" on locations
  for all using (
    exists (select 1 from user_profiles where id = auth.uid() and role = 'super_admin')
  );

-- Users can read/update their own profile
create policy "users read own profile" on user_profiles
  for select using (id = auth.uid());

create policy "users update own profile" on user_profiles
  for update using (id = auth.uid());

-- Users see their own subscription
create policy "users read own subscription" on subscriptions
  for select using (
    org_id in (select org_id from user_profiles where id = auth.uid())
  );

create policy "super_admin all subscriptions" on subscriptions
  for all using (
    exists (select 1 from user_profiles where id = auth.uid() and role = 'super_admin')
  );

-- Feature flags visible to org members
create policy "users read own features" on location_features
  for select using (
    location_id in (select id from locations where org_id in (
      select org_id from user_profiles where id = auth.uid()
    ))
  );

-- Devices visible to org members
create policy "users read own devices" on devices
  for select using (
    location_id in (select id from locations where org_id in (
      select org_id from user_profiles where id = auth.uid()
    ))
  );

create policy "users manage own devices" on devices
  for all using (
    location_id in (select id from locations where org_id in (
      select org_id from user_profiles where id = auth.uid()
    ))
  );

-- ── Auto-create user_profile on signup ───────────────────────────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'owner')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── GMV Plan Calculator ───────────────────────────────────────────────────
create or replace function get_plan_for_gmv(gmv numeric)
returns text as $$
begin
  if gmv <= 5000 then return 'free';
  elsif gmv <= 8000 then return 'starter';
  elsif gmv <= 10000 then return 'growth';
  elsif gmv <= 20000 then return 'scale';
  else return 'enterprise';
  end if;
end;
$$ language plpgsql;

-- ── Seed: your internal super admin org ──────────────────────────────────
insert into organisations (id, name, slug, status)
values ('00000000-0000-0000-0000-000000000001', 'Restaurant OS Internal', 'restaurant-os-internal', 'active')
on conflict do nothing;

