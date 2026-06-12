// Engine smoke test: drives full matches through the authoritative engine and
// checks validation/redaction invariants. Run with: node simulate.js

import { ThirteenGame, redactState } from "./game/engine.js";
import { makeAIDecision } from "./game/aiPlayer.js";
import { GAME_STATES } from "./game/constants.js";

let failures = 0;
const check = (cond, label) => {
  if (cond) console.log(`  ok: ${label}`);
  else {
    failures++;
    console.error(`  FAIL: ${label}`);
  }
};

// All seats HUMAN so the engine schedules no AI timers; we drive every move
// through handleMove exactly like remote clients would.
const seats = [0, 1, 2, 3].map((i) => ({
  type: "HUMAN",
  name: `P${i}`,
  socketId: `sock-${i}`,
}));

const game = new ThirteenGame({
  seats,
  onState: () => {},
  onGameOver: () => {},
});

// --- validation checks ---
{
  const s = game.state;
  const cur = s.currentPlayerIndex;
  const other = (cur + 1) % 4;

  let r = game.handleMove(other, "play", [s.players[other].hand[0].id]);
  check(!r.ok && r.error === "Not your turn", "rejects out-of-turn play");

  r = game.handleMove(cur, "pass");
  check(!r.ok, "rejects pass when leading a trick");

  const foreign = s.players[other].hand[0].id;
  r = game.handleMove(cur, "play", [foreign]);
  check(!r.ok && /not in your hand/i.test(r.error), "rejects cards the player doesn't hold");

  r = game.handleMove(cur, "play", []);
  check(!r.ok, "rejects empty selection");

  const card = s.players[cur].hand[0];
  r = game.handleMove(cur, "play", [card.id, card.id]);
  check(!r.ok, "rejects duplicate card ids");
}

// --- redaction check ---
{
  const red = redactState(game.state, 2);
  check(
    red.players.every((p, i) => (i === 2 ? p.hand.every((c) => c.id) : p.hand.every((c) => c.hidden))),
    "redaction hides all hands except the recipient's",
  );
  check(
    red.players.every((p, i) => p.hand.length === game.state.players[i].hand.length),
    "redaction preserves hand lengths for card-back rendering",
  );
}

// --- full match simulation ---
let moves = 0;
let rounds = 1;
const MAX_MOVES = 20000;

while (game.state.gameState !== GAME_STATES.GAME_OVER && moves < MAX_MOVES) {
  const s = game.state;

  if (s.gameState === GAME_STATES.ROUND_END) {
    game.clearTimers(); // skip the real-time round delay
    game.beginNextRound();
    rounds++;
    continue;
  }

  const seat = s.currentPlayerIndex;
  const player = s.players[seat];
  const decision = makeAIDecision(player, s.currentPlay, s);

  let result;
  if (decision.action === "play" && decision.cards?.length) {
    result = game.handleMove(seat, "play", decision.cards.map((c) => c.id));
    if (!result.ok && s.currentPlay) result = game.handleMove(seat, "pass");
  } else if (s.currentPlay) {
    result = game.handleMove(seat, "pass");
  } else {
    const lowest = [...player.hand].sort(
      (a, b) => a.rankValue * 4 + a.suitValue - (b.rankValue * 4 + b.suitValue),
    )[0];
    result = game.handleMove(seat, "play", [lowest.id]);
  }

  if (!result.ok) {
    console.error(`  FAIL: engine deadlock at move ${moves}: ${result.error}`);
    failures++;
    break;
  }
  moves++;
}

check(game.state.gameState === GAME_STATES.GAME_OVER, `match completes (${moves} moves, ${rounds} rounds)`);
check(
  game.state.players.filter((p) => !p.isEliminated).length === 1,
  "exactly one player remains uneliminated",
);

const winnerIdx = game.state.players.findIndex((p) => !p.isEliminated);
console.log(
  `  winner: seat ${winnerIdx}, scores: ${game.state.players.map((p) => p.score).join(", ")}`,
);

// --- rematch check ---
const rematch = game.rematch();
check(rematch.ok && game.state.matchNumber === 2, "rematch starts match #2");
check(
  game.state.players.every((p) => p.hand.length === 13 && !p.isEliminated && p.score === 0),
  "rematch resets hands and scores",
);
game.destroy();

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
