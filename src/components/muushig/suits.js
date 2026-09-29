// Suit display helpers shared by the Muushig table.

const RED = new Set(["♥", "♦"]);

export const suitColor = (suit) => (RED.has(suit) ? "#e85a7a" : "#ead8b1");

export const SUIT_NAME = { "♠": "SPADES", "♥": "HEARTS", "♦": "DIAMONDS", "♣": "CLUBS" };
