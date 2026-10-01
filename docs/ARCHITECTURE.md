# Architecture

**Project:** Khuzur Card Hall — a retro pixel-art multiplayer card game site.

## 1. Goal

A browser card hall styled like a 16-bit console game — the Balatro reference
point: hard pixel borders, warm lamplight on a dark ground, chunky type, no
modern gradients or rounded corners. The visual rules live in
[STYLEGUIDE.md](STYLEGUIDE.md) and are not decoration; they are the product.

The shape of the thing:

* A **main menu** as the hub — profile in the top right, settings, live server
  stats, and a horizontally scrollable rack of game modes.
* **Multiple game modes**, currently Thirteen (Tiến lên, 4 players) and Muushig
  (5 players). Rules in [thirteen-rulebook.md](thirteen-rulebook.md) and
  [muushig-rulebook.md](muushig-rulebook.md).
* **Real multiplayer** with strict anti-cheat. Hidden hands stay hidden, and
  the server is the only authority on what is a legal move.
* **Persistent identity and progression** — profiles, coins, exp, levels, match
  history — with guests able to play without an account.

Two design commitments follow from that and explain most of what is below:

1. **The server is authoritative.** Card games break the moment a client can
   assert state. Nothing the client sends is trusted.
2. **Guests are first-class.** You can play without signing in, so every layer —
   socket identity, match records, the database schema — has to represent a
   player who has no account.

## 2. Current build state

Honest status, as of the move off Supabase to self-hosted Postgres.

| Area | State |
|---|---|
| Main menu, settings, avatar painter | Built |
| Auth (email + password) in the Node server | Built. OAuth buttons are shown but not wired up yet |
| Database schema, views | Built; applied automatically on server start |
| **Thirteen** | **Playable.** Server-authoritative, reconnect handling, match recording |
| **Muushig** | **Playable offline** against 4 CPUs (Easy/Medium/Hard). No online play yet — see below |
| Shop / economy | Not started; `coins` accrues in the DB |
| Deployment | Not deployed. Everything runs locally |

**Muushig runs in the browser only.** The rules are pure functions in
`src/utils/muushig/engine.js` (state in, new state out, no React or sockets) and
the CPU players are in `src/utils/muushig/ai.js`, at the lobby's three
difficulty levels. `src/pages/muushig/GameMuushig.jsx` renders the engine's
state with Thirteen's seat, hand and chat components plus
`components/muushig/`, and plays the CPU turns on timers. It opens no socket:
every Muushig table, online or practice, is a local game against CPUs, and
nothing is recorded, which is why `recordMatch` still hardcodes
`game_type: 'thirteen'`. The engine has no browser dependencies, so the server
can import it as-is for online play.

Thirteen is covered by a Vitest suite (`npm test`, config in `vitest.config.js`)
in three projects: `unit` (rules, CPU logic and seeded whole-match simulations,
run against both the client and server copies of the logic), `server` (engine
with fake timers, real-socket end-to-end against a spawned server, and
Postgres suites that run only when `TEST_DATABASE_URL` is set) and `ui`
(table components in jsdom). Muushig's engine and CPU players have their own
`unit` suites (`tests/unit/muushig-*.test.js`), including whole CPU matches at
each difficulty. See the README's Testing section.

## 3. Tech stack

**Client** — React 19 + Vite 7, Tailwind CSS v4, React Router v7, GSAP 3 (with
`@gsap/react`) for animation, `socket.io-client` v4.

**Server** (`server/`) — Node + Express 5, Socket.IO v4, `pg` for Postgres,
`bcryptjs` + `jsonwebtoken` for accounts. ES modules throughout.

**Postgres 17** — persistence. Locally it runs in a container; in production
any managed Postgres works, because nothing in the schema is vendor-specific.

> **One source of realtime truth.** All transient in-game communication —
> matchmaking, lobbies, moves, chat — goes through the Socket.IO server.
> Postgres is storage only.

The project previously used Supabase for Postgres and Auth. It moved off it
because a paused free-tier project took the whole site down with it. The old
migrations are in git history; `server/db/migrations/001_initial.sql` is their
consolidated plain-Postgres equivalent.

## 4. Repository layout

```
src/
  pages/          MainMenu, AvatarPaint, thirteen/, muushig/
  components/     PixelCard (design primitives), auth/, thirteen/, muushig/
  hooks/          useAuth (session + profile), useServerStats
  lib/            api (HTTP client + session token), guestIdentity
  utils/          socket, SoundManager, avatarConstants,
                  + a client-side copy of the Thirteen rules (display only)
                  + muushig/ (the Muushig engine and CPU players)
server/
  index.js        Socket.IO entry, auth middleware, lobby management
  game/           engine.js (ThirteenGame, redactState) + rules modules
  auth.js         sign-up/login, JWTs, profile routes (/api/auth/*)
  persistence.js  match recording
  db/             pg pool, migration runner, migrations/ — the schema
docs/             this file, STYLEGUIDE.md, the two rulebooks
```

