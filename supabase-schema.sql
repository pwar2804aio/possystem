-- Restaurant OS — Supabase Postgres schema
-- Run this in the Supabase SQL editor: https://supabase.com/dashboard/project/_/sql
-- All tables use RLS with org_id isolation

-- ── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Organisations (SaaS tenants) ────────────────────────────────────────────
create table if not exists organisations (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  plan        text not null default 'standard', -- standard | advanced | enterprise
  created_at  timestamptz default now()
);

-- ── Locations (restaurant sites) ────────────────────────────────────────────
create table if not exists locations (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid references organisations(id) on delete cascade,
  name        text not null,
  address     text,
  timezone    text default 'Europe/London',
  created_at  timestamptz default now()
);

-- ── Sections (floor plan sections per location) ──────────────────────────────
create table if not exists sections (
  id          uuid primary key default uuid_generate_v4(),
  location_id uuid references locations(id) on delete cascade,
  label       text not null,
  color       text default '#3b82f6',
  icon        text default '🍽',
  sort_order  int  default 0
);

-- ── Tables (floor plan) ──────────────────────────────────────────────────────
create table if not exists floor_tables (
  id          uuid primary key default uuid_generate_v4(),
  location_id uuid references locations(id) on delete cascade,
  section_id  text,          -- references sections.id
  label       text not null,
  shape       text default 'sq',
  x           int  default 40,
  y           int  default 40,
  w           int  default 80,
  h           int  default 64,
  max_covers  int  default 4,
  sort_order  int  default 0
);

-- ── Menu categories ──────────────────────────────────────────────────────────
create table if not exists menu_categories (
  id          uuid primary key default uuid_generate_v4(),
  location_id uuid references locations(id) on delete cascade,
  label       text not null,
  icon        text,
  color       text,
  sort_order  int  default 0
);

