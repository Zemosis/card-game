// Shared color and style tokens for PixelUI screens.

export const INK = "#0a0712";

export const TONES = {
  cyan: { bg: "#5fd4d6", deep: "#2a8a8c", ink: "#0a2a2c" },
  rose: { bg: "#e85a7a", deep: "#a83a5a", ink: "#2a0a14" },
  poison: { bg: "#9bd14f", deep: "#6a9a30", ink: "#142a08" },
  dusk: { bg: "#463a78", deep: "#2a234d", ink: "#ead8b1" },
};

export const inputStyle = {
  height: "var(--ctl)",
  backgroundColor: INK,
  border: "3px solid #2a234d",
  boxShadow: "inset 0 3px 0 rgba(0,0,0,0.5)",
};

// Press Start 2P is drawn on an 8px grid, so free-sized cards snap their
// text to whole multiples of 4 to stay crisp.
const snap4 = (n) => Math.max(8, Math.round(n / 4) * 4);

/** Inline size + font variables for a card `width` px wide (64:92 ratio). */
export function cardSizeStyle(width) {
  if (!width) return null;
  const w = Math.round(width);
  return {
    width: w,
    height: Math.round(w * 1.4375),
    borderWidth: w >= 96 ? 4 : 3,
    "--corner-fs": `${snap4(w * 0.135)}px`,
    "--corner-inset": `${Math.round(w * 0.08)}px`,
    "--center-fs": `${snap4(w * 0.36)}px`,
    "--back-fs": `${snap4(w * 0.28)}px`,
    "--debuff-fs": `${Math.max(7, Math.round(w * 0.105))}px`,
  };
}
