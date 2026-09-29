// If the CPU brain throws or suggests something illegal, the engine must still
// move: pass when there's a play to answer, otherwise lead its lowest card.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const brain = vi.hoisted(() => ({ impl: null }));
vi.mock("../game/aiPlayer.js", async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, makeAIDecision: (...args) => (brain.impl ? brain.impl(...args) : real.makeAIDecision(...args)) };
});

const { ThirteenGame } = await import("../game/engine.js");
const logic = await import("../game/gameLogic.js");
const { identifyCombination } = await import("../game/handEvaluator.js");
const { stateWith, ids, cards } = await import("../../tests/helpers/cards.js");

let game;
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => {});
  game = new ThirteenGame({ seats: [0, 1, 2, 3].map((i) => ({ type: "HUMAN", name: `P${i}` })) });
});
afterEach(() => {
  game.destroy();
  brain.impl = null;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const cpuTurn = (spec) => {
  game.state = stateWith(logic, { ...spec, types: ["AI", "HUMAN", "HUMAN", "HUMAN"] });
  game.scheduleAI();
  vi.advanceTimersByTime(game.delays.aiTurn);
  return game.state;
};

const BROKEN_BRAINS = {
  throws: () => {
    throw new Error("boom");
  },
  "suggests an invalid combination": (p) => ({ action: "play", cards: p.hand.slice(0, 2) }),
  "suggests an empty play": () => ({ action: "play", cards: [] }),
};

describe.each(Object.keys(BROKEN_BRAINS))("when the CPU brain %s", (label) => {
  beforeEach(() => {
    brain.impl = BROKEN_BRAINS[label];
  });

  it("passes when answering a play", () => {
    const table = identifyCombination(cards("2♠"));
    const s = cpuTurn({ hands: ["3♦ 9♠", "4♦", "5♦", "6♦"], current: 0, currentPlay: table, lastPlayedBy: 3 });
    expect(s.moveHistory.at(-1)).toEqual({ type: "PASS", playerIndex: 0 });
  });

  it("leads its lowest card when the table is empty", () => {
    const s = cpuTurn({ hands: ["9♠ 4♣ 4♦", "5♦", "6♦", "7♦"], current: 0 });
    expect(ids(s.moveHistory.at(-1).cards)).toEqual(["4♦"]);
  });
});