Note that `src/utils/gameLogic.js`, `handEvaluator.js` etc. are mirrored in
`server/game/`. The **server copies are authoritative**; the client copies exist
for optimistic rendering and hints. Do not let them diverge in rules.

## 5. Runtime architecture

```
Browser ──HTTP  /api/auth/*──────────> Node server ──pg──> Postgres
   │            signup, login, me,          │              profiles, matches
   │            PATCH profile               │
   └──Socket.IO (JWT in handshake)──────────┘
                lobbies, moves, chat
```

Account routes: `POST /signup`, `POST /login`, `GET /me`, `PATCH /profile`,
`GET /stats` (everything the profile's Stats panel shows, for each game filter
— overall, Thirteen, Muushig — in one round trip; see `server/stats.js`) and
`POST /matches`.

**Solo matches** — games against CPUs run in the browser (Thirteen practice,
all of Muushig), so the browser reports each finished one to `POST /matches`
(`src/hooks/useSoloMatchReport.js`). `server/solo.js` checks the report and
places the player from the final scores itself; the match is saved with
`game_sessions.solo = true` and counts for stats only — no coins, exp or
rating. Reports are de-duplicated per player and match id, and limited to a
few a minute.

The browser never talks to Postgres. Every read and write goes through the
Node server, so authorization lives in its routes rather than in database
policies.

**Game state lives in RAM on the Node server**, in a `Map` of lobbies. Each
lobby holds its members keyed by a stable `playerKey` (the user id, or
`name#tag` for a guest) and a `ThirteenGame` instance. Socket ids are rebound to
the player key on reconnect, which is what makes refresh-and-rejoin work.

**Waiting tables** — a new lobby does not deal. It holds `seats` (4 slots: a
human by player key, a CPU, or empty) and sends each member a `table_update`
shaped for them (their seat, whether they are host, no player keys). The host
adds/removes CPUs and presses START (`start_game`), which fills empty seats with
CPUs and builds the `ThirteenGame` in seat order. A joiner takes an empty seat,
else replaces a CPU; the table is full at 4 humans. If the host leaves, the next
seated human becomes host.

**Connection identity** (`server/index.js`) — the handshake carries either a
session JWT or a guest name/tag. `verifyToken` (`server/auth.js`) checks the
signature locally; failure means guest, not rejection.

**Move flow** — the client emits `request_move`; the server checks turn order,
card ownership and combination legality, then either updates state and
broadcasts or replies `move_rejected`. There is no path by which a client sets
state directly.

**Redaction** — `redactState(state, seatIndex)` replaces every other player's
hand with `{hidden: true}` placeholders, preserving length so card backs render
correctly. Each client receives a state shaped for its own seat.

**Broadcasting** — `broadcastState(lobby, game)` takes the game explicitly. The
first broadcast of a match happens *inside* the `ThirteenGame` constructor,
before `lobby.game` has been assigned, so reading `lobby.game` there silently
dropped the opening deal on every match. Clients only recovered when the first
AI move produced another broadcast, and when a human held the opening turn none
came — the board stayed blank indefinitely. Keep the game parameter.

**Disconnects** — a dropped player keeps their seat for 60 seconds
(`DISCONNECT_GRACE_MS`), whether the table is waiting or playing. After that a
waiting seat empties, and a playing seat goes to a CPU so the match can finish.
Leaving the game page without EXIT (browser Back) sends `leave_page`, which
starts the same grace; the socket itself stays up in the single-page app.

**Host** — each player's `game_state_update` carries `amHost`, so a player
promoted when the host leaves gets the REMATCH button; the client trusts it over
the router state it was opened with.

### Socket protocol

Client emits: `create_lobby`, `join_lobby`, `leave_lobby`, `get_public_lobbies`,
`leave_public_lobbies`, `check_game_status`, `add_cpu`, `remove_cpu`,
`start_game`, `leave_page`, `request_move`, `request_rematch`, `send_chat`,
`ping_check`, `get_stats`.

Server emits: `lobby_joined`, `table_update`, `game_state_update`,
`move_rejected`, `public_lobbies_update`, `receive_chat`, `error_message`.

`public_lobbies_update` goes only to sockets watching the table list: asking
for it (`get_public_lobbies`) subscribes, and `leave_public_lobbies` (sent when
the lobby screen closes) or taking a seat at a table unsubscribes.

