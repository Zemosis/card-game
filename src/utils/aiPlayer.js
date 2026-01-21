// AI PLAYER - Decision Making & Strategy

import { COMBO_TYPES, RANK_VALUES } from "./constants.js";
import {
  groupByRank,
  groupBySuit,
  sortHand,
  findLowestCard,
  findHighestCard,
} from "./deckUtils.js";
import {
  identifyCombination,
  validatePlay,
  findValidPlays,
} from "./handEvaluator.js";

// AI DECISION MAKING

/**
 * Main AI decision function - decides whether to play or pass
 * @param {Object} player - AI player object
 * @param {Object|null} currentPlay - Current combination on table
 * @param {Object} gameState - Complete game state
 * @returns {Object} { action: 'play'|'pass', cards: Array|null }
 */
export const makeAIDecision = (player, currentPlay, gameState) => {
  const hand = player.hand;

  // If leading (no current play), play lowest safe combination
  if (!currentPlay) {
    return leadPlay(hand, gameState);
  }

  // Try to find a play that beats current combination
  const validPlays = findValidPlaysFromHand(hand, currentPlay);

  if (validPlays.length === 0) {
    return { action: "pass", cards: null };
  }

  // Decide whether to play or pass strategically
  const shouldPlay = evaluatePlayingStrategy(
    player,
    validPlays,
    currentPlay,
    gameState,
  );

  if (!shouldPlay) {
    return { action: "pass", cards: null };
  }

  // Select best play from valid options
  const selectedPlay = selectBestPlay(validPlays, hand, gameState);

  return {
    action: "play",
    cards: selectedPlay.cards,
  };
};

// LEADING PLAY (When AI starts the trick)

/**
 * AI decides what to play when leading
 */
const leadPlay = (hand, gameState) => {
  const cardsLeft = hand.length;

  // If only one card left, play it
  if (cardsLeft === 1) {
    return { action: "play", cards: hand };
  }

  // Try to find pairs, triples, or four-of-a-kind (efficient plays)
  const groups = groupByRank(hand);

  // Look for pairs/triples/quads starting from lowest
  for (const rank of Object.keys(groups).sort(
    (a, b) => RANK_VALUES[a] - RANK_VALUES[b],
  )) {
    const group = groups[rank];

    // Play four of a kind (powerful, get rid of 4 cards)
    if (group.length === 4) {
      return { action: "play", cards: group };
    }

    // Play triple
    if (group.length === 3) {
      return { action: "play", cards: group };
    }

    // Play pair (if less than 8 cards left, be more aggressive)
    if (group.length === 2 && cardsLeft < 8) {
      return { action: "play", cards: group };
    }
  }

  // Check for 5-card combinations (straights, flushes, etc.)
  if (cardsLeft >= 5) {
    const fiveCardPlay = findBest5CardCombo(hand);
    if (fiveCardPlay) {
      return { action: "play", cards: fiveCardPlay };
    }
  }

  // Default: play lowest single card
  const lowestCard = findLowestCard(hand);
  return { action: "play", cards: [lowestCard] };
};

// FIND VALID PLAYS FROM HAND

/**
 * Finds all valid plays that can beat current combination
 */
const findValidPlaysFromHand = (hand, currentPlay) => {
  const targetLength = currentPlay.cards.length;
  const possiblePlays = [];

  // Generate combinations of the same length
  if (targetLength === 1) {
    // Single cards that beat current
    for (const card of hand) {
      const combo = identifyCombination([card]);
      const validation = validatePlay([card], currentPlay);
      if (validation.valid) {
        possiblePlays.push(combo);
      }
    }
  } else if (targetLength === 2) {
    // Pairs
    const groups = groupByRank(hand);
    for (const rank of Object.keys(groups)) {
      if (groups[rank].length >= 2) {
        const pair = groups[rank].slice(0, 2);
        const validation = validatePlay(pair, currentPlay);
        if (validation.valid) {
          possiblePlays.push(identifyCombination(pair));
        }
      }
    }
  } else if (targetLength === 3) {
    // Triples
    const groups = groupByRank(hand);
    for (const rank of Object.keys(groups)) {
      if (groups[rank].length >= 3) {
        const triple = groups[rank].slice(0, 3);
        const validation = validatePlay(triple, currentPlay);
        if (validation.valid) {
          possiblePlays.push(identifyCombination(triple));
        }
      }
    }
  } else if (targetLength === 4) {
    // Four of a kind
    const groups = groupByRank(hand);
    for (const rank of Object.keys(groups)) {
      if (groups[rank].length === 4) {
        const quad = groups[rank];
        const validation = validatePlay(quad, currentPlay);
        if (validation.valid) {
          possiblePlays.push(identifyCombination(quad));
        }
      }
    }
  } else if (targetLength === 5) {
    // 5-card combinations
    const fiveCardCombos = findAll5CardCombos(hand);
    for (const combo of fiveCardCombos) {
      const validation = validatePlay(combo, currentPlay);
      if (validation.valid) {
        possiblePlays.push(identifyCombination(combo));
      }
    }
  }

  return possiblePlays;
};

// 5-CARD COMBINATION FINDING

/**
 * Finds best 5-card combination in hand
 */
