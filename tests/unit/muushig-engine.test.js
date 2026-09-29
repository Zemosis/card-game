// Muushig engine: every rule in docs/muushig-rulebook.md.

import { describe, it, expect } from "vitest";
import {
  PHASES,
  START_SCORE,
  allowedPlays,
  canFold,
  collectTrick,
  createDeck,
  createMatch,
  decide,
  makeCard,
  maxDiscard,
  penaltyFor,
  playCard,
  rematch,
  stackOrder,
  startNextRound,
  swap,
  takeTrump,
  trickWinner,
} from "../../src/utils/muushig/engine.js";
import { seededRandom } from "../helpers/cards.js";

const c = (id) => makeCard(id.slice(0, -1), id.slice(-1));
const cs = (ids) => (ids.trim() ? ids.trim().split(/\s+/).map(c) : []);
const idsOf = (list) => list.map((x) => x.id);

const PLAYERS = ["You", "Sarnai", "Batu", "Glitch", "Temur"].map((name, i) => ({ name, type: i ? "AI" : "HUMAN", level: "MEDIUM" }));
const newMatch = (seed = 1) => createMatch({ players: PLAYERS, rng: seededRandom(seed) });

/** A PLAY-phase state: hands per seat (null = folded), the trick so far, whose turn. */
function playState({ hands, trump = "♦", trick = [], turn, dealer = 4, trickNumber = 1, eaten = [0, 0, 0, 0, 0], scores }) {
  return {
    matchNumber: 1,
    roundNumber: 1,
    dealer,
    players: hands.map((h, seat) => ({
      id: seat,
      name: PLAYERS[seat].name,
      type: "AI",
      level: "MEDIUM",
      score: scores ? scores[seat] : START_SCORE,
      hand: cs(h ?? ""),
      status: h === null ? "fold" : "play",
      eaten: eaten[seat],
      discarded: [],
    })),
    trumpCard: c(`9${trump}`),
    trumpSuit: trump,
    trumpTakenBy: null,
    drawPile: [],
    deadPile: [],
    played: [],
    trick: trick.map(([seat, id]) => ({ seat, card: c(id) })),
    trickNumber,
    trickWinner: null,
    phase: PHASES.PLAY,
    turn,
    events: [],
    matchWinner: null,
  };
}

describe("deck and deal", () => {
  it("uses 32 cards, 7 through A", () => {
    const deck = createDeck();
    expect(deck).toHaveLength(32);
    expect(new Set(deck.map((x) => x.rank))).toEqual(new Set(["7", "8", "9", "10", "J", "Q", "K", "A"]));
  });

  it("deals 5 each, turns one trump card, leaves 6 to draw", () => {
    const s = newMatch();
    s.players.forEach((p) => expect(p.hand).toHaveLength(5));
    expect(s.drawPile).toHaveLength(6);
    expect(s.trumpSuit).toBe(s.trumpCard.suit);
    const all = [...s.players.flatMap((p) => p.hand), ...s.drawPile, s.trumpCard];
    expect(new Set(idsOf(all)).size).toBe(32);
    expect(s.phase).toBe(PHASES.DECIDE);
    expect(s.turn).toBe((s.dealer + 1) % 5);
    expect(s.players.every((p) => p.score === START_SCORE)).toBe(true);
  });

  it("picks the first dealer by the highest drawn card", () => {
    const s = newMatch(7);
    const draw = s.events.find((e) => e.type === "firstDealer");
    const top = Math.max(...draw.draws.map((d) => d.card.rankValue));
    expect(draw.draws[s.dealer].card.rankValue).toBe(top);
  });
});

