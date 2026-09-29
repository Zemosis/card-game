// A suit glyph inside pixel-font text. The pixel fonts have no suit glyphs,
// so the symbol gets its own span, coloured and sized to sit on the baseline.

import React from "react";
import { suitColor } from "./suits";

export default function Suit({ suit, size = 14 }) {
  return <span style={{ color: suitColor(suit), fontSize: size, lineHeight: 0 }}>{suit}</span>;
}