-- ── Menu items ───────────────────────────────────────────────────────────────
create table if not exists menu_items (
  id            uuid primary key default uuid_generate_v4(),
  location_id   uuid references locations(id) on delete cascade,
  category_id   text,
  name          text not null,
  description   text,
  price         numeric(10,2),
  type          text default 'simple', -- simple | variants | modifiers | pizza
  allergens     text[] default '{}',
  centre_id     text default 'pc1',    -- production centre
  archived      boolean default false,
  sort_order    int default 0,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── Modifier groups ──────────────────────────────────────────────────────────
create table if not exists modifier_groups (
  id          uuid primary key default uuid_generate_v4(),
  item_id     uuid references menu_items(id) on delete cascade,
  label       text not null,
  required    boolean default false,
  multi       boolean default false,
  sort_order  int default 0
);

create table if not exists modifier_options (
  id          uuid primary key default uuid_generate_v4(),
  group_id    uuid references modifier_groups(id) on delete cascade,
  label       text not null,
  price       numeric(10,2) default 0,
  sort_order  int default 0
);

-- ── Item variants (sizes) ────────────────────────────────────────────────────
create table if not exists item_variants (
  id          uuid primary key default uuid_generate_v4(),
  item_id     uuid references menu_items(id) on delete cascade,
  label       text not null,
  price       numeric(10,2) not null,
  sort_order  int default 0
);

-- ── Device profiles ──────────────────────────────────────────────────────────
create table if not exists device_profiles (
  id                  uuid primary key default uuid_generate_v4(),
  location_id         uuid references locations(id) on delete cascade,
  name                text not null,
  color               text default '#3b82f6',
  default_surface     text default 'tables',
  enabled_order_types text[] default '{"dine-in","takeaway","collection"}',
  assigned_section    text,
  hidden_features     text[] default '{}',
  table_service       boolean default true,
  quick_screen        boolean default true,
  receipt_printer_id  text,
  created_at          timestamptz default now()
);

-- ── Devices (Sunmi terminals) ────────────────────────────────────────────────
create table if not exists devices (
  id              uuid primary key default uuid_generate_v4(),
  location_id     uuid references locations(id) on delete cascade,
  profile_id      uuid references device_profiles(id) on delete set null,
  label           text not null,
  hardware_model  text default 'T2s',
  ip_address      text,
  status          text default 'offline', -- online | offline | pairing
  last_seen       timestamptz,
  paired_at       timestamptz default now()
);

-- ── Production centres & printers ────────────────────────────────────────────
create table if not exists production_centres (
  id          uuid primary key default uuid_generate_v4(),
  location_id uuid references locations(id) on delete cascade,
  name        text not null,
  type        text default 'kitchen',
  icon        text default '👨‍🍳'
);

create table if not exists printers (
  id          uuid primary key default uuid_generate_v4(),
  location_id uuid references locations(id) on delete cascade,
  centre_id   uuid references production_centres(id) on delete set null,
  name        text not null,
  model       text default 'NT311',
  ip_address  text,
  status      text default 'offline'
);

-- ── Staff ─────────────────────────────────────────────────────────────────────
create table if not exists staff (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid references organisations(id) on delete cascade,
  name        text not null,
  initials    text,
  role        text default 'Server',
  pin_hash    text,           -- bcrypt hash of 4-digit PIN
  color       text default '#3b82f6',
  permissions text[] default '{}'
);

create table if not exists staff_locations (
  staff_id    uuid references staff(id) on delete cascade,
  location_id uuid references locations(id) on delete cascade,
  primary key (staff_id, location_id)
);

-- ── Orders ────────────────────────────────────────────────────────────────────
create table if not exists orders (
  id          uuid primary key default uuid_generate_v4(),
  location_id uuid references locations(id) on delete cascade,
  device_id   uuid references devices(id) on delete set null,
  table_id    uuid references floor_tables(id) on delete set null,
  staff_id    uuid references staff(id) on delete set null,
  order_type  text default 'dine-in',
  status      text default 'open',    -- open | sent | closed | void
  covers      int  default 1,
  items       jsonb default '[]',
  notes       text,
  created_at  timestamptz default now(),
  sent_at     timestamptz,
  closed_at   timestamptz
);

-- ── Closed checks ─────────────────────────────────────────────────────────────
create table if not exists closed_checks (
  id          uuid primary key default uuid_generate_v4(),
  location_id uuid references locations(id) on delete cascade,
  order_id    uuid references orders(id) on delete set null,
  table_label text,
  server      text,
  covers      int  default 1,
  items       jsonb default '[]',
  subtotal    numeric(10,2),
  discount    numeric(10,2) default 0,
  total       numeric(10,2),
  tip         numeric(10,2) default 0,
  method      text default 'card',
  refunds     jsonb default '[]',
  voids       jsonb default '[]',
  closed_at   timestamptz default now()
);

-- ── KDS tickets ───────────────────────────────────────────────────────────────
create table if not exists kds_tickets (
  id          uuid primary key default uuid_generate_v4(),
  location_id uuid references locations(id) on delete cascade,
  centre_id   text,
  table_label text,
  server      text,
  covers      int,
  course      int default 1,
  items       jsonb default '[]',
  status      text default 'pending', -- pending | bumped
  sent_at     timestamptz default now(),
  bumped_at   timestamptz
);

-- ── 86 list (item unavailability) ────────────────────────────────────────────
create table if not exists eighty_six (
  location_id uuid references locations(id) on delete cascade,
  item_id     text not null,
  created_at  timestamptz default now(),
  primary key (location_id, item_id)
);

-- ── Daily counts (portion tracking) ──────────────────────────────────────────
create table if not exists daily_counts (
  location_id text not null,
  item_id     text not null,
  par         int not null,
  sold        int default 0,
  date        date default current_date,
  primary key (location_id, item_id, date)
);

-- ── Config pushes (publish history) ──────────────────────────────────────────
create table if not exists config_pushes (
  id          uuid primary key default uuid_generate_v4(),
  location_id uuid references locations(id) on delete cascade,
  pushed_by   text,
  snapshot    jsonb,          -- full config snapshot
  change_count int default 0,
  created_at  timestamptz default now()
);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Enable RLS on all tables
alter table organisations      enable row level security;
alter table locations          enable row level security;
alter table sections           enable row level security;
alter table floor_tables       enable row level security;
alter table menu_categories    enable row level security;
alter table menu_items         enable row level security;
alter table modifier_groups    enable row level security;
alter table modifier_options   enable row level security;
alter table item_variants      enable row level security;
alter table device_profiles    enable row level security;
alter table devices            enable row level security;
alter table production_centres enable row level security;
alter table printers           enable row level security;
alter table staff              enable row level security;
alter table staff_locations    enable row level security;
alter table orders             enable row level security;
alter table closed_checks      enable row level security;
alter table kds_tickets        enable row level security;
alter table eighty_six         enable row level security;
alter table daily_counts       enable row level security;
alter table config_pushes      enable row level security;

-- Realtime publications (operational tables that need live updates)
-- Run in Supabase dashboard: Realtime > Tables > enable these:
-- kds_tickets, orders, eighty_six, daily_counts, config_pushes

-- ── Indexes ───────────────────────────────────────────────────────────────────
create index if not exists idx_orders_location      on orders(location_id, status);
create index if not exists idx_kds_location         on kds_tickets(location_id, status);
create index if not exists idx_checks_location      on closed_checks(location_id, closed_at desc);
create index if not exists idx_menu_items_location  on menu_items(location_id, archived);
create index if not exists idx_86_location          on eighty_six(location_id);

-- ── Demo seed data ────────────────────────────────────────────────────────────
-- Insert a demo org and location for testing
insert into organisations (id, name, plan) values
  ('00000000-0000-0000-0000-000000000001', 'Demo Restaurant Group', 'standard')
  on conflict (id) do nothing;

insert into locations (id, org_id, name, address, timezone) values
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'The Anchor — High Street', '1 High Street, London EC1A 1BB', 'Europe/London')
  on conflict (id) do nothing;
