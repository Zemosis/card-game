// TABLE METRICS — card sizes for the play table, derived from the viewport,
// plus the deal timing shared by DealAnimation (opponent cards) and
// PlayerHand (the player's own cards, which fly themselves).

import { useEffect, useState } from "react";

export const DEAL_FLY = 0.3; // seconds a card spends in the air
export const DEAL_STAGGER = 0.085; // seconds between two dealt cards
export const CARD_RATIO = 1.4375; // height / width of every card

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Below COMPACT_W the table's sidebar (scoreboard, chat) becomes a slide-out
// panel: a table needs ~900px beside the 300px sidebar, so tablets and small
// laptops get the whole width. Below NARROW_W (phones held upright; Tailwind's
// sm) opponents sit in a strip above the felt instead of around it. Wider but
// under SHORT_H tall (phones on their side), they sit in slim plates beside
// the felt.
export const COMPACT_W = 1200;
export const NARROW_W = 640;
export const SHORT_H = 560;

/** The window's size, kept current. */
export function useViewport() {
  const [size, setSize] = useState(() => ({ vw: window.innerWidth, vh: window.innerHeight }));

  useEffect(() => {
    const onResize = () => setSize({ vw: window.innerWidth, vh: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return size;
}

/**
 * { handW, deckW, compact, narrow, seats }: hand cards are the biggest thing
 * on the table. They follow the window's height, and on a phone its width too
 * so a full hand still fans out readably. `seats` is the opponents' layout
 * (see OpponentSection): "strip", "row" or "full".
 */
export function useTableMetrics() {
  const { vw, vh } = useViewport();

  const handH = clamp(Math.round(Math.min(vh * 0.19, vw * 0.28)), 84, 200);
  const handW = Math.round(handH / CARD_RATIO);
  const deckW = clamp(Math.round(handW * 0.8), 52, 112);
  const narrow = vw < NARROW_W;
  const seats = narrow ? "strip" : vh < SHORT_H ? "row" : "full";
  return { handW, deckW, compact: vw < COMPACT_W, narrow, seats };
}