describe("play or fold", () => {
  it("goes left of the dealer first, folded hands go to the dead pile", () => {
    let s = newMatch();
    const first = s.turn;
    const hand = s.players[first].hand;
    s = decide(s, first, false);
    expect(s.players[first].status).toBe("fold");
    expect(s.players[first].hand).toEqual([]);
    expect(idsOf(s.deadPile)).toEqual(idsOf(hand));
    expect(s.turn).toBe((first + 1) % 5);
  });

  it("needs at least 2 players", () => {
    let s = newMatch();
    for (let i = 0; i < 3; i++) s = decide(s, s.turn, false);
    // 2 left undecided: both must play.
    expect(canFold(s, s.turn)).toBe(false);
    expect(() => decide(s, s.turn, false)).toThrow(/2 players/);
    s = decide(s, s.turn, true);
    expect(canFold(s, s.turn)).toBe(false);
    s = decide(s, s.turn, true);
    expect(s.phase).toBe(PHASES.SWAP);
  });

  it("rejects a move out of turn", () => {
    const s = newMatch();
    expect(() => decide(s, (s.turn + 1) % 5, true)).toThrow(/turn/);
  });
});

function allPlay(s) {
  while (s.phase === PHASES.DECIDE) s = decide(s, s.turn, true);
  return s;
}

describe("swapping", () => {
  it("discards to the dead pile and draws the same number", () => {
    let s = allPlay(newMatch());
    const seat = s.turn;
    expect(seat).toBe((s.dealer + 1) % 5);
    const out = idsOf(s.players[seat].hand.slice(0, 2));
    const top2 = idsOf(s.drawPile.slice(0, 2));
    s = swap(s, seat, out);
    expect(s.players[seat].hand).toHaveLength(5);
    expect(idsOf(s.players[seat].hand)).toEqual(expect.arrayContaining(top2));
    expect(idsOf(s.deadPile)).toEqual(out);
    expect(s.drawPile).toHaveLength(4);
  });

  it("can't discard more than the draw pile holds, and skips everyone once it's empty", () => {
    let s = allPlay(newMatch());
    expect(maxDiscard(s)).toBe(5);
    s = swap(s, s.turn, idsOf(s.players[s.turn].hand.slice(0, 5)));
    expect(maxDiscard(s)).toBe(1);
    expect(() => swap(s, s.turn, idsOf(s.players[s.turn].hand.slice(0, 2)))).toThrow(/draw pile/);
    s = swap(s, s.turn, idsOf(s.players[s.turn].hand.slice(0, 1)));
    // Pile empty: the rest (dealer included) are skipped, straight to the trump.
    expect(s.phase).toBe(PHASES.TRUMP);
    expect(s.turn).toBe(s.dealer);
    expect(s.events.filter((e) => e.type === "swap" && e.emptyPile)).toHaveLength(3);
  });

  it("the dealer swaps last, then may take the trump for one card", () => {
    let s = allPlay(newMatch());
    while (s.phase === PHASES.SWAP) s = swap(s, s.turn, []);
    expect(s.phase).toBe(PHASES.TRUMP);
    const dealer = s.dealer;
    const give = s.players[dealer].hand[0];
    s = takeTrump(s, dealer, give.id);
    expect(idsOf(s.players[dealer].hand)).toContain(s.trumpCard.id);
    expect(idsOf(s.players[dealer].hand)).not.toContain(give.id);
    expect(s.trumpTakenBy).toBe(dealer);
    expect(s.phase).toBe(PHASES.PLAY);
    expect(s.turn).toBe((dealer + 1) % 5);
  });

  it("a folded dealer never gets the trump option", () => {
    let s = newMatch();
    while (s.phase === PHASES.DECIDE) s = decide(s, s.turn, s.turn !== s.dealer);
    while (s.phase === PHASES.SWAP) s = swap(s, s.turn, []);
    expect(s.phase).toBe(PHASES.PLAY);
    expect(s.turn).toBe((s.dealer + 1) % 5);
  });
});

