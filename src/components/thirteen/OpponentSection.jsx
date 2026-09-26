// OPPONENT SEAT — one player around the table: a name plate plus a preview of
// the cards they hold, always on the table side of the plate.
//
// Every seat uses the same plate and the same preview, so the table reads as
// symmetric: left and right are exact mirrors, the top seat is the same parts
// turned to face down. A hand shows at most SHOWN backs; past that the last
// back is blurred and carries the rest as "+N".

import React from "react";
import { PixelAvatar, PixelCard } from "../PixelCard";

const SEAT_PLATE_W = 184;
const CARD_W = 44;
const CARD_H = 64;
const SHOWN = 5; // backs drawn, the last one blurred when there are more
const STEP = 14; // offset between two backs
const FAN_LEN = CARD_W + (SHOWN - 1) * STEP; // longest a preview gets

function StatusChip({ label, bg, fg = "#1a1024", blink }) {
  return (
    <span
      className={`absolute -top-3 right-2 font-pixel-display text-[10px] leading-none px-1.5 py-1 ${blink ? "blink" : ""}`}
      style={{ backgroundColor: bg, color: fg, boxShadow: "0 0 0 2px #0a0712" }}
    >
      {label}
    </span>
  );
}

// Card backs, fanned along one axis. `vertical` stacks sideways cards down
// the side of the table.
function HandPreview({ count, vertical }) {
  const drawn = Math.min(count, SHOWN);
  const extra = count - (SHOWN - 1); // cards the blurred back stands for
  const blurLast = count > SHOWN;
  const mid = (drawn - 1) / 2;
  // Box sized for a full preview so the seat never changes size mid-deal.
  const box = vertical ? { width: CARD_H + 8, height: FAN_LEN + 12 } : { width: FAN_LEN + 12, height: CARD_H + 8 };
  const start = (FAN_LEN - (CARD_W + (drawn - 1) * STEP)) / 2 + 6;

  return (
    <div className="relative shrink-0" style={box}>
      {Array.from({ length: drawn }, (_, i) => {
        const d = i - mid;
        const blurred = blurLast && i === drawn - 1;
        const pos = start + i * STEP;
        return (
          <div
            key={i}
            className="absolute"
            style={{
              ...(vertical
                ? { top: pos + (CARD_W - CARD_H) / 2, left: (CARD_H + 8 - CARD_W) / 2 }
                : { left: pos, top: 4 + Math.abs(d) * 1.5 }),
              transform: `rotate(${(vertical ? 90 : 0) + d * 3}deg)`,
              zIndex: i,
            }}
          >
            <div style={{ filter: blurred ? "blur(1.5px) brightness(0.7)" : "none" }}>
              <PixelCard faceDown size="small" />
            </div>
            {blurred && (
              <div
                className="absolute inset-0 flex items-center justify-center font-pixel-display text-[12px] text-parchment"
                style={{ transform: vertical ? "rotate(-90deg)" : "none", textShadow: "2px 2px 0 #0a0712" }}
              >
                +{extra}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const OpponentSection = ({ player, isActive = false, hasPassed = false, position = "top", isDealing = false }) => {
  const { name, hand, isEliminated } = player;
  const count = hand.length;
  const vertical = position !== "top";

  // Cards always sit between the plate and the table.
  const layout = { top: "flex-col", left: "flex-row", right: "flex-row-reverse" }[position];

  return (
    <div className={`flex items-center gap-3 ${layout}`} data-seat={position}>
      <div
        className="relative flex items-center gap-2.5 px-2.5 py-2"
        style={{
          width: SEAT_PLATE_W,
          backgroundColor: isActive ? "#241a3a" : "#14102a",
          border: `4px solid ${isActive ? "#f4c430" : "#0a0712"}`,
          boxShadow: isActive
            ? "0 0 0 4px #0a0712, 0 0 18px rgba(244,196,48,0.45)"
            : "0 0 0 4px #0a0712, inset 0 4px 0 rgba(255,255,255,0.04)",
          animation: isActive ? "pulse-glow 1.6s ease-in-out infinite" : "none",
          opacity: isEliminated ? 0.55 : 1,
        }}
      >
        {isEliminated ? (
          <StatusChip label="OUT" bg="#7a1530" fg="#ead8b1" />
        ) : isActive ? (
          <StatusChip label="TURN" bg="#f4c430" blink />
        ) : hasPassed ? (
          <StatusChip label="PASS" bg="#463a78" fg="#ead8b1" />
        ) : null}
        <PixelAvatar variant={((player.id || 0) % 5) + 1} size={44} active={isActive} eliminated={isEliminated} />
        <div className="min-w-0">
          <div className="font-pixel-display text-[11px] text-parchment truncate">{name.split(" #")[0]}</div>
          <div className="font-pixel-body text-[18px] leading-none mt-1.5 text-bone/70 whitespace-nowrap">
            <span className="text-glow-cyan">{count}</span> {count === 1 ? "card" : "cards"}
          </div>
        </div>
      </div>

      {/* Always rendered (empty while dealing) so the seat keeps its shape;
          the deal animation lands cards on it. */}
      <div data-deal-seat={position} style={{ visibility: isEliminated ? "hidden" : "visible" }}>
        <HandPreview count={isDealing || count ? count : 0} vertical={vertical} />
      </div>
    </div>
  );
};

export default OpponentSection;
