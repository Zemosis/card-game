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

Honest status, as of the initial Supabase schema landing.

| Area | State |
|---|---|
| Main menu, settings, avatar painter | Built |
| Auth (email + OAuth) via Supabase | Built; OAuth providers need enabling in the dashboard |
| Database schema, RLS, triggers | Built and applied |
| **Thirteen** | **Playable.** Server-authoritative, reconnect handling, match recording |
| **Muushig** | **Not implemented.** UI mockup only — see below |
| Shop / economy | Not started; `coins` accrues in the DB |
| Deployment | Not deployed. Everything runs locally |

**Muushig is a static mockup.** `src/pages/muushig/GameMuushig.jsx` renders
hardcoded `SEATS`, `PILE` and `MUUSHIG_HAND` arrays as a UI preview. It opens no
socket and there is no Muushig logic anywhere in `server/game/`. This is why
`recordMatch` hardcodes `game_type: 'thirteen'`. The rulebook is written; the
implementation is not.

There is **no automated test suite** for the frontend. The server has
`simulate.js` and `test-multiplayer.mjs` as ad-hoc harnesses.

## 3. Tech stack

**Client** — React 19 + Vite 7, Tailwind CSS v4, React Router v7, GSAP 3 (with
`@gsap/react`) for animation, `socket.io-client` v4, `@supabase/supabase-js`.

**Server** (`server/`) — Node + Express 5, Socket.IO v4, `@supabase/supabase-js`
with the service role key. ES modules throughout.

**Supabase** — Postgres 17 for persistence, Supabase Auth for identity.

> **Do not use Supabase Realtime or Presence.** All transient in-game
> communication — matchmaking, lobbies, moves, chat — goes through the Socket.IO
> server. Supabase is storage and identity only. Two sources of realtime truth
> is the bug you cannot debug later.

Object storage is deliberately **not** used. Painted avatars serialize to ~2KB
of JSON and live in `profiles.custom_avatar`; card art and skins are build
assets under `src/assets/`. Revisit only when users upload arbitrary files.

## 4. Repository layout

```
src/
  pages/          MainMenu, AvatarPaint, thirteen/, muushig/
  components/     PixelCard (design primitives), auth/, thirteen/
  hooks/          useAuth (session + profile), useServerStats
  lib/            supabase client, guestIdentity
  utils/          socket, SoundManager, avatarConstants,
                  + a client-side copy of the game rules (display only)
server/
  index.js        Socket.IO entry, auth middleware, lobby management
  game/           engine.js (ThirteenGame, redactState) + rules modules
  persistence.js  JWT verification and match recording
supabase/
  migrations/     the schema — source of truth
docs/             this file, STYLEGUIDE.md, the two rulebooks
```

Note that `src/utils/gameLogic.js`, `handEvaluator.js` etc. are mirrored in
`server/game/`. The **server copies are authoritative**; the client copies exist
for optimistic rendering and hints. Do not let them diverge in rules.

## 5. Runtime architecture

```
Browser ──HTTP──> Supabase Auth ──> JWT
   │
   ├──supabase-js (publishable key)──> Postgres    profile reads/writes, leaderboards
   │                                               (RLS enforced)
   └──Socket.IO (JWT in handshake)───> Node server  lobbies, moves, chat
                                            │
                                            └──service role──> Postgres
                                                               match results
```

**Game state lives in RAM on the Node server**, in a `Map` of lobbies. Each
lobby holds its members keyed by a stable `playerKey` (the Supabase user id, or
`name#tag` for a guest) and a `ThirteenGame` instance. Socket ids are rebound to
the player key on reconnect, which is what makes refresh-and-rejoin work.

**Connection identity** (`server/index.js`) — the handshake carries either a
Supabase access token or a guest name/tag. `verifyToken` resolves the token via
`supabase.auth.getUser()`; failure means guest, not rejection.

**Move flow** — the client emits `request_move`; the server checks turn order,
card ownership and combination legality, then either updates state and
broadcasts or replies `move_rejected`. There is no path by which a client sets
state directly.

**Redaction** — `redactState(state, seatIndex)` replaces every other player's
hand with `{hidden: true}` placeholders, preserving length so card backs render
correctly. Each client receives a state shaped for its own seat.

**Disconnects** — a dropped player keeps their seat for 60 seconds
(`DISCONNECT_GRACE_MS`). After that a CPU takes over so the match can finish.

### Socket protocol

Client emits: `create_lobby`, `join_lobby`, `leave_lobby`, `get_public_lobbies`,
`check_game_status`, `request_move`, `request_rematch`, `send_chat`,
`ping_check`, `get_stats`.