describe("what you must play", () => {
  it("other suit led: a higher card of that suit must be played", () => {
    const s = playState({ hands: ["10♠ A♠ J♦ 7♥", "", "", "", ""], trick: [[2, "9♠"], [4, "8♦"]], turn: 0 });
    expect(idsOf(allowedPlays(s, 0))).toEqual(["10♠", "A♠"]);
  });

  it("other suit led, none higher: anything goes", () => {
    const s = playState({ hands: ["8♠ J♦ 7♥", "", "", "", ""], trick: [[2, "9♠"]], turn: 0 });
    expect(idsOf(allowedPlays(s, 0))).toEqual(["8♠", "J♦", "7♥"]);
  });

  it("a debuffed card is the only card you may play", () => {
    const s = playState({ hands: ["10♠ A♠ 7♥", "", "", "", ""], trick: [[2, "9♠"]], turn: 0 });
    s.players[0].hand.push({ ...c("A♦"), debuffed: true });
    expect(idsOf(allowedPlays(s, 0))).toEqual(["A♦"]);
    expect(penaltyFor(s, 0, s.players[0].hand[3])).toBeNull();
  });
});

describe("debuffs", () => {
  it("trump led: not playing a higher trump debuffs your highest trump", () => {
    let s = playState({ hands: ["K♦ 8♦ 7♣", "7♠", "9♠", "7♥", "8♥"], trick: [[2, "Q♦"]], turn: 0 });
    expect(penaltyFor(s, 0, c("8♦")).id).toBe("K♦");
    expect(penaltyFor(s, 0, c("K♦"))).toBeNull();
    s = playCard(s, 0, "8♦");
    expect(s.players[0].hand.find((x) => x.id === "K♦").debuffed).toBe(true);
    expect(s.events.at(-1)).toMatchObject({ type: "debuff", seat: 0, reason: "trump" });
  });

  it("trump led, no higher trump: any trump is fine, a non-trump debuffs", () => {
    const s = playState({ hands: ["8♦ 7♣", "", "", "", ""], trick: [[2, "Q♦"]], turn: 0 });
    expect(penaltyFor(s, 0, c("8♦"))).toBeNull();
    expect(penaltyFor(s, 0, c("7♣")).id).toBe("8♦");
  });

  it("Ace rule: leading with the trump ace in hand, anything else debuffs it", () => {
    const s = playState({ hands: ["A♦ Q♣", "", "", "", ""], turn: 0 });
    expect(penaltyFor(s, 0, c("Q♣")).id).toBe("A♦");
    expect(penaltyFor(s, 0, c("A♦"))).toBeNull();
  });

  it("Ace rule doesn't apply when you must follow another suit", () => {
    const s = playState({ hands: ["A♦ K♣", "", "", "", ""], trick: [[2, "Q♣"]], turn: 0 });
    expect(idsOf(allowedPlays(s, 0))).toEqual(["K♣"]);
    expect(penaltyFor(s, 0, c("K♣"))).toBeNull();
  });

  it("a debuffed card never wins, and doesn't set the led suit", () => {
    const trick = [
      { seat: 0, card: { ...c("A♦"), debuffed: true } },
      { seat: 1, card: c("7♣") },
      { seat: 2, card: c("9♣") },
    ];
    expect(trickWinner(trick, "♦")).toBe(2);
  });
});

describe("the stack and who eats", () => {
  it("the highest trump eats; otherwise the highest led card", () => {
    const trick = [
      { seat: 2, card: c("9♠") },
      { seat: 4, card: c("8♦") },
      { seat: 0, card: c("A♠") },
    ];
    expect(trickWinner(trick, "♦")).toBe(4);
    expect(trickWinner(trick, "♥")).toBe(0);
  });

  it("an off-suit card never wins, even if higher", () => {
    expect(trickWinner([{ seat: 0, card: c("7♣") }, { seat: 1, card: c("A♠") }], "♦")).toBe(0);
  });

  it("stacks winners on top and tucks the rest under", () => {
    const trick = [
      { seat: 2, card: c("9♠") },
      { seat: 4, card: c("8♦") },
      { seat: 0, card: c("10♠") },
    ];
    expect(stackOrder(trick, "♦").map((p) => p.card.id)).toEqual(["10♠", "9♠", "8♦"]);
  });
});

