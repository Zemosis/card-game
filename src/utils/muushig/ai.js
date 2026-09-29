// MUUSHIG AI — CPU players at three levels (EASY, MEDIUM, HARD).
//
// One entry point, aiAction(state, rng), returns the move for whoever's turn
// it is as { type, ... }; applyAction(state, action) plays it through the
// engine. Every level only picks moves the engine allows.
//
//   EASY    plays loosely: folds or plays on a whim, swaps little, throws a
//           random allowed card and sometimes breaks a trump rule.
//   MEDIUM  judges its hand, swaps weak cards, eats with the cheapest card
//           that wins, otherwise throws its weakest card.
//   HARD    like MEDIUM, but counts cards: it knows when a trump can't be
//           beaten, holds strength when it can't be sure, and fights harder
//           for its first pile when it risks the +5.
// Every level takes the trump card when it's better than its weakest card.

import {
  PHASES,
  RANKS,
  SUITS,
  TRICKS_PER_ROUND,
  allowedPlays,
  canFold,
  cardPower,
  collectTrick,
  decide,
  ledSuit,
  makeCard,
  maxDiscard,
  penaltyFor,
  playCard,
  swap,
  takeTrump,
  trickWinner,
} from "./engine.js";

const TRUMP_WORTH = [0.35, 0.35, 0.4, 0.45, 0.55, 0.7, 0.85, 1];
const PLAIN_WORTH = [0, 0, 0, 0, 0.05, 0.1, 0.3, 0.55];

/** Rough chance (0–1) that a card eats a pile. */
export function cardWorth(card, trumpSuit) {
  if (card.debuffed) return 0;
  return (card.suit === trumpSuit ? TRUMP_WORTH : PLAIN_WORTH)[card.rankValue];
}

/** Expected piles a hand eats, roughly. */
export function handStrength(hand, trumpSuit) {
  return hand.reduce((sum, c) => sum + cardWorth(c, trumpSuit), 0);
}

const pick = (list, rng) => list[Math.floor(rng() * list.length)];
const weakestFirst = (list, trumpSuit) =>
  [...list].sort((a, b) => cardWorth(a, trumpSuit) - cardWorth(b, trumpSuit) || a.rankValue - b.rankValue);

// ---- DECIDE ----------------------------------------------------------------

function wantsToPlay(state, seat, level, rng) {
  if (!canFold(state, seat)) return true;
  const { hand, score } = state.players[seat];
  const trump = state.trumpSuit;
  const strength = handStrength(hand, trump);
  const weak = hand.filter((c) => cardWorth(c, trump) < 0.2).length;

  if (level === "EASY") return strength >= 1 || rng() < 0.15;

  // Cards still to draw for this player, assuming earlier swappers take some.
  const alreadyIn = state.players.filter((p) => p.status === "play").length;
  const pileLeft = Math.max(0, state.drawPile.length - alreadyIn * 1.5);
  const swapBoost = Math.min(pileLeft, weak) * 0.08;

  if (level === "MEDIUM") return strength + swapBoost + (rng() - 0.5) * 0.3 >= 1.1 + alreadyIn * 0.1;

  // HARD: more players in means fewer piles to go round; a player far from 0
  // can afford the risk, one close to 0 guards their lead.
  let bar = 0.95 + alreadyIn * 0.15;
  if (score > 15) bar -= 0.15;
  if (score <= 4) bar += 0.1;
  return strength + swapBoost >= bar;
}

// ---- SWAP ------------------------------------------------------------------

function chooseDiscards(state, seat, level, rng) {
  const { hand } = state.players[seat];
  const trump = state.trumpSuit;
  const limit = maxDiscard(state);
  if (!limit) return [];
  let out;
  if (level === "EASY") {
    out = weakestFirst(hand.filter((c) => cardWorth(c, trump) < 0.05), trump).slice(0, Math.floor(rng() * 3));
  } else if (level === "MEDIUM") {
    out = weakestFirst(hand.filter((c) => c.suit !== trump && cardWorth(c, trump) < 0.3), trump);
  } else {
    const keepKings = state.drawPile.length < 3;
    out = weakestFirst(
      hand.filter((c) => c.suit !== trump && (cardWorth(c, trump) < 0.3 || (c.rank === "K" && !keepKings))),
      trump,
    );
  }
  return out.slice(0, limit).map((c) => c.id);
}

// ---- TRUMP -----------------------------------------------------------------

/** Every level: swap the weakest card for the trump card if it's better. */
function chooseTrumpSwap(state, seat) {
  const trump = state.trumpSuit;
  const weakest = weakestFirst(state.players[seat].hand, trump)[0];
  if (!weakest) return null;
  return cardWorth(state.trumpCard, trump) > cardWorth(weakest, trump) || weakest.suit !== trump ? weakest.id : null;
}

