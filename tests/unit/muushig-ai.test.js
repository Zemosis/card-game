// Muushig AI: legal at every level, and the choices that define each level.

import { describe, it, expect } from "vitest";
import { PHASES, START_SCORE, collectTrick, createMatch, makeCard, maxDrawDepth, startNextRound } from "../../src/utils/muushig/engine.js";
import { aiAction, applyAction } from "../../src/utils/muushig/ai.js";
import { seededRandom } from "../helpers/cards.js";

const c = (id) => makeCard(id.slice(0, -1), id.slice(-1));
const cs = (ids) => (ids.trim() ? ids.trim().split(/\s+/).map(c) : []);

const players = (level) => Array.from({ length: 5 }, (_, i) => ({ name: `CPU${i}`, type: "AI", level }));

/** Plays a whole match with CPUs only; returns the final state. */
function playMatch(level, seed) {
  const rng = seededRandom(seed);
  let s = createMatch({ players: players(level), rng });
  for (let steps = 0; steps < 20000 && s.phase !== PHASES.MATCH_OVER; steps++) {
    if (s.phase === PHASES.TRICK_END) s = collectTrick(s);
    else if (s.phase === PHASES.ROUND_END) s = startNextRound(s, rng);
    else s = applyAction(s, aiAction(s, rng), rng);
  }
  return s;
}

function stateFor({ hand, trump = "♦", trick = [], phase = PHASES.PLAY, level = "HARD", played = "", trumpTakenBy = 4, trickNumber = 1, eaten = 0 }) {
  return {
    matchNumber: 1,
    roundNumber: 1,
    dealer: 4,
    players: Array.from({ length: 5 }, (_, seat) => ({
      id: seat,
      name: `P${seat}`,
      type: "AI",
      level,
      score: START_SCORE,
      hand: seat === 0 ? cs(hand) : cs("7♠"),
      status: "play",
      eaten: seat === 0 ? eaten : 0,
      discarded: [],
    })),
    trumpCard: c(`9${trump}`),
    trumpSuit: trump,
    trumpTakenBy,
    drawPile: cs("7♣ 8♣ 9♣"),
    deadPile: [],
    played: cs(played),
    trick: trick.map(([seat, id]) => ({ seat, card: c(id) })),
    trickNumber,
    phase,
    turn: 0,
    events: [],
  };
}

describe.each(["EASY", "MEDIUM", "HARD"])("%s", (level) => {
  it("plays whole matches to a winner without an illegal move", () => {
    for (const seed of [1, 2, 3]) {
      const s = playMatch(level, seed);
      expect(s.phase).toBe(PHASES.MATCH_OVER);
      expect(s.players[s.matchWinner].score).toBeLessThanOrEqual(0);
    }
  });

  it("draws for the deal at a depth the pile allows", () => {
    const s = createMatch({ players: players(level), rng: seededRandom(5) });
    const depths = new Set();
    for (let seed = 0; seed < 30; seed++) {
      const a = aiAction(s, seededRandom(seed));
      expect(a.type).toBe("drawForDeal");
      expect(a.seat).toBe(s.turn);
      expect(a.depth).toBeGreaterThanOrEqual(1);
      expect(a.depth).toBeLessThanOrEqual(maxDrawDepth(s));
      depths.add(a.depth);
    }
    expect(depths.size).toBeGreaterThan(3);
  });

  it("takes the trump card for its weakest card", () => {
    const s = stateFor({ hand: "7♣ K♦ Q♦ J♦ 10♦", phase: PHASES.TRUMP, level, trumpTakenBy: null });
    s.turn = 4;
    s.players[4].hand = cs("7♣ K♦ Q♦ J♦ 10♦");
    expect(aiAction(s, seededRandom(1))).toEqual({ type: "takeTrump", seat: 4, cardId: "7♣" });
  });

  it("keeps its hand when every card beats the trump card", () => {
    const s = stateFor({ hand: "", phase: PHASES.TRUMP, level, trumpTakenBy: null });
    s.turn = 4;
    s.players[4].hand = cs("A♦ K♦ Q♦ J♦ 10♦");
    expect(aiAction(s, seededRandom(1)).cardId).toBeNull();
  });
});

describe("MEDIUM and HARD", () => {
  it("MEDIUM eats with the cheapest winning card", () => {
    const s = stateFor({ hand: "A♠ K♠ 7♥", trick: [[3, "Q♠"]], level: "MEDIUM" });
    expect(aiAction(s, seededRandom(1)).cardId).toBe("K♠");
  });

  it("throws its weakest card when it can't win", () => {
    const s = stateFor({ hand: "9♥ A♣ 8♠", trick: [[3, "Q♠"], [2, "K♦"]], level: "MEDIUM" });
    expect(aiAction(s, seededRandom(1)).cardId).toBe("8♠");
  });
});

describe("HARD", () => {
  it("leads a trump that can't be beaten any more", () => {
    // A♦ and K♦ are gone, so the Q♦ is the top trump left.
    const s = stateFor({ hand: "Q♦ 8♣ 7♥", played: "A♦ K♦", trickNumber: 3 });
    expect(aiAction(s, seededRandom(1)).cardId).toBe("Q♦");
  });

  it("fights for its first pile with its strongest winner", () => {
    const s = stateFor({ hand: "A♦ J♦ 7♣", trick: [[3, "8♠"]], trickNumber: 4, eaten: 0 });
    expect(aiAction(s, seededRandom(1)).cardId).toBe("A♦");
  });

  it("wins cheaply when it plays last", () => {
    const s = stateFor({ hand: "K♦ 10♦ 7♣", trick: [[1, "8♠"], [2, "9♠"], [3, "10♠"], [4, "J♠"]], eaten: 1 });
    expect(aiAction(s, seededRandom(1)).cardId).toBe("10♦");
  });
});
