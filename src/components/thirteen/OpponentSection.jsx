// OPPONENT SECTION - Pixel Retro Style

import React from "react";
import { PixelAvatar, PixelCard } from "../PixelCard";

const CARD_W = 44;
const CARD_H = 64;
const STEP = 12;

// Fan of face-down cards with an explicitly sized container.
// (Rotating a whole container doesn't change its layout box, which made the
// old side fans collide with neighbours — so cards are rotated individually.)
// `flip` inverts the arc for the top player, whose hand is held facing us.
const OpponentFan = ({ count, vertical = false, mirror = false, flip = false }) => {
  const cards = Array.from({ length: count });
  const mid = (count - 1) / 2;
  const span = (count - 1) * STEP;

  const width = vertical ? CARD_H + 8 : span + CARD_W;
  const height = vertical ? span + CARD_H : CARD_H + 10;
  const maxDip = mid * 1.4;

  return (
    <div style={{ position: "relative", width, height, flexShrink: 0 }}>
      {cards.map((_, i) => {
        const d = i - mid;
        const arc = d * Math.min(3, 18 / Math.max(count - 1, 1));
        const dip = Math.abs(d) * 1.4;
        const rotation = vertical
          ? 90 + (mirror ? -arc : arc)
          : flip
            ? -arc
            : arc;
        const top = flip ? maxDip - dip : dip;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              ...(vertical
                ? {
                    top: i * STEP,
                    left: "50%",
                    marginLeft: -CARD_W / 2,
                    marginTop: (CARD_H - CARD_W) / 2 - 10,
                  }
                : { left: i * STEP, top }),
              transform: `rotate(${rotation}deg)`,
              transformOrigin: "center",
              zIndex: i,
            }}
          >
            <PixelCard faceDown size="small" />
          </div>
        );
      })}
    </div>
  );
};

const OpponentSection = ({
  player,
  isActive = false,
  hasPassed = false,
  position = "top",
  isDealing = false,
}) => {
  const { name, hand, isEliminated } = player;
  const cardCount = hand.length;
  const fanCount = Math.min(cardCount, 7);
  const vertical = position === "left" || position === "right";

  // Cards sit between the avatar block and the table center
  const layout = {
    top: "flex-col items-center",
    left: "flex-row items-center",
    right: "flex-row-reverse items-center",
  }[position];

  return (
    <div className={`flex gap-2 ${layout}`}>
      {/* Avatar block */}
      <div
        className="relative"
        style={{
          backgroundColor: "#14102a",
          border: `4px solid ${isActive ? "#f4c430" : "#0a0712"}`,
          padding: "6px 8px",
          width: 188,
          boxShadow: isActive
            ? "0 0 0 4px #0a0712, 0 0 16px rgba(244,196,48,0.5), inset 0 4px 0 rgba(255,255,255,0.06)"
            : "0 0 0 4px #0a0712, inset 0 4px 0 rgba(255,255,255,0.04)",
          animation: isActive ? "pulse-glow 1.6s ease-in-out infinite" : "none",
        }}
      >
        <div className="flex items-center gap-2">
          <PixelAvatar
            variant={((player.id || 0) % 5) + 1}
            size={40}
            active={isActive}
            eliminated={isEliminated}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <div className="font-pixel-display text-[9px] text-parchment truncate">
                {name}
              </div>
              {isActive && !isEliminated && (
                <span
                  className="font-pixel-display text-[7px] px-1 blink"
                  style={{ backgroundColor: "#f4c430", color: "#1a1024" }}
                >
                  TURN
                </span>
              )}
              {hasPassed && !isEliminated && (
                <span
                  className="font-pixel-display text-[7px] px-1"
                  style={{ backgroundColor: "#463a78", color: "#ead8b1" }}
                >
                  PASS
                </span>
              )}
              {isEliminated && (
                <span
                  className="font-pixel-display text-[7px] px-1"
                  style={{ backgroundColor: "#7a1530", color: "#ead8b1" }}
                >
                  OUT
                </span>
              )}
            </div>

            {/* Card count bar */}
            <div className="mt-1.5 flex items-center gap-1.5">
              <div className="font-pixel-display text-[9px] text-glow-cyan" style={{ minWidth: 18 }}>
                {cardCount}
              </div>
              <div
                className="flex-1 h-2"
                style={{
                  backgroundColor: "#0a0712",
                  border: "1px solid #1f1a3d",
                }}
              >
                <div
                  style={{
                    width: `${(cardCount / 13) * 100}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #5fd4d6, #f4c430)",
                    transition: "width 300ms ease",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Card fan — reserve space during dealing so layout doesn't shift */}
      {!isEliminated && (cardCount > 0 || isDealing) && (
        <div
          style={{
            minWidth: vertical ? CARD_H + 8 : undefined,
            minHeight: vertical ? undefined : CARD_H + 10,
          }}
        >
          {cardCount > 0 && (
            <OpponentFan
              count={fanCount}
              vertical={vertical}
              mirror={position === "right"}
              flip={position === "top"}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default OpponentSection;
