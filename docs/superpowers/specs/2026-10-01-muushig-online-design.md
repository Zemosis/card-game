# Muushig online — design

**Goal:** Muushig tables you can host, join by code or invite link, and play
with up to 5 humans, the empty seats taken by CPUs — server-authoritative like
Thirteen, recorded for stats and rewards.

## Server

**Rules on the server.** `src/utils/muushig/engine.js` and `ai.js` are pure, so
the server runs them unchanged from byte-identical copies in
`server/game/muushig/` (the Render server builds from `server/` only). A test
fails if the copies drift, as for Thirteen.

**`MuushigGame`** (`server/game/muushigGame.js`) mirrors `ThirteenGame`: it owns
the full state, takes moves `{ type, ... }` from a seat, runs CPU seats and the
automatic steps on timers, and reports through `onState` / `onRoundEnd` /
`onGameOver`.

- Moves: `drawForDeal {depth}`, `decide {play}`, `swap {cardIds}`,
  `takeTrump {cardId|null}`, `play {cardId}`. The seat comes from the socket,
  never the payload; payloads are type-checked, then the engine judges them
  (its errors become `move_rejected` reasons).
- Automatic steps: a CPU's move after a per-phase "thinking" delay, collecting a
  finished trick, dealing the next round after the results screen. Delays
  follow the browser's own animations (draw reveal, dealer banner, deal, card
  flights) so a CPU never moves while the cards are still landing.
- `replaceSeat` swaps a human for a CPU (left or timed out) and back (rejoin or
  a newcomer taking a CPU's place); `rematch` only after the match is over.

**Redaction** (`muushigView(state, seat)`): the state keeps its shape so the
browser's rules helpers (`allowedPlays`, `foldBlock`, `maxDiscard`, …) work on
it, but every secret card becomes `{ hidden: true }` with counts preserved:
other players' hands and discards, the deal pile, the draw pile and the dead
pile. Public: the trump card, played cards, eaten tricks, cards drawn for the
deal, and the event log (debuffed cards are announced at the table, rulebook
§7). The view carries `mySeat`.

**Lobbies** become per game: `lobby.gameType` (`thirteen` | `muushig`) sets the
seat count (4 | 5), the engine, the redaction and the state event
(`game_state_update` | `muushig_state`). `create_lobby` and
`get_public_lobbies` take `gameType`; the list and its browsing room are per
game; `lobby_joined` reports `gameType` so an invite link or a code typed in
either lobby opens the right game. Muushig moves arrive as `muushig_move`.

**Recording**: the session is `game_type = 'muushig'`. Places come from
`rankSolo('muushig', …)` (lowest score, ties to more piles eaten in the last
round); per-seat stats are the solo report's tallies (`rounds_played`,
`rounds_won`, `eaten`, `gone_in`, `folded`, `sweeps`) derived from the event
log; each round is written to `game_rounds`. Rewards and rating as Thirteen
(5th place gets the 4th-place reward).

## Browser

**Lobby, invite link, waiting table** are shared: `GameLobby` sends the game
type and routes `lobby_joined` by it; `JoinTable` does the same; `WaitingTable`
lays out 4 or 5 seats and takes the game's title.

**`GameMuushig`** runs solo exactly as today. Online, it plays server states
through a **queue**: each new state is applied only when the previous one has
finished animating (no card flight, and the deal over unless still drawing for
the deal) — the same moments the solo page lets a CPU move — so every player
sees each move animate in turn. A long backlog (a hidden tab) is skipped
straight to the latest state. Joining mid-round skips the round's opening
animations. Your moves are checked locally first (instant errors), then sent;
the server's state is what moves the table. Your seat is wherever the server
put you, drawn at the bottom; `ME = 0` becomes `me`.

Online, the round results close by themselves (the server deals on), the host
gets REMATCH, and the header shows ONLINE and the ping instead of the CPU level.

## Testing

Engine wrapper with fake timers (whole CPU matches, move validation, seat
swaps, rematch, redaction leaks), copies identical, real-socket games (create,
join, list, play a whole match with the human's moves chosen by the AI from
its redacted view), Muushig recording against Postgres, UI tests for the online
page and the 5-seat waiting table, and Playwright with two browsers locally and
on the live site.
