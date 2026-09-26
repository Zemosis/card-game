// TABLE METRICS — card sizes for the play table, derived from the viewport,
// plus the deal timing shared by DealAnimation (opponent cards) and
// PlayerHand (the player's own cards, which fly themselves).

import { useEffect, useState } from "react";

export const DEAL_FLY = 0.3; // seconds a card spends in the air
export const DEAL_STAGGER = 0.085; // seconds between two dealt cards
export const CARD_RATIO = 1.4375; // height / width of every card

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** { handW, deckW }: hand cards are the biggest thing on the table. */
export function useTableMetrics() {
  const [vh, setVh] = useState(() => window.innerHeight);

  useEffect(() => {
    const onResize = () => setVh(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handH = clamp(Math.round(vh * 0.19), 120, 200);
  const handW = Math.round(handH / CARD_RATIO);
  const deckW = clamp(Math.round(handW * 0.8), 64, 112);
  return { handW, deckW };
}
