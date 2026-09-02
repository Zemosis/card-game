// Round-history harness: drives a full match through the engine and checks the
// onRoundEnd summaries, including the final round (which transitions straight
// to GAME_OVER rather than ROUND_END). Run with: node test-rounds.mjs

import { ThirteenGame } from "./game/engine.js";
import { makeAIDecision } from "./game/aiPlayer.js";
import { GAME_STATES } from "./game/constants.js";

let failures = 0;
const check = (cond, label) => {
  if (cond) console.log(`  ok: ${label}`);
  else { failures++; console.error(`  FAIL: ${label}`); }
};

const seats = [0,1,2,3].map((i) => ({ type:"HUMAN", name:`P${i}`, socketId:`s${i}` }));
const captured = [];
const game = new ThirteenGame({
  seats, onState: () => {}, onGameOver: () => {},
  onRoundEnd: (r) => captured.push(r),
});

let moves = 0, driverRounds = 1;
while (game.state.gameState !== GAME_STATES.GAME_OVER && moves < 20000) {
  const s = game.state;
  if (s.gameState === GAME_STATES.ROUND_END) {
    game.clearTimers(); game.beginNextRound(); driverRounds++; continue;
  }
  const seat = s.currentPlayerIndex;
  const player = s.players[seat];
  const d = makeAIDecision(player, s.currentPlay, s);
  let r;
  if (d.action === "play" && d.cards?.length) {
    r = game.handleMove(seat, "play", d.cards.map((c) => c.id));
    if (!r.ok && s.currentPlay) r = game.handleMove(seat, "pass");
  } else if (s.currentPlay) {
    r = game.handleMove(seat, "pass");
  } else {
    const lowest = [...player.hand].sort((a,b) => a.rankValue*4+a.suitValue-(b.rankValue*4+b.suitValue))[0];
    r = game.handleMove(seat, "play", [lowest.id]);
  }
  if (!r.ok) { console.error("stuck:", r.error); break; }
  moves++;
}
game.clearTimers();

console.log(`  (driver saw ${driverRounds} rounds, hook captured ${captured.length})`);
check(captured.length === driverRounds, "one summary per round, final round included");
check(captured.every((r, i) => r.roundNumber === i + 1), "round numbers are sequential from 1");
check(captured.every((r) => r.seatResults.length === 4), "every round has 4 seat results");
check(captured.every((r) => r.winnerSeat !== null && r.winnerSeat >= 0), "every round has a winner seat");

// The winner emptied their hand; scoring clears hands, so a naive read of the
// post-state would report 0 for everyone.
check(
  captured.every((r) => r.seatResults[r.winnerSeat].cards_left === 0),
  "round winner has 0 cards left",
);
check(
  captured.some((r) => r.seatResults.some((s) => s.cards_left > 0)),
  "losers' card counts survive (captured pre-scoring)",
);
check(
  captured.every((r) => r.seatResults.every((s) => s.points_gained >= 0)),
  "points_gained is never negative",
);
// score_after must equal the running sum of points_gained per seat.
const running = [0,0,0,0];
let consistent = true;
for (const r of captured) {
  for (const s of r.seatResults) {
    running[s.seat_index] += s.points_gained;
    if (running[s.seat_index] !== s.score_after) consistent = false;
  }
}
check(consistent, "score_after equals the running sum of points_gained");
check(
  captured.at(-1).seatResults.filter((s) => !s.eliminated).length === 1,
  "exactly one seat uneliminated after the final round",
);

console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nALL ROUND CHECKS PASSED");
process.exit(failures ? 1 : 0);
