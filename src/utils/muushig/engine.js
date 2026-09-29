// MUUSHIG ENGINE — the rules of docs/muushig-rulebook.md as pure functions.
//
// Every action takes a state and returns a new one (the input is never
// changed), and throws on a move the rules don't allow. Nothing here touches
// React, timers or sockets, so the same file can run on the server later.
//
// A round moves through these phases:
//   DECIDE     each player, left of the dealer first, goes in or folds
//   SWAP       each playing player discards and draws (dealer last)
//   TRUMP      a playing dealer may swap a card for the face-up trump
//   PLAY       tricks; `turn` is whoever must play next
//   TRICK_END  every card is down; `trickWinner` is about to eat the pile
//   ROUND_END  scores are in; startNextRound() deals again
//   MATCH_OVER someone reached 0; `matchWinner` is set
//
// Seats are 0–4 and clockwise is seat + 1. Randomness comes in through an
// `rng` argument (default Math.random) so tests can make it predictable.

export const RANKS = ["7", "8", "9", "10", "J", "Q", "K", "A"];
export const SUITS = ["♠", "♥", "♦", "♣"];
export const PLAYER_COUNT = 5;
export const HAND_SIZE = 5;
export const TRICKS_PER_ROUND = 5;
export const START_SCORE = 15;
export const ZERO_PILES_PENALTY = 5;
export const MIN_PLAYING = 2;
export const MAX_FOLDS_IN_A_ROW = 2; // the next round after this many folds, you must go in

export const PHASES = {
  DECIDE: "DECIDE",
  SWAP: "SWAP",
  TRUMP: "TRUMP",
  PLAY: "PLAY",
  TRICK_END: "TRICK_END",
  ROUND_END: "ROUND_END",
  MATCH_OVER: "MATCH_OVER",
};

// ---- Cards -----------------------------------------------------------------

export function makeCard(rank, suit) {
  return { id: `${rank}${suit}`, rank, suit, rankValue: RANKS.indexOf(rank), suitValue: SUITS.indexOf(suit) };
}

export function createDeck() {
  return SUITS.flatMap((suit) => RANKS.map((rank) => makeCard(rank, suit)));
}

export function shuffle(cards, rng = Math.random) {
  const out = [...cards];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---- Seats -----------------------------------------------------------------

export const leftOf = (seat) => (seat + 1) % PLAYER_COUNT;

/** Seats starting left of the dealer, ending with the dealer. */
export function seatsFromDealer(dealer) {
  return Array.from({ length: PLAYER_COUNT }, (_, i) => (dealer + 1 + i) % PLAYER_COUNT);
}

const isPlaying = (state, seat) => state.players[seat].status === "play";
const playingCount = (state) => state.players.filter((p) => p.status === "play").length;

/** Next playing seat clockwise after `seat`. */
function nextPlaying(state, seat) {
  for (let i = 1; i <= PLAYER_COUNT; i++) {
    const s = (seat + i) % PLAYER_COUNT;
    if (isPlaying(state, s)) return s;
  }
  return null;
}

// ---- Match and round setup -------------------------------------------------

/**
 * players: [{ name, type: "HUMAN" | "AI", level?: "EASY"|"MEDIUM"|"HARD" }] ×5.
 * The first dealer is whoever draws the highest card (ties at random).
 */
export function createMatch({ players, rng = Math.random, matchNumber = 1, startScore = START_SCORE }) {
  if (players.length !== PLAYER_COUNT) throw new Error(`Muushig needs ${PLAYER_COUNT} players`);

  const draw = shuffle(createDeck(), rng).slice(0, PLAYER_COUNT);
  const top = Math.max(...draw.map((c) => c.rankValue));
  const tied = draw.map((c, seat) => (c.rankValue === top ? seat : -1)).filter((s) => s >= 0);
  const dealer = tied[Math.floor(rng() * tied.length)];

  const state = {
    matchNumber,
    roundNumber: 0,
    dealer,
    players: players.map((p, seat) => ({
      id: seat,
      name: p.name,
      type: p.type || "AI",
      level: p.level || null,
      avatar: p.avatar ?? null,
      score: startScore,
      hand: [],
      status: null,
      eaten: 0,
      discarded: [],
      foldStreak: 0, // rounds folded in a row; carries from round to round
    })),
    events: [{ type: "firstDealer", seat: dealer, draws: draw.map((card, seat) => ({ seat, card })) }],
    matchWinner: null,
  };
  return dealRound(state, dealer, rng);
}

function dealRound(prev, dealer, rng) {
  const state = { ...prev };
  const deck = shuffle(createDeck(), rng);
  const order = seatsFromDealer(dealer);
  const hands = Array.from({ length: PLAYER_COUNT }, () => []);
  let next = 0;
  for (let round = 0; round < HAND_SIZE; round++) {
    for (const seat of order) hands[seat].push(deck[next++]);
  }
  const trumpCard = deck[next++];

  state.roundNumber = prev.roundNumber + 1;
  state.dealer = dealer;
  state.players = prev.players.map((p, seat) => ({ ...p, hand: hands[seat], status: null, eaten: 0, discarded: [] }));
  state.trumpCard = trumpCard;
  state.trumpSuit = trumpCard.suit;
  state.trumpTakenBy = null;
  state.drawPile = deck.slice(next);
  state.deadPile = [];
  state.played = [];
  state.trick = [];
  state.trickNumber = 0;
  state.trickWinner = null;
  state.lastTrick = null;
  state.roundResults = null;
  state.phase = PHASES.DECIDE;
  state.turn = leftOf(dealer);
  state.events = [...prev.events, { type: "round", round: state.roundNumber, seat: dealer, card: trumpCard }];
  return state;
}

/** Deal the next round; the deal passes clockwise. */
export function startNextRound(prev, rng = Math.random) {
  if (prev.phase !== PHASES.ROUND_END) throw new Error("The round isn't over");
  return dealRound(prev, leftOf(prev.dealer), rng);
}

/** A fresh match with the same players. */
export function rematch(prev, rng = Math.random) {
  return createMatch({
    players: prev.players.map(({ name, type, level, avatar }) => ({ name, type, level, avatar })),
    rng,
    matchNumber: prev.matchNumber + 1,
  });
}

// ---- Helpers shared by actions and queries ---------------------------------

// Copies everything an action may change. Cards are copied too, since a
// debuff marks a card in hand.
function clone(state) {
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, hand: p.hand.map((c) => ({ ...c })), discarded: [...p.discarded] })),
    drawPile: [...state.drawPile],
    deadPile: [...state.deadPile],
    played: [...state.played],
    trick: state.trick.map((p) => ({ ...p })),
    events: [...state.events],
  };
}

