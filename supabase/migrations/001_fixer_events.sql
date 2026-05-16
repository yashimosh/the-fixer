-- fixer_events — telemetry table for The Fixer
--
-- One row per event. Events:
--   session_start  — player loaded the game (starts the session)
--   beat_read      — a story beat fired (truck crossed triggerZ)
--   cargo_lost     — player was driving too fast at a cargo-risk beat
--   run_complete   — player crossed END_Z and the run ended
--   session_end    — player closed the tab mid-run (pagehide/visibilitychange)
--
-- payload is JSONB for flexibility — each event type has its own shape:
--   session_start: { run_count }
--   beat_read:     { beat_index, beat_text }
--   cargo_lost:    { beat_index, speed_kmh }
--   run_complete:  { variant, cargo_secured, duration_s }
--   session_end:   { truck_z, cargo_secured, phase }
--
-- No PII collected. session_id is a random UUID from sessionStorage,
-- not linked to any user account.
--
-- Usage:
--   Apply via Supabase Dashboard → SQL Editor, or `supabase db push`.

create table if not exists public.fixer_events (
  id           bigserial primary key,
  session_id   uuid        not null,
  event        text        not null,
  payload      jsonb       not null default '{}'::jsonb,
  ts           timestamptz not null default now()
);

-- Index for per-session queries (funnel analysis, session replay)
create index if not exists fixer_events_session_id_idx
  on public.fixer_events (session_id, ts);

-- Index for event-type aggregation (beat read rates, completion rates)
create index if not exists fixer_events_event_idx
  on public.fixer_events (event, ts);

-- RLS: allow anon insert (game posts without auth), deny all reads from anon.
-- Analytics queries run via service_role key (server-side only, never in the browser).
alter table public.fixer_events enable row level security;

create policy "anon_insert" on public.fixer_events
  for insert to anon
  with check (true);

-- No SELECT policy for anon — reads require service_role.
-- The fixer-analytics skill uses SUPABASE_SERVICE_ROLE_KEY (server-side only).

comment on table public.fixer_events is
  'Telemetry events for The Fixer game. One row per event. No PII.';
