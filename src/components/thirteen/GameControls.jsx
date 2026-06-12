// GAME CONTROLS - Pixel Retro Action Buttons

import React, { useEffect } from "react";

const GameControls = ({
  onPlay,
  onPass,
  canPlay = false,
  canPass = true,
  isPlayerTurn = false,
  message = "",
  errorMessage = "",
}) => {
  useEffect(() => {
    if (!isPlayerTurn) return;

    const handleKeyPress = (e) => {
      if (e.code === "Space" && canPlay) {
        e.preventDefault();
        onPlay();
      }
      if (e.key.toLowerCase() === "p" && canPass) {
        e.preventDefault();
        onPass();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [isPlayerTurn, canPlay, canPass, onPlay, onPass]);

  return (
    <div className="flex items-center justify-between gap-3 mt-1 px-2">
      {/* Status */}
      <div className="flex-1 flex items-center gap-3 px-3 py-2"
        style={{ backgroundColor: "#0a0712", border: "3px solid #1f1a3d" }}
      >
        {errorMessage ? (
          <div className="font-pixel-display text-[10px]" style={{ color: "#e85a7a" }}>
            ⚠ {errorMessage}
          </div>
        ) : (
          <div className="font-pixel-body text-sm text-bone/70">
            {message}
          </div>
        )}
      </div>

      {/* Buttons */}
      <button
        onClick={onPass}
        disabled={!canPass || !isPlayerTurn}
        className="pixel-btn font-pixel-display text-sm px-6 py-3"
        style={{
          backgroundColor: "#7a1530",
          borderColor: "#3a0a18",
          color: "#ead8b1",
        }}
      >
        ✕ PASS {canPass && isPlayerTurn && <span className="text-[8px] ml-1">(P)</span>}
      </button>
      <button
        onClick={onPlay}
        disabled={!canPlay || !isPlayerTurn}
        className={`pixel-btn font-pixel-display text-sm px-8 py-3 ${canPlay && isPlayerTurn ? "pulse-gold" : ""}`}
        style={{
          backgroundColor: "#f4c430",
          borderColor: "#c89820",
          color: "#1a1024",
        }}
      >
        ► PLAY {canPlay && isPlayerTurn && <span className="text-[8px] ml-1">(SPACE)</span>}
      </button>
    </div>
  );
};

export default GameControls;
