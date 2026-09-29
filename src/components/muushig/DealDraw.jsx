// DEAL DRAW — the draw for the first deal, played out on the felt.
//
// A face-down pile sits in the middle. Each draw lifts the cards above the
// chosen depth, slides that card out, flies it to a spot in front of the
// drawer and turns it face up; it stays there until the draw is over. While
// it's your turn the pile previews your pick: the cards above it lift and the
// card you'd take glows.
// A tie lights up the tied cards and dims the rest until they draw again.
// Once someone wins, their card pops and the rest dim, then onDone.

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { PixelCard } from "../PixelCard";
import { CARD_RATIO, prefersReducedMotion } from "../../hooks/useTableMetrics";
import { DRAW_FLY, DRAW_LAND_MS, DRAW_SLIDE, DRAW_TURN } from "./flightTiming";

// Where each seat's drawn card lies, as a fraction of the felt's diameter.
const SPOT = {
  bottom: [0, 0.33],
  bottomLeft: [-0.3, 0.14],
  topLeft: [-0.3, -0.17],
  topRight: [0.3, -0.17],
  bottomRight: [0.3, 0.14],
};
const LAYERS = 12; // pile cards drawn, enough to show the deepest draw
const REVEAL_MS = 1600; // how long the winning card shows before onDone

const ordinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "TH" : ["TH", "ST", "ND", "RD"][n % 10] || "TH"}`;
const place = (fx, fy, D) => `translate(-50%, -50%) translate(${Math.round(fx * D)}px, ${Math.round(fy * D)}px)`;

/**
 * The pile, top card last. cut: the depth being drawn (0 for none); the cards
 * above it lift. chosen: whether the card at that depth is still in the pile
 * (your preview), so it glows.
 */
function Pile({ count, cw, cut, chosen }) {
  const ch = Math.round(cw * CARD_RATIO);
  const n = Math.min(count, LAYERS);
  const lift = Math.round(ch * 0.3);
  return (
    <div className="absolute left-1/2 top-1/2" style={{ width: cw, height: ch, transform: "translate(-50%, -50%)" }}>
      {Array.from({ length: n }, (_, k) => {
        const i = n - 1 - k; // depth from the top, 0 = top card
        const above = cut > 0 && i < cut - 1;
        const glow = chosen && i === cut - 1;
        const y = -(n - 1 - i) * 2 - (above ? lift : glow ? 6 : 0); // a pile 2px per card high
        return (
          <div
            key={i}
            className="absolute inset-0"
            style={{
              transform: `translate(${above ? Math.round(cw * 0.3) : 0}px, ${y}px) rotate(${above ? 8 : 0}deg)`,
              transition: "transform 160ms ease-out",
              filter: glow ? "drop-shadow(0 0 8px #f4c430) drop-shadow(0 0 2px #f4c430)" : undefined,
            }}
          >
            <PixelCard faceDown width={cw} />
          </div>
        );
      })}
      {chosen && cut > 0 && (
        <div
          className="absolute font-pixel-display text-[10px] leading-none px-1.5 py-1 whitespace-nowrap"
          style={{ left: "100%", top: "50%", transform: "translate(8px, -50%)", backgroundColor: "#f4c430", color: "#1a1024", boxShadow: "0 0 0 2px #0a0712" }}
        >
          {ordinal(cut)}
        </div>
      )}
      <div
        className="absolute left-1/2 font-pixel-display text-[10px] leading-none text-bone/60 whitespace-nowrap"
        style={{ top: "100%", transform: "translate(-50%, 8px)" }}
      >
        {count} LEFT
      </div>
    </div>
  );
}

/** A drawn card: out of the pile (at `from`, relative to its spot), to its spot, face up. */
function DrawnCard({ card, depth, w, from, tone, pop }) {
  const moveRef = useRef(null);
  const flipRef = useRef(null);
  const backRef = useRef(null);
  const popRef = useRef(null);

  // Mounted once per draw (keyed by it). Explicit from-values: StrictMode
  // runs this effect twice.
  useLayoutEffect(() => {
    if (prefersReducedMotion()) {
      gsap.set(backRef.current, { autoAlpha: 0 });
      return;
    }
    const tl = gsap.timeline();
    tl.set(backRef.current, { autoAlpha: 1 }, 0)
      .set(flipRef.current, { scaleX: 1 }, 0)
      .fromTo(moveRef.current, { x: from.x, y: from.y, scale: from.scale, rotation: 0 }, { x: from.x + from.slide, rotation: 10, duration: DRAW_SLIDE, ease: "power2.out" }, 0)
      .to(moveRef.current, { x: 0, y: 0, scale: 1, rotation: gsap.utils.random(-6, 6), duration: DRAW_FLY, ease: "power2.inOut" })
      .to(flipRef.current, { scaleX: 0, duration: DRAW_TURN / 2, ease: "power1.in" })
      .set(backRef.current, { autoAlpha: 0 })
      .to(flipRef.current, { scaleX: 1, duration: DRAW_TURN / 2, ease: "power1.out" });
    return () => tl.kill();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    if (!pop || prefersReducedMotion()) return;
    gsap.fromTo(popRef.current, { scale: 1 }, { scale: 1.25, duration: 0.18, ease: "power2.out", yoyo: true, repeat: 1 });
  }, [pop]);

  const glow = tone === "win" ? "#f4c430" : tone === "tie" ? "#5fd4d6" : null;
  return (
    <div
      ref={popRef}
      style={{
        opacity: tone === "out" ? 0.45 : 1,
        filter: tone === "out" ? "grayscale(0.6)" : glow ? `drop-shadow(0 0 10px ${glow}) drop-shadow(0 0 2px ${glow})` : undefined,
        transition: "opacity 300ms, filter 300ms",
      }}
    >
      <div ref={moveRef}>
        <div ref={flipRef} className="relative">
          <PixelCard rank={card.rank} suit={card.suit} width={w} />
          <div ref={backRef} className="absolute inset-0 invisible">
            <PixelCard faceDown width={w} />
          </div>
          <div
            className="absolute font-pixel-display text-[9px] leading-none px-1 py-0.5 whitespace-nowrap"
            style={{ right: -6, top: -8, backgroundColor: "#0a0712", color: "rgba(234,216,177,0.8)", boxShadow: "0 0 0 2px #1a3a2c" }}
            title={`Drawn ${depth} deep`}
          >
            {ordinal(depth)}
          </div>
          {tone === "win" && (
            <div
              className="absolute left-1/2 font-pixel-display text-[10px] leading-none px-1.5 py-1 whitespace-nowrap"
              style={{ bottom: -10, transform: "translateX(-50%)", backgroundColor: "#5fd4d6", color: "#0a3a3a", boxShadow: "0 0 0 2px #0a0712" }}
            >
              DEALS
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * D, cw: the felt's diameter and card width.
 * count: cards left in the pile.
 * draws: each seat's latest draw, [{ key, seat, card, depth }], seat being
 *   its name (bottom, bottomLeft, …).
 * latest: key of the newest draw, whose cut the pile shows as it's taken.
 * preview: the depth you're about to draw (0 when it isn't your turn).
 * label: the caption over the pile.
 * contenders: seat names still drawing after a tie, or null.
 * winner: the seat name that deals, once the draw is over, or null.
 */
const DealDraw = ({ D, cw, count, draws, latest, preview = 0, label, contenders, winner, onDone }) => {
  const w = Math.round(cw * 0.75);
  const reduce = prefersReducedMotion();

  // The pile shows the newest draw's cut while its card slides out.
  const [settled, setSettled] = useState(null);
  const newest = draws.find((d) => d.key === latest);
  useEffect(() => {
    if (!latest) return;
    const timer = setTimeout(() => setSettled(latest), (DRAW_SLIDE + 0.1) * 1000);
    return () => clearTimeout(timer);
  }, [latest]);
  const cutting = newest && latest !== settled && !reduce ? newest.depth : 0;

  // Once there's a winner: let the last card land, show it, then move on.
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    if (winner === null) return;
    const land = reduce ? 0 : DRAW_LAND_MS + 150;
    const show = setTimeout(() => setRevealed(true), land);
    const done = setTimeout(() => onDone?.(), land + (reduce ? 900 : REVEAL_MS));
    return () => {
      clearTimeout(show);
      clearTimeout(done);
    };
  }, [winner, onDone, reduce]);

  const toneOf = (seat) => {
    if (revealed) return seat === winner ? "win" : "out";
    if (contenders) return contenders.includes(seat) ? "tie" : "out";
    return null;
  };

  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      <Pile count={count} cw={cw} cut={preview || cutting} chosen={preview > 0} />

      {draws.map((d) => {
        const [fx, fy] = SPOT[d.seat] || SPOT.bottom;
        return (
          <div key={d.key} className="absolute left-1/2 top-1/2" style={{ transform: place(fx, fy, D) }}>
            <DrawnCard
              card={d.card}
              depth={d.depth}
              w={w}
              from={{ x: -fx * D, y: -fy * D, scale: cw / w, slide: Math.round(cw * 0.45) }}
              tone={toneOf(d.seat)}
              pop={revealed && d.seat === winner}
            />
          </div>
        );
      })}

      {label && (
        <div className="absolute left-1/2 top-1/2" style={{ transform: place(0, -0.39, D) }}>
          <div
            className="font-pixel-display text-[10px] leading-none px-2 py-1.5 whitespace-nowrap"
            style={{ backgroundColor: "#0a0712", color: "#ead8b1", boxShadow: "0 0 0 2px #1a3a2c" }}
          >
            {label}
          </div>
        </div>
      )}
    </div>
  );
};

export default DealDraw;