const findBest5CardCombo = (hand) => {
  const combos = findAll5CardCombos(hand);

  if (combos.length === 0) return null;

  // Prefer straights and flushes (easier to make)
  for (const combo of combos) {
    const identified = identifyCombination(combo);
    if (
      identified &&
      [
        COMBO_TYPES.STRAIGHT,
        COMBO_TYPES.FLUSH,
        COMBO_TYPES.FULL_HOUSE,
      ].includes(identified.type)
    ) {
      return combo;
    }
  }

  return combos[0];
};

/**
 * Finds all possible 5-card combinations
 */
const findAll5CardCombos = (hand) => {
  if (hand.length < 5) return [];

  const combos = [];

  // Check for straights
  const straights = findStraights(hand);
  combos.push(...straights);

  // Check for flushes
  const flushes = findFlushes(hand);
  combos.push(...flushes);

  // Check for full houses
  const fullHouses = findFullHouses(hand);
  combos.push(...fullHouses);

  return combos;
};

/**
 * Finds straight combinations
 */
const findStraights = (hand) => {
  const sorted = sortHand(hand);
  const straights = [];

  for (let i = 0; i <= sorted.length - 5; i++) {
    const potential = sorted.slice(i, i + 5);
    let isStraight = true;

    for (let j = 0; j < 4; j++) {
      if (potential[j + 1].rankValue !== potential[j].rankValue + 1) {
        isStraight = false;
        break;
      }
    }

    if (isStraight) {
      straights.push(potential);
    }
  }

  return straights;
};

/**
 * Finds flush combinations
 */
const findFlushes = (hand) => {
  const groups = groupBySuit(hand);
  const flushes = [];

  for (const suit of Object.keys(groups)) {
    if (groups[suit].length >= 5) {
      // Take lowest 5 cards of same suit
      const sorted = sortHand(groups[suit]);
      flushes.push(sorted.slice(0, 5));
    }
  }

  return flushes;
};

/**
 * Finds full house combinations
 */
const findFullHouses = (hand) => {
  const groups = groupByRank(hand);
  const fullHouses = [];

  const triples = [];
  const pairs = [];

  for (const rank of Object.keys(groups)) {
    if (groups[rank].length >= 3) {
      triples.push(groups[rank].slice(0, 3));
    }
    if (groups[rank].length >= 2) {
      pairs.push(groups[rank].slice(0, 2));
    }
  }

  // Combine triples with pairs
  for (const triple of triples) {
    for (const pair of pairs) {
      // Make sure they're different ranks
      if (triple[0].rank !== pair[0].rank) {
        fullHouses.push([...triple, ...pair]);
      }
    }
  }

  return fullHouses;
};

// STRATEGIC DECISION MAKING

/**
 * Evaluates whether AI should play or pass strategically
 */
const evaluatePlayingStrategy = (
  player,
  validPlays,
  currentPlay,
  gameState,
) => {
  const hand = player.hand;
  const cardsLeft = hand.length;

  // Always play if only 1-2 cards left
  if (cardsLeft <= 2) {
    return true;
  }

  // If close to winning (3-5 cards), be more aggressive
  if (cardsLeft <= 5) {
    // Play if we have a strong play
    const bestPlay = validPlays[0];
    if (
      bestPlay.type === COMBO_TYPES.FOUR_OF_A_KIND ||
      bestPlay.type === COMBO_TYPES.TRIPLE
    ) {
      return true;
    }
    // 50% chance to play otherwise
    return Math.random() > 0.5;
  }

  // If current play is weak (single low card), consider playing
  if (currentPlay.type === COMBO_TYPES.SINGLE && currentPlay.rank < 6) {
    // 60% chance to play
    return Math.random() > 0.4;
  }

  // If we have many high-value cards, be conservative
  const highCards = hand.filter((card) => card.rankValue >= 9).length;
  if (highCards >= 5) {
    // 30% chance to play
    return Math.random() > 0.7;
  }

  // Default: 50-50 decision
  return Math.random() > 0.5;
};

/**
 * Selects the best play from valid options
 */
const selectBestPlay = (validPlays, hand, gameState) => {
  const cardsLeft = hand.length;

  // If close to winning, play to empty hand
  if (cardsLeft <= 5) {
    // Prefer plays that leave fewer cards
    validPlays.sort((a, b) => b.cards.length - a.cards.length);
    return validPlays[0];
  }

  // Otherwise, play lowest value combination
  validPlays.sort((a, b) => {
    // Prefer lower rank
    if (a.rank !== b.rank) {
      return a.rank - b.rank;
    }
    // If same rank, prefer single over pair, etc.
    return a.cards.length - b.cards.length;
  });

  return validPlays[0];
};

// UTILITY FUNCTIONS

/**
 * Evaluates hand strength (for future advanced AI)
 */
export const evaluateHandStrength = (hand) => {
  const groups = groupByRank(hand);
  let strength = 0;

  // Count pairs, triples, quads
  for (const rank of Object.keys(groups)) {
    const count = groups[rank].length;
    if (count === 4) strength += 10;
    else if (count === 3) strength += 6;
    else if (count === 2) strength += 3;
  }

  // Add value for high cards
  const highCards = hand.filter((card) => card.rankValue >= 10).length;
  strength += highCards * 2;

  return strength;
};

export default {
  makeAIDecision,
  evaluateHandStrength,
};
