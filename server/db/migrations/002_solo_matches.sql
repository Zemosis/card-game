-- Games played alone against CPUs are recorded too, for stats only: the
-- browser reports them (see server/solo.js) and they earn no coins, exp or
-- rating.
alter table game_sessions add column solo boolean not null default false;

-- Solo reports are de-duplicated by the reporting player and the browser's
-- match id (kept in lobby_code), so a retried report records once.
create unique index game_sessions_solo_match_idx
  on game_sessions (host_id, lobby_code) where solo;

-- The match history gains what the profile's per-game stats need: the match's
-- field size (for "dead last"), the solo flag and the per-player stats blob.
-- Columns are appended, which create or replace allows even though other
-- views are built on this one.
create or replace view player_match_history as
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
  extract(epoch from (gs.finished_at - gs.started_at))::integer   as duration_seconds,
  gs.max_players,
  gs.solo,
  gp.stats
from game_players gp
join game_sessions gs on gs.id = gp.session_id
where gs.status = 'finished'
  and gp.player_id is not null;