function expect(state, phase, seat) {
  if (state.phase !== phase) throw new Error(`Not the ${phase} phase`);
  if (state.turn !== seat) throw new Error("Not your turn");
}

function takeFromHand(player, cardId) {
  const i = player.hand.findIndex((c) => c.id === cardId);
  if (i < 0) throw new Error(`${cardId} isn't in the hand`);
  return player.hand.splice(i, 1)[0];
}

// ---- DECIDE ----------------------------------------------------------------

/**
 * Why a player can't fold right now, or null if they can:
 *   "streak"  they folded the last MAX_FOLDS_IN_A_ROW rounds
 *   "short"   they're needed to make MIN_PLAYING players
 */
export function foldBlock(state, seat) {
  if ((state.players[seat].foldStreak ?? 0) >= MAX_FOLDS_IN_A_ROW) return "streak";
  const undecidedOthers = state.players.filter((p, s) => s !== seat && p.status === null).length;
  return playingCount(state) + undecidedOthers >= MIN_PLAYING ? null : "short";
}

export const canFold = (state, seat) => foldBlock(state, seat) === null;

export function decide(prev, seat, play) {
  expect(prev, PHASES.DECIDE, seat);
  const block = play ? null : foldBlock(prev, seat);
  if (block === "streak") throw new Error(`You folded ${MAX_FOLDS_IN_A_ROW} rounds in a row: you must go in`);
  if (block === "short") throw new Error(`At least ${MIN_PLAYING} players must go in`);
  const state = clone(prev);
  const player = state.players[seat];
  player.status = play ? "play" : "fold";
  player.foldStreak = play ? 0 : (player.foldStreak ?? 0) + 1;
  if (!play) {
    state.deadPile.push(...player.hand);
    player.hand = [];
  }
  state.events.push({ type: play ? "playIn" : "fold", seat });

  const order = seatsFromDealer(state.dealer);
  const next = order.find((s) => state.players[s].status === null);
  if (next !== undefined) {
    state.turn = next;
    return state;
  }
  state.phase = PHASES.SWAP;
  state.turn = order.find((s) => isPlaying(state, s));
  return skipSwapsWithEmptyPile(state);
}

// ---- SWAP ------------------------------------------------------------------

export const maxDiscard = (state) => Math.min(HAND_SIZE, state.drawPile.length);

