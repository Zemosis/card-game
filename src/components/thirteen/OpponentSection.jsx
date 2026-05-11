// OPPONENT SECTION - Pixel Retro Style

import React from "react";
import { PixelAvatar, CardFan } from "../PixelCard";

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

  // Fan rotation: cards face toward center
  const fanRotate = {
    top: "rotate(180deg)",
    left: "rotate(90deg)",
    right: "rotate(-90deg)",
  }[position];

  // Layout direction so cards sit between avatar and table center
  const layout = {
    top: { flexDirection: "column", align: "items-center" },
    left: { flexDirection: "row", align: "items-center" },
    right: { flexDirection: "row-reverse", align: "items-center" },
  }[position];

  return (
    <div
      className="relative"
      style={{ minWidth: position === "top" ? 320 : 220 }}
    >
      <div
        className={`flex ${layout.align} gap-3`}
        style={{ flexDirection: layout.flexDirection }}
      >
        {/* Avatar block */}
        <div
          className="relative"
          style={{
            backgroundColor: "#14102a",
            border: `4px solid ${isActive ? "#f4c430" : "#0a0712"}`,
            padding: "8px 10px",
            minWidth: 200,
            boxShadow: isActive
              ? "0 0 0 4px #0a0712, 0 0 16px rgba(244,196,48,0.5), inset 0 4px 0 rgba(255,255,255,0.06)"
              : "0 0 0 4px #0a0712, inset 0 4px 0 rgba(255,255,255,0.04)",
            animation: isActive
              ? "pulse-glow 1.6s ease-in-out infinite"
              : "none",
          }}
        >
          <div className="flex items-center gap-3">
            <PixelAvatar
              variant={((player.id || 0) % 5) + 1}
              size={40}
              active={isActive}
              eliminated={isEliminated}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <div className="font-pixel-display text-[10px] text-parchment truncate">
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
                    ELIMINATED
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-pixel-body text-xs text-bone/70">
                  {player.type === "AI" ? "CPU" : "Human"}
                </span>
              </div>
            </div>
          </div>

          {/* Card count bar */}
          <div className="mt-2 flex items-center gap-2">
            <div className="font-pixel-display text-[9px] text-glow-cyan">
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
                }}
              />
            </div>
            <span className="font-pixel-body text-xs text-bone/60">cards</span>
          </div>
        </div>

        {/* Card fan — reserve space during dealing so layout doesn't shift */}
        {!isEliminated && (cardCount > 0 || isDealing) && (
          <div
            style={{
              transform: fanRotate,
              transformOrigin: "center",
              minWidth: position === "top" ? undefined : 7 * 8 + 40,
              minHeight: position === "top" ? 64 : undefined,
            }}
          >
            {cardCount > 0 && (
              <CardFan count={fanCount} size="small" spread={30} />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OpponentSection;
