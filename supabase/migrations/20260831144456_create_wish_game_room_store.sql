-- Server-only game-room persistence.  This schema is intentionally not
-- exposed through Supabase's Data API: sockets remain the only client path.
create schema if not exists wish_private;

create table if not exists wish_private.rooms (
  room_code text primary key check (char_length(room_code) between 4 and 16),
  state jsonb not null,
  state_version bigint not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists rooms_updated_at_idx on wish_private.rooms (updated_at desc);

alter table wish_private.rooms enable row level security;

revoke all on schema wish_private from public, anon, authenticated;
revoke all on table wish_private.rooms from public, anon, authenticated;
