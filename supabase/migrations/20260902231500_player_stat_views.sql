-- Derived player statistics.
--
-- None of this is stored. Every figure here is computed from game_players and
-- game_sessions, so it can never disagree with the match records. Only the
-- small hot-path set the main menu reads stays denormalised on profiles.
--
-- Note on score direction: in Thirteen a LOWER score is better (points are
-- penalties for cards left in hand), so best_score is a MIN.

-- ------------------------------------------------- base: one row per match ----

create view public.player_match_history
with (security_invoker = true)
as
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
from public.game_players gp
join public.game_sessions gs on gs.id = gp.session_id
where gs.status = 'finished'
  and gp.player_id is not null;

grant select on public.player_match_history to anon, authenticated;

-- ------------------------------------------------------- headline totals ----

create view public.player_stats
with (security_invoker = true)
as
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
from public.profiles p
left join public.player_match_history h on h.player_id = p.id
group by p.id;

grant select on public.player_stats to anon, authenticated;

-- ------------------------------------------------------ per-game-type split ----

create view public.player_game_type_stats
with (security_invoker = true)
as
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
from public.player_match_history h
group by h.player_id, h.game_type;

grant select on public.player_game_type_stats to anon, authenticated;

-- --------------------------------------------------- placement distribution ----

-- How often 1st vs 2nd vs 3rd vs 4th, per game type.
create view public.player_placement_stats
with (security_invoker = true)
as
select
  h.player_id,
  h.game_type,
  h.final_position,
  count(*)                                                        as times,
  round(
    count(*)::numeric
      / sum(count(*)) over (partition by h.player_id, h.game_type) * 100
  , 1)                                                            as pct
from public.player_match_history h
where h.final_position is not null
group by h.player_id, h.game_type, h.final_position;

grant select on public.player_placement_stats to anon, authenticated;

-- ------------------------------------------------------------------ streaks ----

-- Gaps and islands: consecutive same-result matches ordered by finish time
-- form groups whose (row_number - row_number within result) is constant.
create view public.player_streaks
with (security_invoker = true)
as
with ordered as (
  select
    h.player_id,
    h.is_winner,
    h.finished_at,
    row_number() over (partition by h.player_id order by h.finished_at)
      - row_number() over (partition by h.player_id, h.is_winner order by h.finished_at)
      as grp
  from public.player_match_history h
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

grant select on public.player_streaks to anon, authenticated;

-- -------------------------------------------------------------- head to head ----

-- A function rather than a view: the full cross product of every player pair
-- is not something you ever want to materialise.
create function public.head_to_head(player_a uuid, player_b uuid)
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
security invoker
set search_path = ''
as $$
  select
    count(*),
    count(*) filter (where a.is_winner),
    count(*) filter (where b.is_winner),
    count(*) filter (where a.final_position < b.final_position),
    count(*) filter (where b.final_position < a.final_position),
    max(a.finished_at)
  from public.player_match_history a
  join public.player_match_history b
    on b.session_id = a.session_id and b.player_id = player_b
  where a.player_id = player_a;
$$;

grant execute on function public.head_to_head(uuid, uuid) to anon, authenticated;

-- ------------------------------------------------------------- leaderboards ----

-- Rebuilt as a thin projection of player_stats so the aggregation logic lives
-- in exactly one place.
drop view if exists public.leaderboards;

create view public.leaderboards
with (security_invoker = true)
as
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
from public.player_stats s
left join public.player_game_type_stats t
  on t.player_id = s.player_id and t.game_type = 'thirteen'
left join public.player_game_type_stats m
  on m.player_id = s.player_id and m.game_type = 'muushig';

grant select on public.leaderboards to anon, authenticated;
