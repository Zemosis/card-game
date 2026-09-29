// OPPONENT SEAT — one player around the table: a name plate plus a preview of
// the cards they hold, always on the table side of the plate.
//
// Every seat uses the same plate and the same preview, so the table reads as
// symmetric: left and right are exact mirrors with tall plates, the top seat
// has a wide plate. Each fan is built like the player's own hand and turned to
// open toward the table. At most SHOWN backs are drawn; past that the last
// back is blurred and carries the rest as "+N".

import React from "react";
import { PixelAvatar, PixelCard } from "../PixelCard";

const CARD_W = 44;
const CARD_H = 64;
const SHOWN = 5; // backs drawn, the last one blurred when there are more
const STEP = 22; // offset between two backs
const ANGLE = 6; // degrees of fan between two backs
// Fan box before it is turned to face the table.
const FAN_W = CARD_W + (SHOWN - 1) * STEP + 28;
const FAN_H = CARD_H + 14;
// How far each seat's fan is turned so it opens toward the table: the fan is
// built like your own hand (opening upward), then rotated.
const TURN = { top: 180, left: 90, right: 270 };

function StatusChip({ label, bg, fg = "#1a1024", blink, side = "right" }) {
  return (
    <span
      className={`absolute -top-3 ${side === "left" ? "left-2" : "right-2"} font-pixel-display text-[10px] leading-none px-1.5 py-1 ${blink ? "blink" : ""}`}
      style={{ backgroundColor: bg, color: fg, boxShadow: "0 0 0 2px #0a0712" }}
    >
      {label}
    </span>
  );
}

// Card backs held as a fan facing the table. Past SHOWN cards, the last back
// is blurred and carries the rest as "+N".
function HandPreview({ count, position }) {
  const drawn = Math.min(count, SHOWN);
  const blurLast = count > SHOWN;
  const extra = count - (SHOWN - 1);
  const mid = (drawn - 1) / 2;
  const turn = TURN[position];
  const sideways = position !== "top";
  const box = sideways ? { width: FAN_H, height: FAN_W } : { width: FAN_W, height: FAN_H };

  return (
    <div className="relative shrink-0" style={box}>
      <div
        className="absolute"
        style={{
          width: FAN_W,
          height: FAN_H,
          left: (box.width - FAN_W) / 2,
          top: (box.height - FAN_H) / 2,
          transform: `rotate(${turn}deg)`,
        }}
      >
        {Array.from({ length: drawn }, (_, i) => {
          const d = i - mid;
          // The "+N" card ends the fan in reading order. The top fan is turned
          // 180 degrees, so there its last card is the first one drawn; it is
          // stacked on top either way.
          const endIndex = position === "top" ? 0 : drawn - 1;
          const blurred = blurLast && i === endIndex;
          const rotation = d * ANGLE;
          return (
            <div
              key={i}
              className="absolute"
              style={{
                left: FAN_W / 2 - CARD_W / 2 + d * STEP,
                bottom: 4 - d * d * 1.4,
                transform: `rotate(${rotation}deg)`,
                transformOrigin: "50% 100%",
                zIndex: position === "top" ? drawn - i : i,
              }}
            >
              <div style={{ filter: blurred ? "blur(1.5px) brightness(0.7)" : "none" }}>
                <PixelCard faceDown size="small" />
              </div>
              {blurred && (
                <div
                  className="absolute inset-0 flex items-center justify-center font-pixel-display text-[12px] text-parchment"
                  style={{ transform: `rotate(${-turn - rotation}deg)`, textShadow: "2px 2px 0 #0a0712" }}
                >
                  +{extra}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const TOP_PLATE_W = 184;
const SIDE_PLATE_W = 124;

// Games can override the plate's status chip (`chip`, null for none), add a
// second chip on the left (`tag`), and replace the card count line (`detail`).
const OpponentSection = ({ player, isActive = false, hasPassed = false, position = "top", face, chip, tag, detail }) => {
  const { name, hand, isEliminated } = player;
  const count = hand.length;
  const vertical = position !== "top";

  // Cards always sit between the plate and the table.
  // The top hand tucks up against its plate, held just in front of it.
  const layout = { top: "flex-col -space-y-1", left: "flex-row gap-3", right: "flex-row-reverse gap-3" }[position];

  return (
    <div className={`flex items-center ${layout}`} data-seat={position}>
      <div
        className={`relative flex items-center ${vertical ? "flex-col justify-center text-center gap-2 px-2 py-3" : "gap-2.5 px-2.5 py-2"}`}
        style={{
          width: vertical ? SIDE_PLATE_W : TOP_PLATE_W,
          minHeight: vertical ? FAN_W - 8 : undefined,
          backgroundColor: isActive ? "#241a3a" : "#14102a",
          border: `4px solid ${isActive ? "#f4c430" : "#0a0712"}`,
          boxShadow: isActive
            ? "0 0 0 4px #0a0712, 0 0 18px rgba(244,196,48,0.45)"
            : "0 0 0 4px #0a0712, inset 0 4px 0 rgba(255,255,255,0.04)",
          animation: isActive ? "pulse-glow 1.6s ease-in-out infinite" : "none",
          opacity: isEliminated ? 0.55 : 1,
        }}
      >
        {chip !== undefined ? (
          chip && <StatusChip {...chip} />
        ) : isEliminated ? (
          <StatusChip label="OUT" bg="#7a1530" fg="#ead8b1" />
        ) : isActive ? (
          <StatusChip label="TURN" bg="#f4c430" blink />
        ) : hasPassed ? (
          <StatusChip label="PASS" bg="#463a78" fg="#ead8b1" />
        ) : null}
        {tag && <StatusChip {...tag} side="left" />}
        <PixelAvatar variant={face?.variant ?? ((player.id || 0) % 5) + 1} customAvatarData={face?.customAvatarData} size={vertical ? 56 : 44} active={isActive} eliminated={isEliminated} />
        <div className="min-w-0 max-w-full">
          <div className="font-pixel-display text-[11px] text-parchment truncate">{name.split(" #")[0]}</div>
          {detail ?? (
            <div className="font-pixel-body text-[18px] leading-none mt-1.5 text-bone/70 whitespace-nowrap">
              <span className="text-glow-cyan">{count}</span> {count === 1 ? "card" : "cards"}
            </div>
          )}
        </div>
      </div>

      {/* Always rendered (empty while dealing) so the seat keeps its shape;
          the deal animation lands cards on it. */}
      <div data-deal-seat={position} style={{ visibility: isEliminated ? "hidden" : "visible" }}>
        <HandPreview count={count} position={position} />
      </div>
    </div>
  );
};

export default OpponentSection;
