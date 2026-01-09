// DECK UTILITIES - Card Deck Management

import { RANKS, SUITS, RANK_VALUES, SUIT_VALUES } from './constants.js';

// CREATE DECK
/**
 * Creates a standard 52-card deck
 * @returns {Array} Array of card objects
 */
export const createDeck = () => {
  const deck = [];
  
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        rank,
        suit,
        id: `${rank}${suit}`, // Unique identifier (e.g., "A♠")
        rankValue: RANK_VALUES[rank],
        suitValue: SUIT_VALUES[suit]
      });
    }
  }
  
  return deck;
};

// SHUFFLE DECK
/**
 * Shuffles deck using Fisher-Yates algorithm
 * @param {Array} deck - The deck to shuffle
 * @returns {Array} Shuffled deck
 */
export const shuffleDeck = (deck) => {
  const shuffled = [...deck]; // Create a copy
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled;
};

// DEAL CARDS
/**
 * Deals cards to players
 * @param {Array} deck - Shuffled deck
 * @param {Number} numPlayers - Number of players (default: 4)
 * @param {Number} cardsPerPlayer - Cards per player (default: 13)
 * @returns {Array} Array of player hands
 */
export const dealCards = (deck, numPlayers = 4, cardsPerPlayer = 13) => {
  const hands = Array.from({ length: numPlayers }, () => []);
  
  // Deal cards one at a time to each player (round-robin)
  for (let i = 0; i < cardsPerPlayer; i++) {
    for (let playerIndex = 0; playerIndex < numPlayers; playerIndex++) {
      const cardIndex = i * numPlayers + playerIndex;
      if (cardIndex < deck.length) {
        hands[playerIndex].push(deck[cardIndex]);
      }
    }
  }
  
  // Sort each hand
  return hands.map(hand => sortHand(hand));
};

// SORT HAND
/**
 * Sorts a hand by rank (primary) and suit (secondary)
 * @param {Array} hand - Array of cards
 * @returns {Array} Sorted hand
 */
export const sortHand = (hand) => {
  return [...hand].sort((a, b) => {
    // First, sort by rank
    if (a.rankValue !== b.rankValue) {
      return a.rankValue - b.rankValue;
    }
    // If ranks are equal, sort by suit
    return a.suitValue - b.suitValue;
  });
};

// CARD COMPARISON
/**
 * Compares two single cards
 * @param {Object} card1 - First card
 * @param {Object} card2 - Second card
 * @returns {Number} Positive if card1 > card2, negative if card1 < card2, 0 if equal
 */
export const compareCards = (card1, card2) => {
  // Compare rank first
  if (card1.rankValue !== card2.rankValue) {
    return card1.rankValue - card2.rankValue;
  }
  // If ranks equal, compare suit
  return card1.suitValue - card2.suitValue;
};

/**
 * Checks if card1 is stronger than card2
 * @param {Object} card1 - First card
 * @param {Object} card2 - Second card
 * @returns {Boolean} True if card1 beats card2
 */
export const isCardStronger = (card1, card2) => {
  return compareCards(card1, card2) > 0;
};

// CARD DISPLAY HELPERS
/**
 * Gets the display name for a card
 * @param {Object} card - Card object
 * @returns {String} Display string (e.g., "A♠")
 */
export const getCardDisplay = (card) => {
  return `${card.rank}${card.suit}`;
};

/**
 * Gets the full name for a card
 * @param {Object} card - Card object
 * @returns {String} Full name (e.g., "Ace of Spades")
 */
export const getCardFullName = (card) => {
  const rankNames = {
    '3': 'Three', '4': 'Four', '5': 'Five', '6': 'Six',
    '7': 'Seven', '8': 'Eight', '9': 'Nine', '10': 'Ten',
    'J': 'Jack', 'Q': 'Queen', 'K': 'King', 'A': 'Ace', '2': 'Two'
  };
  
  const suitNames = {
    '♦': 'Diamonds',
    '♣': 'Clubs',
    '♥': 'Hearts',
    '♠': 'Spades'
  };
  
  return `${rankNames[card.rank]} of ${suitNames[card.suit]}`;
};

// HAND ANALYSIS HELPERS
/**
 * Groups cards by rank
 * @param {Array} cards - Array of cards
 * @returns {Object} Object with ranks as keys, arrays of cards as values
 */
export const groupByRank = (cards) => {
  return cards.reduce((groups, card) => {
    const rank = card.rank;
    if (!groups[rank]) {
      groups[rank] = [];
    }
    groups[rank].push(card);
    return groups;
  }, {});
};

/**
 * Groups cards by suit
 * @param {Array} cards - Array of cards
 * @returns {Object} Object with suits as keys, arrays of cards as values
 */
export const groupBySuit = (cards) => {
  return cards.reduce((groups, card) => {
    const suit = card.suit;
    if (!groups[suit]) {
      groups[suit] = [];
    }
    groups[suit].push(card);
    return groups;
  }, {});
};

/**
 * Finds the highest card in a hand
 * @param {Array} cards - Array of cards
 * @returns {Object} The highest card
 */
export const findHighestCard = (cards) => {
  if (!cards || cards.length === 0) return null;
  
  return cards.reduce((highest, card) => {
    return compareCards(card, highest) > 0 ? card : highest;
  }, cards[0]);
};

/**
 * Finds the lowest card in a hand
 * @param {Array} cards - Array of cards
 * @returns {Object} The lowest card
 */
export const findLowestCard = (cards) => {
  if (!cards || cards.length === 0) return null;
  
  return cards.reduce((lowest, card) => {
    return compareCards(card, lowest) < 0 ? card : lowest;
  }, cards[0]);
};

// UTILITY FUNCTIONS
/**
 * Removes specific cards from a hand
 * @param {Array} hand - Player's hand
 * @param {Array} cardsToRemove - Cards to remove
 * @returns {Array} New hand without the removed cards
 */
export const removeCardsFromHand = (hand, cardsToRemove) => {
  const idsToRemove = new Set(cardsToRemove.map(card => card.id));
  return hand.filter(card => !idsToRemove.has(card.id));
};

/**
 * Checks if a hand contains specific cards
 * @param {Array} hand - Player's hand
 * @param {Array} cardsToCheck - Cards to check for
 * @returns {Boolean} True if hand contains all cards
 */
export const handContainsCards = (hand, cardsToCheck) => {
  const handIds = new Set(hand.map(card => card.id));
  return cardsToCheck.every(card => handIds.has(card.id));
};

/**
 * Creates a new shuffled and dealt game
 * @returns {Object} Object with deck and player hands
 */
export const initializeGame = () => {
  const deck = createDeck();
  const shuffledDeck = shuffleDeck(deck);
  const hands = dealCards(shuffledDeck);
  
  return {
    deck: shuffledDeck,
    hands
  };
};

export default {
  createDeck,
  shuffleDeck,
  dealCards,
  sortHand,
  compareCards,
  isCardStronger,
  getCardDisplay,
  getCardFullName,
  groupByRank,
  groupBySuit,
  findHighestCard,
  findLowestCard,
  removeCardsFromHand,
  handContainsCards,
  initializeGame
};
