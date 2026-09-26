-- Initial schema for Khuzur Card Hall on plain Postgres.
--
-- Consolidates the old supabase/migrations/ history. The differences from the
-- Supabase version:
--   * `users` replaces Supabase's auth.users; the Node server owns sign-up,
--     password hashing and JWTs (server/auth.js).
--   * No RLS and no anon/authenticated/service_role roles. The browser never
--     talks to Postgres; the Node server is the only client, so authorization
--     lives in the server's HTTP routes.
--   * The profile row is created in the same transaction as the user, so the
--     on_auth_user_created trigger is gone. The stat-guard trigger is gone too:
--     PATCH /api/profile whitelists the client-editable columns instead.
--
-- Guests have no account, so a seat may reference a profile OR carry a guest
-- name/tag instead.

-- ---------------------------------------------------------------- enums ----

create type game_type as enum ('thirteen', 'muushig');
create type session_status as enum ('in_progress', 'finished', 'abandoned');
create type session_end_reason as enum ('completed', 'abandoned', 'all_left');

-- ---------------------------------------------------------------- users ----

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create unique index users_email_key on users (lower(email));

-- ------------------------------------------------------------- profiles ----

create table profiles (
  id uuid primary key references users (id) on delete cascade,

  -- Null until the player finishes the setup modal; the client treats
  -- "username is null" as "needs setup".
  username text,
  tag text,

  -- '1'..'5' for the preset pixel avatars, or the literal 'custom' when the
  -- player has painted one (see AvatarPaint.jsx).
  avatar text not null default '1',
  custom_avatar jsonb,
  custom_colors text[] not null default '{}',

  -- Server-owned progression. Never writable through PATCH /api/profile.
  coins integer not null default 0,
  exp integer not null default 0,
  level integer not null default 1,
  wins integer not null default 0,
  games_played integer not null default 0,
  rating integer not null default 1000,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_username_length
    check (username is null or char_length(username) between 1 and 6),
  constraint profiles_tag_format
    check (tag is null or tag ~ '^[A-Z0-9]{4}$'),
  constraint profiles_counters_non_negative
    check (coins >= 0 and exp >= 0 and wins >= 0 and games_played >= 0 and level >= 1),
  -- serializeAvatar() emits { v: 2, pixels: [...] } for a 16x16 grid.
  constraint profiles_custom_avatar_shape
    check (
      custom_avatar is null
      or (
        custom_avatar ->> 'v' = '2'
        and jsonb_typeof(custom_avatar -> 'pixels') = 'array'
        and jsonb_array_length(custom_avatar -> 'pixels') = 256
      )
    ),
  -- MAX_CUSTOM_COLORS in AvatarPaint.jsx
  constraint profiles_custom_colors_limit
    check (coalesce(array_length(custom_colors, 1), 0) <= 8)
);

-- name#tag identity: unique as a pair, case-insensitively on the name.
create unique index profiles_username_tag_key
  on profiles (lower(username), tag)
  where username is not null and tag is not null;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- -------------------------------------------------------- game_sessions ----

-- Written when the match STARTS (in_progress) and updated when it ends, so an
-- abandoned match still leaves a trace. A rematch opens its own row.
create table game_sessions (
  id uuid primary key default gen_random_uuid(),
  game_type game_type not null,
  status session_status not null default 'in_progress',
  ended_reason session_end_reason,

  -- Null when a guest hosted the lobby; the display name is kept either way.
  host_id uuid references profiles (id) on delete set null,
  host_display_name text,

  name text,
  is_private boolean not null default false,
  lobby_code text,

  max_players integer not null default 4 check (max_players between 2 and 8),
  current_player_count integer not null default 0 check (current_player_count >= 0),
  round_count smallint,

  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),

  constraint game_sessions_finished_after_started
    check (finished_at is null or started_at is null or finished_at >= started_at)
);

create index game_sessions_host_id_idx on game_sessions (host_id);
create index game_sessions_status_created_at_idx
  on game_sessions (status, created_at desc);

-- --------------------------------------------------------- game_players ----