Invite links are `/join/{code}`, handled by `src/pages/JoinTable.jsx`.

## 6. Database

**Source of truth is `server/db/migrations/`.** The server applies any
unapplied file at startup, in filename order, and records it in
`schema_migrations`. Never edit an applied file — add `002_….sql` instead.

### `users`

`id`, `email` (unique case-insensitively), `password_hash` (bcrypt). Only
`server/auth.js` reads it.

### `profiles`

One row per `users` entry, inserted in the same transaction as the user at
sign-up. `username` is NULL until the player completes
setup, and the client treats that as its "needs setup" signal — which is what
will make OAuth work later, since an OAuth redirect skips the signup form.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | → `users(id)`, `on delete cascade` |
| `username` | `text` | NULL until setup; 1–6 chars |
| `tag` | `text` | NULL until setup; `^[A-Z0-9]{4}$` |
| `avatar` | `text` | `'1'`–`'5'`, or `'custom'` |
| `custom_avatar` | `jsonb` | `{v:2, pixels:[…256]}` from `serializeAvatar()` |
| `custom_colors` | `text[]` | max 8 |
| `coins`, `exp`, `level`, `wins`, `games_played` | `integer` | **server-owned** |
| `created_at`, `updated_at` | `timestamptz` | `updated_at` set by trigger |

Unique on `(lower(username), tag)` — the name#tag identity model.

### `game_sessions` / `game_players`

Written only by the Node server. `host_id` and `player_id` are nullable because
guests have no `auth.uid()`; guest seats carry `guest_name` / `guest_tag`.

**The session row is written when the match starts**, with
`status = 'in_progress'`, and updated when it ends. Recording only at game over
meant an abandoned match left no trace at all.

**Player rows come from `lobby.roster`, not `lobby.members`.** `members` is the
live connection map and drops a player the instant they quit; `roster` is a
ledger of every seat ever occupied during the match and is never pruned. Writing
from `members` is what previously erased quitters from history entirely — their
loss was recorded nowhere.

Uniqueness is `(session_id, player_key)`, not `(session_id, seat_index)`: a seat
can have more than one occupant, because `join_lobby` lets a newcomer take over
a vacated CPU seat mid-match. `player_key` is the socket layer's stable identity
(the user id, or `guest:NAME#TAG`).

A rematch is a separate match and opens its own session row.

Columns that exist so a result can be judged fairly later:
`left_early`, `cpu_took_over`, `disconnect_count`, `joined_at` / `left_at`, and
`ended_reason` (`completed` / `abandoned` / `all_left`). Without them, a loss
where someone rage-quit and a CPU finished the hand is indistinguishable from a
loss they played out.

Rewards by final placement: 100/50/25/10 coins, 60/35/20/10 exp;
`level = exp/100 + 1`. Rewards and rating apply **only** to matches that
actually finished — an abandoned match records what happened but yields no
result.

### Rating

`profiles.rating` (seeded at 1000) plus `rating_before` / `rating_after` on each
`game_players` row. Elo is path-dependent: each delta depends on the ratings *at
that moment*, so a rating history cannot be backfilled from final results. The
snapshot is taken now even though nothing displays it yet.

The formula is pairwise Elo across the rated field, averaged (`K = 32`) — the
standard extension of two-player Elo to a placement result. **Only signed-in
players are rated**, so rating cannot be farmed off CPUs or guests; with fewer
than two rated players, nobody moves.

### `game_rounds`

One row per round, with per-seat detail as `seat_results` jsonb
(`seat_index`, `cards_left`, `points_gained`, `score_after`, `eliminated`). The
round is the natural write unit — all four seats resolve together — and the
`round_seat_results` view unnests it back into relational form for querying.

The engine emits these through `onRoundEnd`. Two subtleties worth preserving:

* A round ends into `ROUND_END`, **or into `GAME_OVER` if it was the last one**.
  Hooking only `ROUND_END` silently drops every final round.
* Card counts are read from the *previous* state, because scoring empties every
  hand. The exception is the round winner, who emptied their hand on the play
  that ended the round — that play lands between the two states, so the previous
  state still shows the cards they just put down. The winner is hardcoded to 0.

`game_players.rounds_won` and `game_players.stats` (jsonb: `rounds_played`,
`cards_left_total`, `best_round_cards_left`, `eliminated_at_round`) are derived
from these by the server. jsonb because Thirteen and Muushig have genuinely
different concepts; promote a field to a real column once you query it.

### Deriving stats

Nothing about a player's record is stored as a counter. These views compute it
all from the match rows, so they can never disagree with history:

