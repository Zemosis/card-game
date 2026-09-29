// SIDE PILES — the draw pile and the dead pile, beside your hand. Both are
// straight face-down stacks; the dead pile is darker.
//
// The draw pile is what players draw from when they swap cards; the dead pile
// collects discards and folded hands. Once the draw pile runs out, the dead
// pile takes its spot.
//
// drawRef and deadRef point at the piles' card boxes, for cards flying in and
// out of them (see CardFlight).

import React from "react";
import { PixelCard } from "../PixelCard";
import { CARD_RATIO } from "../../hooks/useTableMetrics";

function Pile({ label, count, cw, dead = false, boxRef }) {
  const ch = Math.round(cw * CARD_RATIO);
  const layers = Math.min(count, 3);
  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={boxRef} className="relative" style={{ width: cw, height: ch }}>
        {count === 0 ? (
          <div
            className="w-full h-full flex items-center justify-center font-pixel-display text-[10px]"
            style={{ border: "3px dashed rgba(234,216,177,0.2)", color: "rgba(234,216,177,0.4)" }}
          >
            EMPTY
          </div>
        ) : (
          Array.from({ length: layers }, (_, i) => (
            <div
              key={i}
              className="absolute inset-0"
              style={{
                transform: `translate(${-i * 2}px, ${-i * 2}px)`,
                filter: dead ? "brightness(0.55) saturate(0.6)" : "none",
              }}
            >
              <PixelCard faceDown width={cw} />
            </div>
          ))
        )}
      </div>
      <div className="font-pixel-display text-[10px] leading-none whitespace-nowrap" style={{ color: "rgba(234,216,177,0.75)" }}>
        {label} <span className={dead ? "text-bone/60" : "text-glow-cyan"}>{count}</span>
      </div>
    </div>
  );
}

const SidePiles = ({ drawCount = 0, deadCount = 0, cardWidth = 64, drawRef, deadRef }) => (
  <div className="flex items-end gap-5" aria-label="Draw and dead piles">
    {drawCount > 0 && <Pile label="DRAW" count={drawCount} cw={cardWidth} boxRef={drawRef} />}
    <Pile label="DEAD" count={deadCount} cw={cardWidth} dead boxRef={deadRef} />
  </div>
);

export default SidePiles;
