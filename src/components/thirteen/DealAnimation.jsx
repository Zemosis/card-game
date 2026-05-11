import React, { useState, useEffect, useCallback, useRef } from "react";
import { PixelCard } from "../PixelCard";

const TOTAL_CARDS = 52;
const DEAL_INTERVAL = 55;
const SHUFFLE_DURATION = 1400;
const SORT_DELAY = 300;
const POST_SORT_DELAY = 400;
const CARD_FLY_DURATION = 250;

const SHUFFLE_CARDS = 8;

const FLY_TARGETS = {
  0: { x: 0, y: 140 },
  1: { x: -220, y: 20 },
  2: { x: 0, y: -120 },
  3: { x: 220, y: 20 },
};

const DealAnimation = ({ dealerIndex = 0, viewIndex = 0, onDealProgress, onComplete }) => {
  const [phase, setPhase] = useState("shuffle");
  const [dealtCount, setDealtCount] = useState(0);
  const [shufflePositions, setShufflePositions] = useState([]);
  const [flyingCards, setFlyingCards] = useState([]);
  const flyIdRef = useRef(0);

  const generateShuffleFrame = useCallback(() => {
    const positions = [];
    for (let i = 0; i < SHUFFLE_CARDS; i++) {
      const side = Math.random() > 0.5 ? 1 : -1;
      positions.push({
        x: side * (15 + Math.random() * 25),
        y: -20 + Math.random() * 40,
        r: (Math.random() - 0.5) * 30,
        z: Math.floor(Math.random() * SHUFFLE_CARDS),
      });
    }
    return positions;
  }, []);

  useEffect(() => {
    if (phase !== "shuffle") return;

    setShufflePositions(generateShuffleFrame());
    const interval = setInterval(() => {
      setShufflePositions(generateShuffleFrame());
    }, 180);

    const endShuffle = setTimeout(() => {
      clearInterval(interval);
      setPhase("dealing");
    }, SHUFFLE_DURATION);

    return () => {
      clearInterval(interval);
      clearTimeout(endShuffle);
    };
  }, [phase, generateShuffleFrame]);

  useEffect(() => {
    if (phase !== "dealing") return;

    if (dealtCount >= TOTAL_CARDS) {
      const cleanupTimer = setTimeout(() => {
        setFlyingCards([]);
      }, CARD_FLY_DURATION + 50);

      const sortTimer = setTimeout(() => {
        setPhase("sorting");
      }, SORT_DELAY + CARD_FLY_DURATION);

      return () => {
        clearTimeout(cleanupTimer);
        clearTimeout(sortTimer);
      };
    }

    const timer = setTimeout(() => {
      const nextCount = dealtCount + 1;
      const rawPlayerIdx = (dealerIndex + nextCount) % 4;

      const rotatedIdx = (rawPlayerIdx - viewIndex + 4) % 4;
      const target = FLY_TARGETS[rotatedIdx];

      const id = flyIdRef.current++;
      setFlyingCards((prev) => [
        ...prev.slice(-8),
        {
          id,
          targetX: target.x,
          targetY: target.y,
          startTime: Date.now(),
          launched: false,
        },
      ]);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setFlyingCards((prev) =>
            prev.map((c) => (c.id === id ? { ...c, launched: true } : c)),
          );
        });
      });

      const perPlayer = [0, 0, 0, 0];
      for (let i = 0; i < nextCount; i++) {
        perPlayer[(dealerIndex + 1 + i) % 4]++;
      }
      onDealProgress(perPlayer);
      setDealtCount(nextCount);
    }, DEAL_INTERVAL);

    return () => clearTimeout(timer);
  }, [phase, dealtCount, dealerIndex, viewIndex, onDealProgress, onComplete]);

  useEffect(() => {
    if (phase !== "sorting") return;
    const t = setTimeout(() => onComplete(), POST_SORT_DELAY);
    return () => clearTimeout(t);
  }, [phase, onComplete]);

  useEffect(() => {
    if (flyingCards.length === 0) return;
    const timer = setTimeout(() => {
      setFlyingCards((prev) =>
        prev.filter((c) => Date.now() - c.startTime < CARD_FLY_DURATION + 50),
      );
    }, CARD_FLY_DURATION + 100);
    return () => clearTimeout(timer);
  }, [flyingCards.length]);

  const stackRemaining = TOTAL_CARDS - dealtCount;

  if (phase === "sorting") return null;

  return (
    <div
      className="absolute inset-0 z-30 pointer-events-none"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "visible",
      }}
    >
      {/* Shuffle animation */}
      {phase === "shuffle" && (
        <div className="relative" style={{ width: 80, height: 100 }}>
          {shufflePositions.map((pos, i) => (
            <div
              key={i}
              className="absolute"
              style={{
                left: "50%",
                top: "50%",
                transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px)) rotate(${pos.r}deg)`,
                transition: "transform 0.15s ease-in-out",
                zIndex: pos.z,
              }}
            >
              <PixelCard faceDown size="small" />
            </div>
          ))}
          <div
            className="absolute font-pixel-display text-[9px] text-glow-gold"
            style={{
              left: "50%",
              top: -24,
              transform: "translateX(-50%)",
              whiteSpace: "nowrap",
            }}
          >
            SHUFFLING...
          </div>
        </div>
      )}

      {/* Dealing — center deck + flying cards */}
      {phase === "dealing" && (
        <>
          {/* Remaining deck stack */}
          {stackRemaining > 0 && (
            <div className="relative" style={{ width: 60, height: 80 }}>
              {[...Array(Math.min(stackRemaining, 5))].map((_, i) => (
                <div
                  key={i}
                  className="absolute"
                  style={{
                    left: "50%",
                    top: "50%",
                    transform: `translate(calc(-50% - ${i}px), calc(-50% - ${i * 2}px))`,
                    zIndex: 5 - i,
                  }}
                >
                  <PixelCard faceDown size="small" />
                </div>
              ))}
            </div>
          )}

          {/* Flying cards — start at center, transition to target */}
          {flyingCards.map((card) => (
            <div
              key={card.id}
              className="absolute"
              style={{
                left: "50%",
                top: "50%",
                transform: card.launched
                  ? `translate(calc(-50% + ${card.targetX}px), calc(-50% + ${card.targetY}px)) scale(0.6)`
                  : "translate(-50%, -50%)",
                transition: `transform ${CARD_FLY_DURATION}ms ease-out, opacity ${CARD_FLY_DURATION}ms ease-out`,
                opacity: card.launched ? 0 : 1,
                zIndex: 40,
              }}
            >
              <PixelCard faceDown size="small" />
            </div>
          ))}
        </>
      )}
    </div>
  );
};

export default DealAnimation;
