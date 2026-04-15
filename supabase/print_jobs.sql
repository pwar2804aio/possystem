-- Print jobs queue
-- Run in Supabase SQL editor: https://supabase.com/dashboard/project/tbetcegmszzotrwdtqhi/sql

create table if not exists print_jobs (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid not null,
  printer_id  text not null,          -- matches the id from rpos-printers localStorage
  printer_ip  text,                   -- cached from printer registry at job creation
  printer_port integer default 9100,
  job_type    text not null,          -- 'receipt' | 'kitchen' | 'test'
  payload     text not null,          -- base64-encoded ESC/POS bytes
  status      text not null default 'pending', -- pending | printing | done | failed
  error       text,
  created_at  timestamptz default now(),
  printed_at  timestamptz
);

-- Index for the agent to efficiently poll pending jobs
create index if not exists print_jobs_pending on print_jobs (location_id, status, created_at)
  where status = 'pending';

-- Enable realtime so the agent gets instant notifications
alter publication supabase_realtime add table print_jobs;

-- RLS: allow service role full access, anon can insert and read own location
alter table print_jobs enable row level security;

create policy "insert print jobs" on print_jobs
  for insert with check (true);

create policy "read own print jobs" on print_jobs
  for select using (true);

create policy "agent can update" on print_jobs
  for update using (true);
