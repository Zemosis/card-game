-- Record the facts a match leaves behind that cannot be reconstructed later.
--
-- Two problems this fixes:
--
--  1. Sessions were only written on game over, from `lobby.members` -- but
--     removeMember() deletes a member from that map. A player who quit was
--     therefore recorded nowhere, and an abandoned match left no trace at all.
--     The 'in_progress' and 'abandoned' status values were never written.
--
--  2. A loss where the player disconnected and a CPU finished the hand was
--     indistinguishable from a loss they actually played out.
--
-- Losses, win rate, placement distribution and streaks are all DERIVED from
-- these rows (see the leaderboards view) rather than stored as counters that
-- can drift.

-- --------------------------------------------------------- game_sessions ----

create type public.session_end_reason as enum ('completed', 'abandoned', 'all_left');

alter table public.game_sessions
  add column ended_reason public.session_end_reason,
  add column round_count smallint;

-- ---------------------------------------------------------- game_players ----

-- A seat can have more than one occupant across a session: join_lobby lets a
-- newcomer take over a free CPU seat mid-game. So "one row per seat" is wrong;
-- the real invariant is one row per player per session.
alter table public.game_players
  drop constraint game_players_unique_seat;

alter table public.game_players
  -- Stable per-player identity from the socket layer: the Supabase user id, or
  -- 'guest:NAME#TAG'. Gives guests an identity within a session too.
  add column player_key text,
  add column joined_at timestamptz,
  add column left_at timestamptz,
  add column left_early boolean not null default false,
  add column cpu_took_over boolean not null default false,
  add column disconnect_count smallint not null default 0,
  -- Elo is path dependent: a rating history cannot be backfilled from final
  -- results, because each delta depends on the ratings at that moment.
  add column rating_before integer,
  add column rating_after integer;

create unique index game_players_session_player_key
  on public.game_players (session_id, player_key)
  where player_key is not null;

create index game_players_seat_idx on public.game_players (session_id, seat_index);

-- --------------------------------------------------------------- profiles ----

alter table public.profiles
  add column rating integer not null default 1000;

-- rating is server-owned like every other progression column.
create or replace function public.guard_profile_stats()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'service_role' then
    new.coins := old.coins;
    new.exp := old.exp;
    new.level := old.level;
    new.wins := old.wins;
    new.games_played := old.games_played;
    new.rating := old.rating;
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------- leaderboards ----

-- Everything derivable stays derived. Only games the player actually played to
-- the end count toward "clean" results; walkovers are reported separately so a
-- rage-quit cannot be mistaken for a fair loss.
drop view if exists public.leaderboards;

create view public.leaderboards
with (security_invoker = true)
as
select
  p.id                                                                as player_id,
  p.username,
  p.tag,
  p.avatar,
  p.level,
  p.coins,
  p.rating,
  count(gp.id)                                                        as games_played,
  count(gp.id) filter (where gp.is_winner)                            as wins,
  count(gp.id) filter (where not gp.is_winner)                        as losses,
  count(gp.id) filter (where gp.left_early)                           as abandons,
  count(gp.id) filter (where gp.cpu_took_over)                        as cpu_finished,
  count(gp.id) filter (where gs.game_type = 'thirteen' and gp.is_winner) as thirteen_wins,
  count(gp.id) filter (where gs.game_type = 'muushig' and gp.is_winner)  as muushig_wins,
  avg(gp.final_position) filter (where not gp.left_early)             as avg_position,
  min(gp.final_position)                                              as best_position,
  max(gs.finished_at)                                                 as last_played_at
from public.profiles p
left join public.game_players gp on gp.player_id = p.id
left join public.game_sessions gs
  on gs.id = gp.session_id and gs.status = 'finished'
group by p.id;

grant select on public.leaderboards to anon, authenticated;
