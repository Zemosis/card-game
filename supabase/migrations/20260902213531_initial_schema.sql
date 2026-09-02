-- Initial schema for Khuzur Card Hall.
--
-- Design notes:
--   * Column names and types are derived from what the app already queries:
--     src/hooks/useAuth.jsx, src/components/auth/LoginModal.jsx,
--     src/pages/AvatarPaint.jsx and server/persistence.js.
--   * Clients never write match results. The Node server holds the service role
--     key (which has BYPASSRLS) and is the only writer for game_sessions and
--     game_players, so those tables have no client write policies at all.
--   * Guests have no auth.uid(), so a seat may reference a profile OR carry a
--     guest name/tag instead.

-- ---------------------------------------------------------------- enums ----

create type public.game_type as enum ('thirteen', 'muushig');
create type public.session_status as enum ('in_progress', 'finished', 'abandoned');

-- ------------------------------------------------------------- profiles ----

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,

  -- Null until the player finishes the setup modal. OAuth users land here with
  -- a row already created by the on_auth_user_created trigger, so the client
  -- treats "username is null" as "needs setup".
  username text,
  tag text,

  -- '1'..'5' for the preset pixel avatars, or the literal 'custom' when the
  -- player has painted one (see AvatarPaint.jsx).
  avatar text not null default '1',
  custom_avatar jsonb,
  custom_colors text[] not null default '{}',

  coins integer not null default 0,
  exp integer not null default 0,
  level integer not null default 1,
  wins integer not null default 0,
  games_played integer not null default 0,

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
  on public.profiles (lower(username), tag)
  where username is not null and tag is not null;

comment on table public.profiles is
  'Player profile, one row per auth.users entry. Stat columns are server-owned.';

-- -------------------------------------------------------- game_sessions ----

create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  game_type public.game_type not null,
  status public.session_status not null default 'in_progress',

  -- Null when a guest hosted the lobby; the display name is kept either way.
  host_id uuid references public.profiles (id) on delete set null,
  host_display_name text,

  name text,
  is_private boolean not null default false,
  lobby_code text,

  max_players integer not null default 4 check (max_players between 2 and 8),
  current_player_count integer not null default 0 check (current_player_count >= 0),

  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),

  constraint game_sessions_finished_after_started
    check (finished_at is null or started_at is null or finished_at >= started_at)
);

create index game_sessions_host_id_idx on public.game_sessions (host_id);
create index game_sessions_status_created_at_idx
  on public.game_sessions (status, created_at desc);

-- --------------------------------------------------------- game_players ----

create table public.game_players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions (id) on delete cascade,

  -- Null for guest seats, which carry guest_name/guest_tag instead. Also goes
  -- null if the player later deletes their account.
  player_id uuid references public.profiles (id) on delete set null,
  guest_name text,
  guest_tag text,

  seat_index smallint not null check (seat_index >= 0),
  final_score integer,
  final_position smallint check (final_position >= 1),
  is_winner boolean not null default false,
  coins_earned integer not null default 0,
  exp_earned integer not null default 0,
  created_at timestamptz not null default now(),

  constraint game_players_unique_seat unique (session_id, seat_index)
);

-- session_id needs no separate index: it leads the unique seat constraint.
create index game_players_player_id_idx on public.game_players (player_id);

-- ------------------------------------------------------------- triggers ----

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Every auth.users row gets a profile immediately, so the client never has to
-- cope with profile === null. Works identically for email signup and OAuth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Coins, exp, level, wins and games_played are awarded by the game server.
-- Without this, any signed-in user could PATCH /profiles and mint themselves
-- coins using the publishable key. NOT security definer: it relies on
-- current_user, which PostgREST sets per request via SET LOCAL ROLE.
create or replace function public.guard_profile_stats()
returns trigger
language plpgsql
as $$
begin
  if current_user <> 'service_role' then
    new.coins := old.coins;
    new.exp := old.exp;
    new.level := old.level;
    new.wins := old.wins;
    new.games_played := old.games_played;
  end if;
  return new;
end;
$$;

create trigger profiles_guard_stats
  before update on public.profiles
  for each row execute function public.guard_profile_stats();

-- ------------------------------------------------------------ row level ----

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.game_sessions enable row level security;
alter table public.game_sessions force row level security;
alter table public.game_players enable row level security;
alter table public.game_players force row level security;

-- auth.uid() is wrapped in a SELECT so the planner evaluates it once per
-- statement rather than once per row.

create policy profiles_select_all on public.profiles
  for select to anon, authenticated
  using (true);

create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Match records are readable by anyone (leaderboards, match history) and
-- writable only by the service role, which bypasses RLS entirely.
create policy game_sessions_select_all on public.game_sessions
  for select to anon, authenticated
  using (true);

create policy game_players_select_all on public.game_players
  for select to anon, authenticated
  using (true);

-- ---------------------------------------------------------- leaderboard ----

-- A view, not a table: nothing to keep in sync, and it cannot drift from the
-- match records it summarises. security_invoker makes it respect the caller's
-- RLS rather than the view owner's.
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
  count(gp.id) filter (where gp.is_winner)                            as wins,
  count(gp.id)                                                        as games_played,
  count(gp.id) filter (where gs.game_type = 'thirteen' and gp.is_winner) as thirteen_wins,
  count(gp.id) filter (where gs.game_type = 'muushig' and gp.is_winner)  as muushig_wins
from public.profiles p
left join public.game_players gp on gp.player_id = p.id
left join public.game_sessions gs
  on gs.id = gp.session_id and gs.status = 'finished'
group by p.id;

-- --------------------------------------------------------------- grants ----

grant select on public.leaderboards to anon, authenticated;
