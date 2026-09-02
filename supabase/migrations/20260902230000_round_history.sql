-- Tier C: round-level history.
--
-- A Thirteen match is several rounds; scores accumulate and players are
-- eliminated at 100. Only the final totals were kept, so "how did this match
-- actually go" was unanswerable after the fact.
--
-- One row per round, with per-seat detail as jsonb. The round is the natural
-- write unit (4 seats always move together), and round_seat_results below
-- unnests it back into relational form for querying.

create table public.game_rounds (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  round_number smallint not null check (round_number >= 1),
  winner_seat smallint check (winner_seat >= 0),

  -- [{ seat_index, cards_left, points_gained, score_after, eliminated }]
  seat_results jsonb not null,

  created_at timestamptz not null default now(),

  constraint game_rounds_unique_number unique (session_id, round_number),
  constraint game_rounds_seat_results_is_array
    check (jsonb_typeof(seat_results) = 'array')
);

create index game_rounds_session_idx on public.game_rounds (session_id, round_number);

alter table public.game_rounds enable row level security;
alter table public.game_rounds force row level security;

-- Same rule as the other match tables: world-readable, service-role-only writes.
create policy game_rounds_select_all on public.game_rounds
  for select to anon, authenticated
  using (true);

-- Per-player round summary, derived by the server from the round records.
alter table public.game_players
  add column rounds_won smallint not null default 0,
  -- Per-game-type extras. Thirteen: cards_left_total, best_round_cards_left,
  -- eliminated_at_round. Promote a field to a real column once you query it.
  add column stats jsonb;

-- Flattens seat_results so round detail can be queried with plain SQL.
create view public.round_seat_results
with (security_invoker = true)
as
select
  gr.id                                          as round_id,
  gr.session_id,
  gr.round_number,
  gr.winner_seat,
  (r ->> 'seat_index')::smallint                 as seat_index,
  (r ->> 'cards_left')::smallint                 as cards_left,
  (r ->> 'points_gained')::smallint              as points_gained,
  (r ->> 'score_after')::smallint                as score_after,
  (r ->> 'eliminated')::boolean                  as eliminated,
  (r ->> 'seat_index')::smallint = gr.winner_seat as won_round
from public.game_rounds gr
cross join lateral jsonb_array_elements(gr.seat_results) as r;

grant select on public.round_seat_results to anon, authenticated;