describe("tricks and scoring", () => {
  it("the eater leads the next trick", () => {
    let s = playState({ hands: ["9♠ 7♥", "K♠ 7♣", null, null, null], turn: 0, dealer: 4 });
    s = playCard(s, 0, "9♠");
    s = playCard(s, 1, "K♠");
    expect(s.phase).toBe(PHASES.TRICK_END);
    expect(s.trickWinner).toBe(1);
    s = collectTrick(s);
    expect(s.players[1].eaten).toBe(1);
    expect(s.turn).toBe(1);
    expect(s.trickNumber).toBe(2);
  });

  it("scores −1 per pile, +5 for none, nothing when folded; 5 piles wins the round", () => {
    let s = playState({
      hands: ["A♦", "7♣", null, "8♣", null],
      turn: 0,
      trickNumber: 5,
      eaten: [4, 0, 0, 0, 0],
      scores: [10, 15, 12, 15, 15],
    });
    s = playCard(s, 0, "A♦");
    s = playCard(s, 1, "7♣");
    s = playCard(s, 3, "8♣");
    s = collectTrick(s);
    expect(s.phase).toBe(PHASES.ROUND_END);
    expect(s.players.map((p) => p.score)).toEqual([5, 20, 12, 20, 15]);
    expect(s.roundResults.roundWinner).toBe(0);
  });

  it("ends the match at 0, lowest score wins", () => {
    let s = playState({ hands: ["A♦", "K♦", null, null, null], turn: 0, trickNumber: 5, eaten: [1, 2, 0, 0, 0], scores: [2, 3, 9, 9, 9] });
    s = playCard(s, 0, "A♦");
    s = playCard(s, 1, "K♦");
    s = collectTrick(s);
    expect(s.players[0].score).toBe(0);
    expect(s.players[1].score).toBe(1);
    expect(s.phase).toBe(PHASES.MATCH_OVER);
    expect(s.matchWinner).toBe(0);
  });

  it("the deal passes clockwise; a rematch starts a new match", () => {
    let s = playState({ hands: ["A♦", "K♦", null, null, null], turn: 0, trickNumber: 5, dealer: 2 });
    s = collectTrick(playCard(playCard(s, 0, "A♦"), 1, "K♦"));
    const next = startNextRound(s, seededRandom(3));
    expect(next.dealer).toBe(3);
    expect(next.roundNumber).toBe(2);
    expect(next.players[0].score).toBe(s.players[0].score);
    const again = rematch(next, seededRandom(4));
    expect(again.matchNumber).toBe(2);
    expect(again.players.every((p) => p.score === START_SCORE)).toBe(true);
  });
});

describe("a whole match", () => {
  it("runs to a winner (seat 0 always plays, the others fold when they can)", () => {
    const rng = seededRandom(11);
    let s = createMatch({ players: PLAYERS, rng });
    for (let steps = 0; steps < 5000 && s.phase !== PHASES.MATCH_OVER; steps++) {
      if (s.phase === PHASES.DECIDE) s = decide(s, s.turn, s.turn === 0 || !canFold(s, s.turn));
      else if (s.phase === PHASES.SWAP) s = swap(s, s.turn, []);
      else if (s.phase === PHASES.TRUMP) s = takeTrump(s, s.turn, s.players[s.turn].hand[0].id);
      else if (s.phase === PHASES.PLAY) s = playCard(s, s.turn, allowedPlays(s, s.turn)[0].id);
      else if (s.phase === PHASES.TRICK_END) s = collectTrick(s);
      else if (s.phase === PHASES.ROUND_END) s = startNextRound(s, rng);
    }
    expect(s.phase).toBe(PHASES.MATCH_OVER);
    expect(s.players[s.matchWinner].score).toBeLessThanOrEqual(0);
  });
});
