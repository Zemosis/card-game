// Where a seat sits on screen for a given viewer: you at the bottom, the rest
// clockwise (left, top, right) — the same rotation the live Thirteen table uses.

const POSITIONS = ["bottom", "left", "top", "right"];

export const positionOf = (seat, mySeat) => POSITIONS[(seat - (mySeat ?? 0) + 4) % 4];
