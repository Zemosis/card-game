# Thirteen waiting table — design

**Date:** 2026-09-29
**Status:** approved in chat, awaiting spec review

## Problem

Creating a Thirteen table (public or private) starts the match the instant the
host's game page loads: the page sends `check_game_status`, and the server calls
`startGame`, which fills every empty seat with a CPU and deals. Friends can only
arrive mid-match by taking over a CPU. There is no way to gather players first,
and no way to share a private table except reading its code off the header.

## Goal

A table starts in a **waiting** state. The host sits at the real table with
shadow seats, can invite people (code or link), add or remove CPUs, and presses
START when ready. Starting with empty seats fills them with CPUs, so "just play
now" is still one click.

## Decisions

- **The waiting room is the game table itself** (`/game-13`), not a separate
  screen. When the host starts, cards deal in place with no page change.
- **CPUs are placeholders.** A joining human takes an empty seat first, otherwise
  replaces a CPU. A table is full only at 4 humans.
- **Private tables are shared by code or invite link.** No passwords — the
  6-character code is already the secret, and a link is what people send.
- **Out of scope:** kicking players, choosing your own seat, CPU difficulty for
  online tables (stays the engine default, MEDIUM), Muushig (no online play yet).

## Player experience

**Host creates a table** and lands on `/game-13` in the waiting state:

- The host is in their usual bottom seat. The other three seats are **shadow
  spots** — dim dashed outlines reading "EMPTY SEAT" — drawn in the same
  positions opponents normally occupy.
- On each empty seat the host sees **+ ADD CPU**. A CPU seat shows the normal CPU
  plate plus a small **✕** (host only) to remove it.
- The play area shows a **waiting panel**:
  - "WAITING FOR PLAYERS · n/4 seated" (humans and CPUs both count as seated)
  - the table code, **COPY CODE** and **COPY INVITE LINK** buttons
  - host: a large **START GAME** button; empty seats become CPUs on start
  - everyone else: "Waiting for {host name} to start"
- Chat works while waiting.

**A friend joins** via invite link, code, or the Open Tables list. They take an
empty seat, or replace a CPU if none is empty. Everyone sees the seat fill with
their name and avatar. A seat whose player dropped shows dimmed as
"reconnecting…" until the grace period ends.

**Host leaves while waiting:** the next human by seat order becomes host. If no
humans remain, the table closes. A non-host leaving frees their seat (it becomes
empty, not a CPU).

**Unchanged:** joining a table that is already playing takes over a CPU seat;
leaving mid-match hands the seat to a CPU; rematch replays the same table.

**Open Tables list:** each row shows a **WAITING** or **PLAYING** tag.

## Server (`server/index.js`)

### Table model

Each lobby gains `seats`: an array of 4 slots, each one of

- `{ kind: "human", key }` — `key` is the member's `playerKey`
- `{ kind: "cpu", name }` — named `CPU n`, the lowest number not already used
  at the table (so a host alone gets CPU 1, 2, 3)
- `null` — empty

The host is seated in slot 0 at creation. `member.seatIndex` is the slot index
from the moment a member sits, not only once the game starts. A lobby is
**waiting** while `lobby.game` is null and **playing** once it exists.

### Events

Client → server (new):

| Event | Who | Effect |
| --- | --- | --- |
| `add_cpu { lobbyId, seat }` | host, waiting | empty slot → CPU |
| `remove_cpu { lobbyId, seat }` | host, waiting | CPU slot → empty |
| `start_game { lobbyId }` | host, waiting | fill empty slots with CPUs, build the `ThirteenGame` from `seats` in slot order, begin the session |

Non-hosts, a playing table, a bad seat index or a slot of the wrong kind are
rejected with `move_rejected { reason }`, matching how `request_rematch` rejects.

Client → server (changed):

- `check_game_status` no longer starts a match. Waiting: reply with
  `table_update`. Playing: reply with `game_state_update` as today.
- `join_lobby` on a waiting table seats the joiner (first empty slot, else the
  first CPU slot) and rejects with "Lobby is full" only when four humans are
  seated. On a playing table, behaviour is unchanged.
- `create_lobby` creates a waiting table with the host in slot 0.

Server → client (new):

- `table_update`, sent to every member of a waiting table whenever seats, host
  or membership change, and once to a member on join and on `check_game_status`.
  Shaped per recipient so no player keys leak:

  ```js
  {
    lobbyId, name, isPrivate,
    status: "waiting",
    code,            // the 6 characters people type or share (no "PUB-")
    mySeat,          // this recipient's slot
    isHost,          // is this recipient the host
    seats: [         // 4 entries
      { kind: "human", name, avatar, isHost, connected } | { kind: "cpu", name } | null,
    ],
  }
  ```

  Once `start_game` runs, the table sends `game_state_update` as it does today
  and `table_update` stops.

### Disconnects

Today a disconnect on a waiting table removes the member at once, so a host who
refreshes alone destroys the table. Waiting tables get the same
`DISCONNECT_GRACE_MS` grace as live matches: the seat is held and shown as
disconnected; rejoining within the grace reclaims it; after the grace the member
is removed as if they had left. If the match starts while a seated member is
still disconnected, the existing in-game grace timer applies.

### Lobby list

`publicLobbyList()` already reports `inProgress`; the UI uses it for the tag.
`current` counts human members, unchanged.

## Client

- **`/join/:code` route** (new small page): connects the socket with the
  current identity, sends `join_lobby { lobbyId: code }` (uppercased; `PUB-`
  prefix optional, as the server already accepts), and on `lobby_joined`
  navigates to `/game-13` with the same state the lobby page passes. On
  `error_message` it shows "Can't join this table" with the server's reason
  ("Lobby not found" / "Lobby is full") and a button back to the Thirteen lobby.
- **`GameThirteen`**: when it has a `table_update` and no game state, it renders
  the waiting table:
  - seats laid out relative to `mySeat` exactly as opponents are today
  - empty slots as shadow seats (with + ADD CPU for the host)
  - CPU slots with the ✕ for the host
  - the waiting panel in the play area, including copy code / copy invite link
    (`{origin}/join/{code}`) and START / waiting-for-host
  - chat available
  When the first `game_state_update` arrives it switches to the normal table.
- **`GameLobby`**: Open Tables rows show WAITING / PLAYING from `inProgress`.

## Testing

Server socket tests (`server/tests/socket.test.js`):

- a new table waits: `check_game_status` returns `table_update`, no deal
- only the host can `add_cpu`, `remove_cpu`, `start_game`
- add/remove CPU change the seats everyone sees
- `start_game` fills empty seats with CPUs and deals to the right seats
- a joiner takes an empty seat, then replaces a CPU; a fifth human is rejected
- joining a playing table still takes over a CPU seat
- host leaving while waiting passes host on; last human leaving closes the table
- a disconnect inside the grace period keeps the seat and rejoin reclaims it
- existing tests that relied on the instant start send `start_game` first

UI tests (`tests/ui/`):

- the waiting table renders shadow seats, host controls and the invite panel
- a non-host sees "Waiting for … to start" and no host controls
- `/join/:code` joins and navigates; a bad code shows the server's reason

Manual: two browser identities (normal + private window) against the dev
server — create, invite by link, add/remove CPU, start.

## Docs

Update the socket protocol and lobby notes in `docs/ARCHITECTURE.md`.
