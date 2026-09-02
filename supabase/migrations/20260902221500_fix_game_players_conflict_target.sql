-- A PARTIAL unique index cannot satisfy `ON CONFLICT (session_id, player_key)`
-- (Postgres 42P10) unless the predicate is repeated in the statement, which
-- PostgREST's upsert does not do. A plain unique constraint is inferrable, and
-- rows with a null player_key are unaffected because Postgres treats NULLs as
-- distinct for uniqueness.
drop index if exists public.game_players_session_player_key;

alter table public.game_players
  add constraint game_players_session_player_key unique (session_id, player_key);
