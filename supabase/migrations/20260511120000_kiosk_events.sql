-- Events for kiosk wake (HC-SR501 / etc.). KioskShell subscribes via Realtime on INSERT.
-- Run in Supabase SQL editor or via supabase db push.

create table if not exists public.kiosk_events (
  id uuid primary key default gen_random_uuid(),
  kiosk_id text not null,
  type text not null default 'motion',
  created_at timestamptz not null default now()
);

create index if not exists kiosk_events_kiosk_id_created_at_idx
  on public.kiosk_events (kiosk_id, created_at desc);

alter table public.kiosk_events enable row level security;

drop policy if exists "kiosk_events_select_anon" on public.kiosk_events;
create policy "kiosk_events_select_anon"
  on public.kiosk_events
  for select
  to anon
  using (true);

drop policy if exists "kiosk_events_select_authenticated" on public.kiosk_events;
create policy "kiosk_events_select_authenticated"
  on public.kiosk_events
  for select
  to authenticated
  using (true);

-- Inserts: Pi daemon uses service_role (bypasses RLS). Anon cannot insert.

grant select on table public.kiosk_events to anon, authenticated;
grant all on table public.kiosk_events to service_role;

alter publication supabase_realtime add table public.kiosk_events;