create table game_players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references game_sessions (id) on delete cascade,

  -- Stable per-player identity from the socket layer: the user id, or
  -- 'guest:NAME#TAG'. A seat can have more than one occupant across a session
  -- (join_lobby lets a newcomer take over a CPU seat), so the invariant is one
  -- row per player per session, not per seat.
  player_key text,

  -- Null for guest seats, which carry guest_name/guest_tag instead.
  player_id uuid references profiles (id) on delete set null,
  guest_name text,
  guest_tag text,

  seat_index smallint not null check (seat_index >= 0),
  final_score integer,
  final_position smallint check (final_position >= 1),
  is_winner boolean not null default false,
  coins_earned integer not null default 0,
  exp_earned integer not null default 0,

  joined_at timestamptz,
  left_at timestamptz,
  left_early boolean not null default false,
  cpu_took_over boolean not null default false,
  disconnect_count smallint not null default 0,

  -- Elo is path dependent: a rating history cannot be backfilled from final
  -- results, because each delta depends on the ratings at that moment.
  rating_before integer,
  rating_after integer,

  rounds_won smallint not null default 0,
  -- Per-game-type extras. Promote a field to a real column once you query it.
  stats jsonb,

  created_at timestamptz not null default now(),

  constraint game_players_session_player_key unique (session_id, player_key)
);

create index game_players_player_id_idx on game_players (player_id);
create index game_players_seat_idx on game_players (session_id, seat_index);

-- ----------------------------------------------------------- game_rounds ----

create table game_rounds (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references game_sessions (id) on delete cascade,
  round_number smallint not null check (round_number >= 1),
  winner_seat smallint check (winner_seat >= 0),

  -- [{ seat_index, cards_left, points_gained, score_after, eliminated }]
  seat_results jsonb not null,

  created_at timestamptz not null default now(),

  constraint game_rounds_unique_number unique (session_id, round_number),
  constraint game_rounds_seat_results_is_array
    check (jsonb_typeof(seat_results) = 'array')
);

-- ------------------------------------------------------------- views ----
-- Nothing below is stored. Every figure is computed from the match rows so it
-- can never disagree with history. In Thirteen a LOWER score is better.

create view round_seat_results as
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
from game_rounds gr
cross join lateral jsonb_array_elements(gr.seat_results) as r;

create view player_match_history as
select
  gp.player_id,
  gp.session_id,
  gs.game_type,
  gs.is_private,
  gs.ended_reason,
  gp.seat_index,
  gp.final_position,
  gp.final_score,
  gp.is_winner,
  gp.left_early,
  gp.cpu_took_over,
  gp.disconnect_count,
  gp.rounds_won,
  gp.rating_before,
  gp.rating_after,
  gp.rating_after - gp.rating_before                              as rating_delta,
  gp.coins_earned,
  gp.exp_earned,
  gs.round_count,
  gs.started_at,
  gs.finished_at,
  extract(epoch from (gs.finished_at - gs.started_at))::integer   as duration_seconds
from game_players gp
join game_sessions gs on gs.id = gp.session_id
where gs.status = 'finished'
  and gp.player_id is not null;

create view player_stats as
select
  p.id                                                            as player_id,
  p.username,
  p.tag,
  p.avatar,
  p.level,
  p.coins,
  p.rating,

  count(h.session_id)                                             as games_played,
  count(h.session_id) filter (where h.is_winner)                  as wins,
  count(h.session_id) filter (where not h.is_winner)              as losses,

  -- Null rather than 0 when they have not played: 0% and "no data" differ.
  round(
    count(h.session_id) filter (where h.is_winner)::numeric
      / nullif(count(h.session_id), 0) * 100
  , 1)                                                            as win_rate,

  -- Excludes walkouts so a rage-quit cannot flatter or punish the average.
  round(avg(h.final_position) filter (where not h.left_early), 2) as avg_position,
  min(h.final_position)                                           as best_position,
  max(h.final_position)                                           as worst_position,

  min(h.final_score)                                              as best_score,
  max(h.final_score)                                              as worst_score,
  round(avg(h.final_score), 1)                                    as avg_score,

  count(h.session_id) filter (where h.left_early)                 as abandons,
  count(h.session_id) filter (where h.cpu_took_over)              as cpu_finished,
  coalesce(sum(h.disconnect_count), 0)                            as total_disconnects,

  count(h.session_id) filter (where h.is_private)                 as private_games,
  count(h.session_id) filter (where not h.is_private)             as public_games,

  coalesce(sum(h.rounds_won), 0)                                  as rounds_won,
  coalesce(sum(h.round_count), 0)                                 as rounds_played,

  round(avg(h.duration_seconds))                                  as avg_match_seconds,
  coalesce(sum(h.duration_seconds), 0)                            as total_seconds_played,
  max(h.finished_at)                                              as last_played_at
