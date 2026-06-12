// PLAY AREA - Pixel Retro Felt Table Center

import React, { useRef, useLayoutEffect } from "react";
import { PixelCard } from "../PixelCard";
import { COMBO_NAMES } from "../../utils/constants";
import gsap from "gsap";

const PlayArea = ({
  currentPlay = null,
  lastPlayerName = null,
  roundNumber = 1,
}) => {
  const cardElsRef = useRef([]);
  const prevPlayKeyRef = useRef(null);

  const playKey = currentPlay
    ? currentPlay.cards.map((c) => c.id).join(",")
    : null;

  // Animate a new play landing on the felt
  useLayoutEffect(() => {
    if (!playKey) {
      prevPlayKeyRef.current = null;
      return;
    }
    if (playKey === prevPlayKeyRef.current) return;
    prevPlayKeyRef.current = playKey;

    // Only animate elements still mounted for the current play
    const els = cardElsRef.current
      .slice(0, currentPlay.cards.length)
      .filter((el) => el && el.isConnected);
    if (!els.length) return;

    gsap.fromTo(
      els,
      {
        y: 90,
        scale: 0.65,
        opacity: 0,
        rotation: () => gsap.utils.random(-16, 16),
      },
      {
        y: 0,
        scale: 1,
        opacity: 1,
        rotation: 0,
        duration: 0.38,
        stagger: 0.055,
        ease: "back.out(1.5)",
        overwrite: true,
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- playKey is derived from currentPlay.cards
  }, [playKey]);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div
        className="relative w-full h-full"
        style={{ maxWidth: 820, maxHeight: 400 }}
      >
        {/* Felt mat */}
        <div
          className="relative felt-bg flex flex-col items-center justify-center w-full h-full"
          style={{
            padding: 16,
            minHeight: 200,
            border: "4px solid #2e0f1d",
            boxShadow:
              "0 0 0 4px #0a0712, " +
              "inset 0 0 0 2px #7a1530, " +
              "inset 0 0 60px rgba(0,0,0,0.5), " +
              "0 0 32px rgba(232,90,122,0.15)",
          }}
        >
          {/* Round badge */}
          <div
            className="absolute -top-3 -left-3 font-pixel-display text-[10px] px-3 py-1.5"
            style={{
              backgroundColor: "#f4c430",
              color: "#1a1024",
              border: "3px solid #0a0712",
              boxShadow: "2px 2px 0 #0a0712",
              zIndex: 5,
            }}
          >
            ROUND {roundNumber}
          </div>

          {!currentPlay && (
            <div className="text-center py-4">
              <div className="font-pixel-display text-[10px] text-bone/50 tracking-wider">
                WAITING FOR FIRST PLAY...
              </div>
            </div>
          )}

          {currentPlay && (
            <>
              <div className="text-center mb-3">
                <div className="font-pixel-display text-[9px] text-bone/70 tracking-widest mb-1">
                  {lastPlayerName
                    ? `${lastPlayerName.toUpperCase()} PLAYED`
                    : "CURRENT PLAY"}
                </div>
                <div className="font-pixel-display text-base text-glow-gold">
                  ✦ {COMBO_NAMES[currentPlay.type] || "CARDS"} ✦
                </div>
              </div>

              <div className="flex items-center justify-center my-2">
                {currentPlay.cards.map((c, i) => {
                  const mid = (currentPlay.cards.length - 1) / 2;
                  const d = i - mid;
                  return (
                    // Outer layer holds the static fan transform; GSAP and the
                    // float animation each get their own layer so the three
                    // transforms never overwrite one another.
                    <div
                      key={c.id || i}
                      style={{
                        transform: `rotate(${d * 4}deg) translateY(${Math.abs(d) * 3}px)`,
                        marginLeft: i === 0 ? 0 : -14,
                        zIndex: i,
                      }}
                    >
                      <div ref={(el) => (cardElsRef.current[i] = el)}>
                        <div
                          style={{
                            animation: "float 2.6s ease-in-out infinite",
                            animationDelay: `${i * 0.18}s`,
                          }}
                        >
                          <PixelCard rank={c.rank} suit={c.suit} size="large" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="text-center mt-3">
                <div className="font-pixel-display text-[8px] text-rose/80 tracking-wider">
                  ▼ BEAT THIS OR PASS ▼
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlayArea;
