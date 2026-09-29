import { describe, it, expect } from "vitest";
import { thirteenSoloReport, muushigSoloReport } from "../../src/utils/soloReport";

const times = { matchId: "SOLO-ABC123-1", startedAt: "2026-09-29T10:00:00.000Z", finishedAt: "2026-09-29T10:20:00.000Z" };

describe("thirteenSoloReport", () => {
  const play = (playerIndex, type) => ({ type: "PLAY", playerIndex, cards: [], combination: { type } });
  const roundEnd = (winnerIndex, scores) => ({
    type: "ROUND_END",
    winnerIndex,
    scores: scores.map(([score, eliminated], id) => ({ id, score, eliminated })),
  });
  // Three rounds from seat 0's side: caught with 4 cards, went out first,
  // then caught with 11 cards (22 points: 10+ cards count double).
  const state = {
    roundNumber: 3,
    players: [
      { score: 26, isEliminated: true },
      { score: 30, isEliminated: true },
      { score: 3, isEliminated: false },
      { score: 25, isEliminated: true },
    ],
    moveHistory: [
      play(0, "SINGLE"),
      play(1, "PAIR"),
      play(0, "PAIR"),
      roundEnd(2, [[4, false], [9, false], [0, false], [12, false]]),
      { type: "NEW_ROUND", roundNumber: 2 },
      play(0, "STRAIGHT"),
      play(0, "SINGLE"),
      roundEnd(0, [[4, false], [30, true], [3, false], [25, true]]),
      { type: "NEW_ROUND", roundNumber: 3 },
      play(2, "TRIPLE"),
      roundEnd(2, [[26, true], [30, true], [3, false], [25, true]]),
    ],
  };

  it("reports every seat's final score and your own round and hand tallies", () => {
    expect(thirteenSoloReport(state, times)).toEqual({
      ...times,
      gameType: "thirteen",
      me: 0,
      rounds: 3,
      players: [
        { score: 26, eliminated: true },
        { score: 30, eliminated: true },
        { score: 3, eliminated: false },
        { score: 25, eliminated: true },
      ],
      stats: {
        rounds_played: 3,
        rounds_won: 1,
        cards_left_total: 15,
        hands: { SINGLE: 2, PAIR: 1, STRAIGHT: 1 },
      },
    });
  });

  it("stops counting your rounds once you are out", () => {
    const out = {
      ...state,
      moveHistory: [
        roundEnd(1, [[26, true], [0, false], [3, false], [4, false]]),
        roundEnd(1, [[26, true], [0, false], [9, false], [30, true]]),
      ],
    };
    expect(thirteenSoloReport(out, times).stats).toMatchObject({ rounds_played: 1, rounds_won: 0, cards_left_total: 13 });
  });
});

describe("muushigSoloReport", () => {
  const roundEnd = (round, rows, roundWinner = null) => ({
    type: "roundEnd",
    round,
    roundWinner,
    results: rows.map(([eaten, folded], seat) => ({ seat, eaten, folded, delta: 0, score: 0 })),
  });
  const game = {
    roundNumber: 3,
    players: [{ score: 2 }, { score: -1 }, { score: 7 }, { score: 5 }, { score: 9 }],
    events: [
      { type: "drawStart", seat: 0 },
      roundEnd(1, [[3, false], [1, false], [1, false], [0, true], [0, true]]), // you ate the most
      roundEnd(2, [[0, true], [2, false], [3, false], [0, true], [0, false]]), // you folded
      roundEnd(3, [[5, false], [0, true], [0, true], [0, true], [0, true]], 0), // you swept
      { type: "matchEnd", seat: 1 },
    ],
  };

  it("reports final scores, the last round's piles and your round tallies", () => {
    expect(muushigSoloReport(game, times)).toEqual({
      ...times,
      gameType: "muushig",
      me: 0,
      rounds: 3,
      players: [
        { score: 2, lastEaten: 5 },
        { score: -1, lastEaten: 0 },
        { score: 7, lastEaten: 0 },
        { score: 5, lastEaten: 0 },
        { score: 9, lastEaten: 0 },
      ],
      stats: { rounds_played: 3, rounds_won: 2, eaten: 8, gone_in: 2, folded: 1, sweeps: 1 },
    });
  });
});
