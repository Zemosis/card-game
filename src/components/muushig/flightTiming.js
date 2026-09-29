// Timing shared by CardFlight and the hand it hands your incoming cards to.

export const FLY = 0.38; // seconds a card spends in the air
export const STAGGER = 0.1; // default seconds between two cards of one leg
/** How long one leg of an n-card flight lasts. */
export const legTime = (n, stagger = STAGGER) => FLY + stagger * (n - 1);

// The draw for the deal (see DealDraw): a card slides out of the pile, flies
// to the drawer's spot and turns face up.
export const DRAW_SLIDE = 0.2;
export const DRAW_FLY = 0.42;
export const DRAW_TURN = 0.16;
export const DRAW_LAND_MS = Math.round((DRAW_SLIDE + DRAW_FLY + DRAW_TURN) * 1000);