export function swap(prev, seat, cardIds = []) {
  expect(prev, PHASES.SWAP, seat);
  if (new Set(cardIds).size !== cardIds.length) throw new Error("Duplicate cards");
  if (cardIds.length > maxDiscard(prev)) throw new Error("Not enough cards in the draw pile");
  const state = clone(prev);
  const player = state.players[seat];
  const out = cardIds.map((id) => takeFromHand(player, id));
  state.deadPile.push(...out);
  player.discarded.push(...out);
  player.hand.push(...state.drawPile.splice(0, out.length));
  state.events.push({ type: "swap", seat, count: out.length });
  return advanceSwap(state, seat);
}

function advanceSwap(state, seat) {
  const order = seatsFromDealer(state.dealer);
  const next = order.slice(order.indexOf(seat) + 1).find((s) => isPlaying(state, s));
  if (next !== undefined) {
    state.turn = next;
    return skipSwapsWithEmptyPile(state);
  }
  if (isPlaying(state, state.dealer)) {
    state.phase = PHASES.TRUMP;
    state.turn = state.dealer;
    return state;
  }
  return startPlay(state);
}

// With the draw pile empty nobody else can swap: record it and move on.
function skipSwapsWithEmptyPile(state) {
  if (state.phase !== PHASES.SWAP || state.drawPile.length > 0) return state;
  const seat = state.turn;
  state.events.push({ type: "swap", seat, count: 0, emptyPile: true });
  return advanceSwap(state, seat);
}

// ---- TRUMP -----------------------------------------------------------------

/** The dealer gives up `cardId` for the trump card, or passes with null. */
export function takeTrump(prev, seat, cardId = null) {
  expect(prev, PHASES.TRUMP, seat);
  const state = clone(prev);
  if (cardId) {
    const player = state.players[seat];
    const out = takeFromHand(player, cardId);
    state.deadPile.push(out);
    player.discarded.push(out);
    player.hand.push({ ...state.trumpCard });
    state.trumpTakenBy = seat;
    state.events.push({ type: "takeTrump", seat, card: state.trumpCard });
  } else {
    state.events.push({ type: "keepTrump", seat });
  }
  return startPlay(state);
}

// ---- PLAY ------------------------------------------------------------------

function startPlay(state) {
  state.phase = PHASES.PLAY;
  state.trickNumber = 1;
  state.trick = [];
  state.turn = nextPlaying(state, state.dealer);
  return state;
}

/** Suit of the first card in the trick that isn't debuffed (null if none). */
export function ledSuit(trick) {
  return trick.find((p) => !p.card.debuffed)?.card.suit ?? null;
}

/** How strong a card is in this trick: debuffed < off-suit < led suit < trump. */
export function cardPower(card, led, trumpSuit) {
  if (card.debuffed) return -2;
  if (card.suit === trumpSuit) return 100 + card.rankValue;
  if (card.suit === led) return card.rankValue;
  return -1;
}

/** Seat whose card eats the trick so far (the first card wins a full tie). */
export function trickWinner(trick, trumpSuit) {
  const led = ledSuit(trick);
  let best = null;
  for (const play of trick) {
    const power = cardPower(play.card, led, trumpSuit);
    if (!best || power > best.power) best = { seat: play.seat, power };
  }
  return best?.seat ?? null;
}

/**
 * The trick as it lies on the table, bottom first: a card that beats the top
 * card goes on top, anything weaker is tucked underneath.
 */
export function stackOrder(trick, trumpSuit) {
  const led = ledSuit(trick);
  const stack = [];
  for (const play of trick) {
    const top = stack[stack.length - 1];
    if (!top || cardPower(play.card, led, trumpSuit) > cardPower(top.card, led, trumpSuit)) stack.push(play);
    else stack.unshift(play);
  }
  return stack;
}

/**
 * Cards a player may put down (the hard rules). A debuffed card must go
 * first. With another suit led, a higher card of that suit must be played if
 * held. Trump rules are soft: breaking them is allowed but debuffs a card
 * (see penaltyFor).
 */
export function allowedPlays(state, seat) {
  const hand = state.players[seat].hand;
  const debuffed = hand.find((c) => c.debuffed);
  if (debuffed) return [debuffed];
  const led = ledSuit(state.trick);
  if (!led || led === state.trumpSuit) return hand;
  const onTable = state.trick.filter((p) => p.card.suit === led && !p.card.debuffed).map((p) => p.card.rankValue);
  const top = Math.max(-1, ...onTable);
  const higher = hand.filter((c) => c.suit === led && c.rankValue > top);
  return higher.length ? higher : hand;
}