// ---- PLAY ------------------------------------------------------------------

/** Power of `card` if it were played now, and whether it would be on top. */
function wouldWin(state, card) {
  const trick = [...state.trick, { seat: -1, card }];
  return trickWinner(trick, state.trumpSuit) === -1;
}

const powerNow = (state, card) => cardPower(card, ledSuit(state.trick) ?? card.suit, state.trumpSuit);

/** Cards this player hasn't seen: not in hand, not played, not discarded by them, not the face-up trump. */
function unseenCards(state, seat) {
  const player = state.players[seat];
  const seen = new Set([...player.hand, ...state.played, ...player.discarded].map((c) => c.id));
  if (state.trumpTakenBy === null) seen.add(state.trumpCard.id);
  return SUITS.flatMap((s) => RANKS.map((r) => makeCard(r, s))).filter((c) => !seen.has(c.id));
}

/** A trump nobody can beat any more (HARD's card counting). */
function isSure(state, seat, card) {
  const trump = state.trumpSuit;
  const unseen = unseenCards(state, seat);
  if (card.suit !== trump) return !unseen.some((c) => c.suit === trump) && !unseen.some((c) => c.suit === card.suit && c.rankValue > card.rankValue);
  return !unseen.some((c) => c.suit === trump && c.rankValue > card.rankValue);
}

function choosePlay(state, seat, level, rng) {
  const allowed = allowedPlays(state, seat);
  if (allowed.length === 1) return allowed[0].id;
  const safe = allowed.filter((c) => !penaltyFor(state, seat, c));
  const trump = state.trumpSuit;

  if (level === "EASY") {
    const pool = rng() < 0.15 || !safe.length ? allowed : safe;
    return pick(pool, rng).id;
  }

  const pool = safe.length ? safe : allowed;
  const byPower = [...pool].sort((a, b) => powerNow(state, a) - powerNow(state, b));
  const weakest = weakestFirst(pool, trump)[0];
  const strongest = byPower[byPower.length - 1];
  const player = state.players[seat];
  const tricksLeft = TRICKS_PER_ROUND - state.trickNumber + 1;
  const hungry = player.eaten === 0; // one pile saves the +5

  // Leading.
  if (!state.trick.length) {
    if (level === "HARD") {
      const sure = byPower.filter((c) => isSure(state, seat, c));
      if (sure.length) return sure[0].id;
      if (hungry && tricksLeft <= 2) return strongest.id;
      return weakest.id;
    }
    return cardWorth(strongest, trump) >= 0.55 ? strongest.id : weakest.id;
  }

  // Following: which cards would put us on top?
  const winners = byPower.filter((c) => wouldWin(state, c));
  if (!winners.length) return weakest.id;
  if (level === "MEDIUM") return winners[0].id;

  const playing = state.players.filter((p) => p.status === "play").length;
  const isLast = state.trick.length === playing - 1;
  if (isLast) return winners[0].id;
  const sure = winners.filter((c) => isSure(state, seat, c));
  if (sure.length) return sure[0].id;
  if (hungry) return winners[winners.length - 1].id;
  // Not sure to hold: only risk a cheap card, keep the strong ones.
  const cheap = winners.filter((c) => cardWorth(c, trump) < 0.5);
  return cheap.length ? cheap[0].id : weakest.id;
}

// ---- Entry points ----------------------------------------------------------

/** The move for whoever's turn it is, at their level. */
export function aiAction(state, rng = Math.random) {
  const seat = state.turn;
  const level = state.players[seat]?.level || "MEDIUM";
  switch (state.phase) {
    case PHASES.DECIDE:
      return { type: "decide", seat, play: wantsToPlay(state, seat, level, rng) };
    case PHASES.SWAP:
      return { type: "swap", seat, cardIds: chooseDiscards(state, seat, level, rng) };
    case PHASES.TRUMP:
      return { type: "takeTrump", seat, cardId: chooseTrumpSwap(state, seat) };
    case PHASES.PLAY:
      return { type: "play", seat, cardId: choosePlay(state, seat, level, rng) };
    default:
      return null;
  }
}

/** Runs an action (from the AI or the player) through the engine. */
export function applyAction(state, action) {
  switch (action.type) {
    case "decide":
      return decide(state, action.seat, action.play);
    case "swap":
      return swap(state, action.seat, action.cardIds);
    case "takeTrump":
      return takeTrump(state, action.seat, action.cardId);
    case "play":
      return playCard(state, action.seat, action.cardId);
    case "collect":
      return collectTrick(state);
    default:
      throw new Error(`Unknown action ${action.type}`);
  }
}
