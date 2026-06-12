// DEAL ANIMATION - GSAP-driven shuffle + deal
// Cards fly from the center deck toward the actual seat directions
// (percent-based targets, so it tracks the real table size).

import React, { useState, useEffect, useRef } from "react";
import { PixelCard } from "../PixelCard";
import gsap from "gsap";

const TOTAL_CARDS = 52;
const DEAL_STAGGER = 0.03;
const FLY_DURATION = 0.34;
const SHUFFLE_HALF = 4; // cards per riffle half
const POOL_SIZE = 14; // flying sprites reused round-robin

const DealAnimation = ({
  dealerIndex = 0,
  viewIndex = 0,
  onDealProgress,
  onComplete,
}) => {
  const [phase, setPhase] = useState("shuffle");
  const containerRef = useRef(null);
  const deckRef = useRef(null);
  const shuffleRefs = useRef([]);
  const poolRefs = useRef([]);
  const progressRef = useRef(onDealProgress);
  const completeRef = useRef(onComplete);
  progressRef.current = onDealProgress;
  completeRef.current = onComplete;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    // Seat directions relative to the table center (bottom/left/top/right)
    const targets = {
      0: { x: 0, y: rect.height * 0.62, r: 10 },
      1: { x: -rect.width * 0.44, y: 0, r: -80 },
      2: { x: 0, y: -rect.height * 0.55, r: -10 },
      3: { x: rect.width * 0.44, y: 0, r: 80 },
    };

    const tl = gsap.timeline();

    // --- riffle shuffle: split the stack, slide back together, twice ---
    const halves = [
      shuffleRefs.current.slice(0, SHUFFLE_HALF).filter(Boolean),
      shuffleRefs.current.slice(SHUFFLE_HALF).filter(Boolean),
    ];
    for (let pass = 0; pass < 2; pass++) {
      tl.to(halves[0], { x: -34, rotation: -7, duration: 0.16, ease: "power2.out" }, ">");
      tl.to(halves[1], { x: 34, rotation: 7, duration: 0.16, ease: "power2.out" }, "<");
      tl.to(halves[0], { x: 0, rotation: 0, duration: 0.2, ease: "power2.in", stagger: 0.035 }, ">0.05");
      tl.to(halves[1], { x: 0, rotation: 0, duration: 0.2, ease: "power2.in", stagger: 0.035 }, "<");
    }

    tl.call(() => setPhase("dealing"));

    // --- deal 52 cards round-robin from the dealer's left ---
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < TOTAL_CARDS; i++) {
      const seat = (dealerIndex + 1 + i) % 4;
      const rotated = (seat - viewIndex + 4) % 4;
      const t = targets[rotated];

      tl.call(
        () => {
          counts[seat]++;
          progressRef.current?.([...counts]);

          const el = poolRefs.current[i % POOL_SIZE];
          if (!el) return;
          gsap.fromTo(
            el,
            { x: 0, y: 0, rotation: 0, scale: 0.9, opacity: 1 },
            {
              x: t.x,
              y: t.y,
              rotation: t.r + gsap.utils.random(-12, 12),
              scale: 0.5,
              opacity: 0,
              duration: FLY_DURATION,
              ease: "power2.in",
              overwrite: true,
            },
          );
        },
        null,
        `>${i === 0 ? 0.05 : DEAL_STAGGER}`,
      );
    }

    // --- deck fades, hand sorting takes over ---
    tl.to(deckRef.current, { opacity: 0, duration: 0.25 }, `>+${FLY_DURATION}`);
    tl.call(() => completeRef.current?.(), null, ">0.1");

    return () => tl.kill();
  }, [dealerIndex, viewIndex]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-30 pointer-events-none"
      style={{ overflow: "visible" }}
    >
      {/* Center anchor */}
      <div
        className="absolute"
        style={{ left: "50%", top: "50%", width: 0, height: 0 }}
      >
        {/* Deck stack */}
        <div ref={deckRef}>
          {[...Array(5)].map((_, i) => (
            <div
              key={`deck-${i}`}
              className="absolute"
              style={{
                transform: `translate(calc(-50% - ${i}px), calc(-50% - ${i * 2}px))`,
                zIndex: 5 - i,
              }}
            >
              <PixelCard faceDown size="small" />
            </div>
          ))}
        </div>

        {/* Riffle shuffle cards */}
        {phase === "shuffle" &&
          [...Array(SHUFFLE_HALF * 2)].map((_, i) => (
            <div
              key={`shuf-${i}`}
              ref={(el) => (shuffleRefs.current[i] = el)}
              className="absolute"
              style={{
                marginLeft: -22,
                marginTop: -32,
                zIndex: 10 + i,
              }}
            >
              <PixelCard faceDown size="small" />
            </div>
          ))}

        {/* Flying card pool */}
        {[...Array(POOL_SIZE)].map((_, i) => (
          <div
            key={`fly-${i}`}
            ref={(el) => (poolRefs.current[i] = el)}
            className="absolute"
            style={{
              marginLeft: -22,
              marginTop: -32,
              opacity: 0,
              zIndex: 20,
            }}
          >
            <PixelCard faceDown size="small" />
          </div>
        ))}

        {/* Label */}
        <div
          className="absolute font-pixel-display text-[9px] text-glow-gold"
          style={{
            left: 0,
            top: -64,
            transform: "translateX(-50%)",
            whiteSpace: "nowrap",
          }}
        >
          {phase === "shuffle" ? "SHUFFLING..." : "DEALING..."}
        </div>
      </div>
    </div>
  );
};

export default DealAnimation;