/**
 * The card that playing `card` would debuff, or null. Two rules:
 *   Ace rule   holding the trump ace and playing something else when the ace
 *              was allowed debuffs the ace.
 *   Trump rule when a trump is on the table (led, or played on top of
 *              another suit) and you're free to play one, not playing a
 *              higher trump (or any trump, with no higher one) debuffs your
 *              highest trump left.
 */
export function penaltyFor(state, seat, card) {
  const hand = state.players[seat].hand;
  if (hand.some((c) => c.debuffed)) return null; // a forced play is never punished
  const allowed = allowedPlays(state, seat);
  const trump = state.trumpSuit;

  const ace = hand.find((c) => c.suit === trump && c.rank === "A");
  if (ace && card.id !== ace.id && allowed.some((c) => c.id === ace.id)) return ace;

  const onTable = state.trick.filter((p) => p.card.suit === trump && !p.card.debuffed);
  if (!onTable.length) return null;
  // Following a higher card of the led suit comes first: then trumps aren't allowed.
  const trumps = allowed.filter((c) => c.suit === trump);
  if (!trumps.length) return null;
  const best = Math.max(...onTable.map((p) => p.card.rankValue));
  const higher = trumps.filter((c) => c.rankValue > best);
  const required = higher.length ? higher : trumps;
  if (required.some((c) => c.id === card.id)) return null;
  const kept = trumps.filter((c) => c.id !== card.id);
  return kept.reduce((a, c) => (c.rankValue > a.rankValue ? c : a), kept[0]) ?? null;
}

export function playCard(prev, seat, cardId) {
  expect(prev, PHASES.PLAY, seat);
  const allowed = allowedPlays(prev, seat);
  const chosen = allowed.find((c) => c.id === cardId);
  if (!chosen) throw new Error(`${cardId} can't be played now`);
  const penalty = penaltyFor(prev, seat, chosen);

  const state = clone(prev);
  const player = state.players[seat];
  const card = takeFromHand(player, cardId);
  state.trick.push({ seat, card });
  state.played.push(card);
  state.events.push({ type: "play", seat, card, trick: state.trickNumber });
  if (penalty) {
    const hit = player.hand.find((c) => c.id === penalty.id);
    hit.debuffed = true;
    state.events.push({
      type: "debuff",
      seat,
      card: { ...hit },
      reason: penalty.rank === "A" && penalty.suit === state.trumpSuit ? "ace" : "trump",
    });
  }

  if (state.trick.length === playingCount(state)) {
    state.phase = PHASES.TRICK_END;
    state.trickWinner = trickWinner(state.trick, state.trumpSuit);
    state.turn = null;
  } else {
    state.turn = nextPlaying(state, seat);
  }
  return state;
}

/** The trick's winner eats the pile; the next trick or the scoring follows. */
export function collectTrick(prev) {
  if (prev.phase !== PHASES.TRICK_END) throw new Error("The trick isn't finished");
  const state = clone(prev);
  const winner = state.trickWinner;
  state.players[winner].eaten += 1;
  state.events.push({ type: "eat", seat: winner, trick: state.trickNumber, cards: state.trick.map((p) => p.card) });
  state.lastTrick = { winner, trick: state.trick };
  state.trick = [];
  state.trickWinner = null;
  if (state.trickNumber >= TRICKS_PER_ROUND) return endRound(state);
  state.trickNumber += 1;
  state.phase = PHASES.PLAY;
  state.turn = winner;
  return state;
}

// ---- Scoring ---------------------------------------------------------------

/** Score change for a round: 0 when folded, −1 per pile, +5 for none. */
export function roundDelta(player) {
  if (player.status !== "play") return 0;
  return player.eaten > 0 ? -player.eaten : ZERO_PILES_PENALTY;
}

function endRound(state) {
  const results = state.players.map((p, seat) => {
    const delta = roundDelta(p);
    p.score += delta;
    return { seat, eaten: p.eaten, folded: p.status !== "play", delta, score: p.score };
  });
  const sweeper = state.players.findIndex((p) => p.eaten >= TRICKS_PER_ROUND);
  state.roundResults = { results, roundWinner: sweeper >= 0 ? sweeper : null };
  state.events.push({ type: "roundEnd", round: state.roundNumber, results, roundWinner: state.roundResults.roundWinner });
  state.turn = null;

  const finished = state.players.filter((p) => p.score <= 0);
  if (!finished.length) {
    state.phase = PHASES.ROUND_END;
    return state;
  }
  const winner = [...finished].sort((a, b) => a.score - b.score || b.eaten - a.eaten || a.id - b.id)[0];
  state.matchWinner = winner.id;
  state.phase = PHASES.MATCH_OVER;
  state.events.push({ type: "matchEnd", seat: winner.id });
  return state;
}