Server emits: `lobby_joined`, `game_state_update`, `move_rejected`,
`public_lobbies_update`, `receive_chat`, `error_message`.

## 6. Database

**Source of truth is `supabase/migrations/`.** Do not edit the schema in the
dashboard — write a migration, so the database can be recreated from the repo.

### `profiles`

One row per `auth.users` entry, created automatically by the
`on_auth_user_created` trigger. `username` is NULL until the player completes
setup, and the client treats that as its "needs setup" signal — which is what
makes OAuth work, since the OAuth redirect skips the signup form entirely.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | → `auth.users(id)`, `on delete cascade` |
| `username` | `text` | NULL until setup; 1–6 chars |
| `tag` | `text` | NULL until setup; `^[A-Z0-9]{4}$` |
| `avatar` | `text` | `'1'`–`'5'`, or `'custom'` |
| `custom_avatar` | `jsonb` | `{v:2, pixels:[…256]}` from `serializeAvatar()` |
| `custom_colors` | `text[]` | max 8 |
| `coins`, `exp`, `level`, `wins`, `games_played` | `integer` | **server-owned** |
| `created_at`, `updated_at` | `timestamptz` | `updated_at` set by trigger |

Unique on `(lower(username), tag)` — the name#tag identity model.

### `game_sessions` / `game_players`

Written only by the Node server when a match ends. `game_sessions.host_id` and
`game_players.player_id` are nullable because guests have no `auth.uid()`; guest
seats carry `guest_name` / `guest_tag` instead. `game_players` is unique on
`(session_id, seat_index)`.

Rewards by final placement: 100/50/25/10 coins, 60/35/20/10 exp;
`level = exp/100 + 1`.

### `leaderboards`

A **view** (`security_invoker = true`) aggregating `game_players` — not a table.
Nothing to keep in sync, and it cannot drift from the match records.

## 7. Security model

**Row Level Security** is enabled and forced on all three tables.

* `profiles` — world-readable; INSERT/UPDATE only where `id = (select auth.uid())`.
* `game_sessions`, `game_players` — world-readable, **no client write policy at
  all**. The server writes them through the service role, which has `BYPASSRLS`.

`auth.uid()` is wrapped in a `SELECT` in every policy so it is evaluated once per
statement rather than once per row.

**Column-level anti-tamper.** RLS restricts rows, not columns — so
`profiles_update_own` would otherwise let any signed-in user `PATCH /profiles`
and mint themselves coins with the publishable key. The `profiles_guard_stats`
BEFORE UPDATE trigger reverts `coins`, `exp`, `level`, `wins` and `games_played`
to their previous values unless `current_user = 'service_role'`. Identity fields
stay client-editable.

**Keys.** The publishable/anon key is safe in the browser; RLS is what protects
the data behind it. The **service role key bypasses RLS entirely** and must only
ever exist in `server/.env`.

## 8. Local development

```bash
npm install && npm run dev          # client on :5173
cd server && npm install && npm run dev   # server on :3001
```

Postgres and Auth are the **hosted Supabase project**; only the game server runs
locally. Applying a schema change means writing a migration file and applying it
to that project.

```bash
# .env  (client)
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable key>
VITE_WEBSOCKET_URL=http://localhost:3001

# server/.env
PORT=3001
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<secret — never in the client>
CORS_ORIGIN=http://localhost:5173
```

Both are gitignored. Without them the client's `supabase` export is `null` and
the app degrades to guest-only; the server logs a warning and skips match
recording. That degradation is intentional but easy to mistake for a bug.

OAuth providers must be enabled in the Supabase dashboard, with
`http://localhost:5173` on the redirect allowlist — `signInWithOAuth` passes
`window.location.origin` as `redirectTo`.

## 9. What's next

Roughly in dependency order:

1. **Implement Muushig for real** — a `MuushigGame` engine in `server/game/`
   mirroring `ThirteenGame`, then replace the mockup with socket-driven state.
   `recordMatch` stops hardcoding `game_type` at that point.
2. **Deploy** — client to Vercel, server to Render (it needs persistent
   WebSocket support), and add the deployed origins to `CORS_ORIGIN` and the
   Supabase redirect allowlist.
3. **Tests.** There is no frontend test runner. The rules engines in
   `server/game/` are pure functions and the obvious place to start.
4. **Shop and economy** — `coins` already accrues; nothing spends it.
5. **Progression** — the third menu slot is gated behind "Rank V" in the UI with
   no rank system behind it yet.
