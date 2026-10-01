// Where a seat sits on screen for a given viewer: you at the bottom, the rest
// clockwise — the same rotation the live tables use. Thirteen seats 4
// (left, top, right); Muushig seats 5 (two on each side).

const POSITIONS = {
  4: ["bottom", "left", "top", "right"],
  5: ["bottom", "bottomLeft", "topLeft", "topRight", "bottomRight"],
};

export const positionOf = (seat, mySeat, count = 4) => POSITIONS[count][(seat - (mySeat ?? 0) + count) % count];
