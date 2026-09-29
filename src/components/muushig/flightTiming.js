// Timing shared by CardFlight and the hand it hands your incoming cards to.

export const FLY = 0.38; // seconds a card spends in the air
export const STAGGER = 0.1; // default seconds between two cards of one leg
/** How long one leg of an n-card flight lasts. */
export const legTime = (n, stagger = STAGGER) => FLY + stagger * (n - 1);
