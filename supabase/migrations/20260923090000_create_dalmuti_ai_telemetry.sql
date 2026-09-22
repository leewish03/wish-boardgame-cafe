-- Anonymous, server-only calibration traces.  No user, room, chat, IP, card
-- identifier, or opponent-hand field is stored in this table.
create table if not exists wish_private.dalmuti_ai_decisions (
  id bigint generated always as identity primary key,
  match_key text not null,
  event_type text not null check (event_type in ('DECISION', 'ROUND_RESULT')),
  actor_kind text check (actor_kind in ('HUMAN', 'BOT')),
  round_number smallint not null,
  player_count smallint not null,
  role_index smallint,
  payload jsonb not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists dalmuti_ai_decisions_created_at_idx
  on wish_private.dalmuti_ai_decisions (created_at desc);
create index if not exists dalmuti_ai_decisions_match_round_idx
  on wish_private.dalmuti_ai_decisions (match_key, round_number);

alter table wish_private.dalmuti_ai_decisions enable row level security;
revoke all on table wish_private.dalmuti_ai_decisions from public, anon, authenticated;