from profiles p
left join player_match_history h on h.player_id = p.id
group by p.id;

create view player_game_type_stats as
select
  h.player_id,
  h.game_type,
  count(*)                                                        as games_played,
  count(*) filter (where h.is_winner)                             as wins,
  count(*) filter (where not h.is_winner)                         as losses,
  round(count(*) filter (where h.is_winner)::numeric / count(*) * 100, 1) as win_rate,
  round(avg(h.final_position) filter (where not h.left_early), 2) as avg_position,
  min(h.final_score)                                              as best_score,
  round(avg(h.duration_seconds))                                  as avg_match_seconds,
  max(h.finished_at)                                              as last_played_at
from player_match_history h
group by h.player_id, h.game_type;

create view player_placement_stats as
select
  h.player_id,
  h.game_type,
  h.final_position,
  count(*)                                                        as times,
  round(
    count(*)::numeric
      / sum(count(*)) over (partition by h.player_id, h.game_type) * 100
  , 1)                                                            as pct
from player_match_history h
where h.final_position is not null
group by h.player_id, h.game_type, h.final_position;

-- Gaps and islands: consecutive same-result matches ordered by finish time
-- form groups whose (row_number - row_number within result) is constant.
create view player_streaks as
with ordered as (
  select
    h.player_id,
    h.is_winner,
    h.finished_at,
    row_number() over (partition by h.player_id order by h.finished_at)
      - row_number() over (partition by h.player_id, h.is_winner order by h.finished_at)
      as grp
  from player_match_history h
),
runs as (
  select player_id, is_winner, count(*) as run_length, max(finished_at) as ended_at
  from ordered
  group by player_id, is_winner, grp
),
longest as (
  select
    player_id,
    coalesce(max(run_length) filter (where is_winner), 0)     as longest_win_streak,
    coalesce(max(run_length) filter (where not is_winner), 0) as longest_loss_streak
  from runs
  group by player_id
),
latest as (
  select distinct on (player_id) player_id, is_winner, run_length
  from runs
  order by player_id, ended_at desc
)
select
  l.player_id,
  l.longest_win_streak,
  l.longest_loss_streak,
  -- Positive = current win streak, negative = current losing streak.
  case when c.is_winner then c.run_length else -c.run_length end as current_streak
from longest l
join latest c on c.player_id = l.player_id;

-- A function rather than a view: the full pair cross product is not something
-- you ever want to materialise.
create function head_to_head(player_a uuid, player_b uuid)
returns table (
  games_together bigint,
  a_wins bigint,
  b_wins bigint,
  a_better_placement bigint,
  b_better_placement bigint,
  last_played_at timestamptz
)
language sql
stable
as $$
  select
    count(*),
    count(*) filter (where a.is_winner),
    count(*) filter (where b.is_winner),
    count(*) filter (where a.final_position < b.final_position),
    count(*) filter (where b.final_position < a.final_position),
    max(a.finished_at)
  from player_match_history a
  join player_match_history b
    on b.session_id = a.session_id and b.player_id = player_b
  where a.player_id = player_a;
$$;

create view leaderboards as
select
  s.player_id,
  s.username,
  s.tag,
  s.avatar,
  s.level,
  s.coins,
  s.rating,
  s.games_played,
  s.wins,
  s.losses,
  s.win_rate,
  s.avg_position,
  s.abandons,
  s.last_played_at,
  coalesce(t.wins, 0) as thirteen_wins,
  coalesce(m.wins, 0) as muushig_wins
from player_stats s
left join player_game_type_stats t
  on t.player_id = s.player_id and t.game_type = 'thirteen'
left join player_game_type_stats m
  on m.player_id = s.player_id and m.game_type = 'muushig';
