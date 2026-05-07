// PLAY AREA - Pixel Retro Felt Table Center

import React from "react";
import { PixelCard } from "../PixelCard";
import { COMBO_NAMES } from "../../utils/constants";

const PlayArea = ({
  currentPlay = null,
  lastPlayerName = null,
  roundNumber = 1,
}) => {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="relative" style={{ width: "100%", maxWidth: 800 }}>
        {/* Felt mat */}
        <div
          className="relative felt-bg flex flex-col items-center justify-center"
          style={{
            padding: 20,
            height: 260,
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
              <div className="text-center mb-4">
                <div className="font-pixel-display text-[9px] text-bone/70 tracking-widest mb-1">
                  {lastPlayerName
                    ? `${lastPlayerName.toUpperCase()} PLAYED`
                    : "CURRENT PLAY"}
                </div>
                <div className="font-pixel-display text-lg text-glow-gold">
                  ✦ {COMBO_NAMES[currentPlay.type] || "CARDS"} ✦
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 my-3">
                {currentPlay.cards.map((c, i) => (
                  <div
                    key={c.id || i}
                    style={{
                      transform: `rotate(${(i - Math.floor(currentPlay.cards.length / 2)) * 4}deg) translateY(${Math.abs(i - Math.floor(currentPlay.cards.length / 2)) * 2}px)`,
                      animation: "float 2.4s ease-in-out infinite",
                      animationDelay: `${i * 0.15}s`,
                    }}
                  >
                    <PixelCard
                      rank={c.rank}
                      suit={c.suit}
                      size="large"
                    />
                  </div>
                ))}
              </div>

              <div className="text-center mt-4">
                <div className="font-pixel-display text-[9px] text-rose tracking-wider blink">
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