| View | What it answers |
|---|---|
| `player_match_history` | One row per match played — the base for everything else |
| `player_stats` | Games, wins, losses, win rate, avg/best/worst placement, best/worst score, abandons, public vs private, time played |
| `player_game_type_stats` | The same split by Thirteen vs Muushig |
| `player_placement_stats` | Placement distribution — how often 2nd vs 4th, with percentages |
| `player_streaks` | Longest win/loss streak, and current streak (negative = losing) |
| `round_seat_results` | Round-level detail, flattened |
| `leaderboards` | Ranking board; a thin projection of `player_stats` |
| `head_to_head(a, b)` | Function, not a view — the full pair cross-product is not something to materialise |

Two deliberate choices: `avg_position` **excludes** matches the player walked
out of, so a rage-quit cannot flatter or punish their average; and `win_rate` is
NULL rather than 0 for someone who has never played, because "0%" and "no data"
are different facts.

Only the hot-path set the main menu reads (`coins`, `exp`, `level`, `wins`,
`games_played`, `rating`) is denormalised onto `profiles`, and that is a cache.
Do not add a `losses` column: a counter that can drift from the rows it
summarises is worse than a join.

Note on score direction: in Thirteen a **lower** score is better (points are
penalties for cards left in hand), so `best_score` is a `MIN`.

### `leaderboards`

A **view** aggregating `game_players` — not a table.
Nothing to keep in sync, and it cannot drift from the match records. Exposes
wins, losses, abandons, `cpu_finished`, average and best position, per-game-type
wins, and `last_played_at`.

## 7. Security model

**The database is not exposed.** Postgres listens only for the Node server;
the browser has no connection string and no key. There is no RLS because there
is no untrusted database client.

**Accounts.** Passwords are bcrypt-hashed (cost 10). Sessions are HS256 JWTs
signed with `JWT_SECRET`, valid 30 days, stored in `localStorage` and sent as
`Authorization: Bearer` on HTTP and as `auth.token` in the socket handshake.
Tokens are stateless, so signing out only forgets the token client-side;
rotating `JWT_SECRET` signs everyone out.

**Column-level anti-tamper.** `PATCH /api/auth/profile` writes only the
whitelisted identity fields (`username`, `tag`, `avatar`, `custom_avatar`,
`custom_colors`). `coins`, `exp`, `level`, `wins`, `games_played` and `rating`
are written only by `persistence.js` when a match finishes, inside one
transaction that locks the affected profile rows.

**Restart recovery.** Game state is in RAM, so on boot any session still
`in_progress` is marked `abandoned`. This assumes one game server per
database.

## 8. Local development

```bash
# Postgres 17 in a container (podman or docker — same flags)
podman run -d --name khuzur-db -p 5432:5432 \
  -e POSTGRES_USER=khuzur -e POSTGRES_PASSWORD=khuzur -e POSTGRES_DB=khuzur \
  -v khuzur-pgdata:/var/lib/postgresql/data docker.io/library/postgres:17
podman start khuzur-db                     # on later days

cd server && npm install && npm run dev    # server on :3001, applies migrations
npm install && npm run dev                 # client on :5173
```

```bash
# .env  (client)
VITE_WEBSOCKET_URL=http://localhost:3001

# server/.env
PORT=3001
DATABASE_URL=postgres://khuzur:khuzur@localhost:5432/khuzur
JWT_SECRET=<openssl rand -hex 32>
CORS_ORIGIN=http://localhost:5173
```

Both are gitignored; copy the `.env.example` next to each. Without
`DATABASE_URL` the server still runs guest-only and skips match recording —
intentional, but easy to mistake for a bug.

Inspect data with `podman exec -it khuzur-db psql -U khuzur`.

## 9. What's next

Roughly in dependency order:

1. **Muushig online** — a `MuushigGame` wrapper in `server/game/` mirroring
   `ThirteenGame`, built on `src/utils/muushig/engine.js`, then drive
   `GameMuushig.jsx` from socket state. `recordMatch` stops hardcoding
   `game_type` at that point.
2. **Deploy** — client as static files, server on a host with persistent
   WebSocket support, Postgres managed. Add the deployed origin to
   `CORS_ORIGIN`.
3. **OAuth** — Google/Discord sign-in in `server/auth.js`; the profile setup
   flow already handles a user with no username.
4. **Tests.** There is no frontend test runner. The rules engines in
   `server/game/` are pure functions and the obvious place to start.
5. **Shop and economy** — `coins` already accrues; nothing spends it.
6. **Progression** — the third menu slot is gated behind "Rank V" in the UI with
   no rank system behind it yet.
