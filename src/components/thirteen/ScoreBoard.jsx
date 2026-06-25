// SCOREBOARD - Pixel Retro Style

import React from "react";
import { PixelAvatar } from "../PixelCard";
import { GAME_SETTINGS } from "../../utils/constants";

const ScoreBoard = ({
  players = [],
  currentPlayerIndex = 0,
  roundNumber = 1,
  matchWins = [0, 0, 0, 0],
  myIndex = -1,
}) => {
  const maxScore = GAME_SETTINGS.ELIMINATION_SCORE;

  // Sort by score to determine place
  const ranked = [...players]
    .map((p, i) => ({ ...p, originalIndex: i }))
    .sort((a, b) => a.score - b.score);

  return (
    <div
      className="flex flex-col"
      style={{ borderBottom: "4px solid #0a0712" }}
    >
      <div
        className="px-3 py-2 font-pixel-display text-[10px] tracking-wider flex items-center justify-between"
        style={{ backgroundColor: "#1a1024", color: "#f4c430" }}
      >
        <span>✦ SCOREBOARD ✦</span>
        <span className="text-bone/60">RD {roundNumber}</span>
      </div>
      <div className="px-3 py-2 flex flex-col gap-1.5">
        {ranked.map((player, rankIdx) => {
          const index = player.originalIndex;
          const isActive = index === currentPlayerIndex;
          const place = rankIdx + 1;
          const scorePercentage = (player.score / maxScore) * 100;

          const isMe = index === myIndex;
          // "NAME #TAG" → tight name + dimmed tag (the font's space is wide)
          const [baseName, nameTag] = player.name.split(" #");

          return (
            <div
              key={player.id}
              className="flex items-center gap-2 px-2 py-1.5"
              style={{
                backgroundColor: isActive ? "#2e1a3a" : "#14102a",
                border: isMe ? "2px solid #5fd4d6" : "2px solid #1f1a3d",
              }}
            >
              <div
                className="font-pixel-display text-[10px]"
                style={{
                  color:
                    place === 1
                      ? "#f4c430"
                      : place === 2
                        ? "#c8b890"
                        : place === 3
                          ? "#c89820"
                          : "#7a1530",
                  width: 20,
                  flexShrink: 0,
                }}
              >
                #{place}
              </div>
              <PixelAvatar
                variant={isMe ? "me" : ((player.id % 5) + 1)}
                size={24}
                active={isActive}
                eliminated={player.isEliminated}
              />
              <div className="flex-1 min-w-0">
                <div className="font-pixel-display text-[9px] text-parchment truncate">
                  {baseName}
                  {nameTag && (
                    <span className="text-bone/50" style={{ marginLeft: 2 }}>
                      #{nameTag}
                    </span>
                  )}
                  {isActive && !player.isEliminated && (
                    <span
                      className="ml-1 blink"
                      style={{
                        fontSize: 7,
                        padding: "1px 3px",
                        backgroundColor: "#f4c430",
                        color: "#1a1024",
                      }}
                    >
                      TURN
                    </span>
                  )}
                  {player.isEliminated && (
                    <span
                      className="ml-1"
                      style={{
                        fontSize: 7,
                        padding: "1px 3px",
                        backgroundColor: "#7a1530",
                        color: "#ead8b1",
                      }}
                    >
                      OUT
                    </span>
                  )}
                </div>
                <div className="font-pixel-body text-xs text-bone/60">
                  {player.hand.length} cards
                  {matchWins[player.originalIndex] > 0 && (
                    <span className="ml-1 text-glow-gold">
                      · {matchWins[player.originalIndex]}W
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right" style={{ width: 52, flexShrink: 0 }}>
                <div className="font-pixel-display text-[10px] text-glow-gold">
                  {player.score}
                  <span className="text-bone/50 text-[7px] ml-0.5">
                    /{maxScore}
                  </span>
                </div>
                {/* Score bar */}
                <div
                  style={{
                    width: "100%",
                    height: 4,
                    backgroundColor: "#0a0712",
                    border: "1px solid #1f1a3d",
                    marginTop: 2,
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(scorePercentage, 100)}%`,
                      height: "100%",
                      transition: "width 300ms ease",
                      background:
                        scorePercentage >= 80
                          ? "#e85a7a"
                          : scorePercentage >= 60
                            ? "#f4c430"
                            : "#9bd14f",
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ScoreBoard;
