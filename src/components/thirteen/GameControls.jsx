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
  selectedCount = 0,
  comboInfo = null,
  onClear,
  onSelectAll,
  canSelect = false,
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
            {errorMessage}
          </div>
        ) : (
          <div className="font-pixel-body text-[20px] leading-none text-bone/80">
            {message}
            {selectedCount > 0 && (
              <>
                <span className="text-bone/40"> · </span>
                <span className="text-glow-cyan">{selectedCount} selected</span>
                {comboInfo && (
                  <span className="ml-2" style={{ color: comboInfo.isValid ? "#f4c430" : "#e85a7a" }}>
                    {comboInfo.text}
                  </span>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <button
        onClick={onClear}
        disabled={!canSelect || selectedCount === 0}
        className="pixel-btn font-pixel-display text-[10px] px-3 py-3"
        style={{ backgroundColor: "#1f1a3d", borderColor: "#0a0712", color: "#ead8b1" }}
      >
        CLEAR
      </button>
      <button
        onClick={onSelectAll}
        disabled={!canSelect}
        className="pixel-btn font-pixel-display text-[10px] px-3 py-3"
        style={{ backgroundColor: "#463a78", borderColor: "#2a234d", color: "#ead8b1" }}
      >
        ALL
      </button>

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
        PASS {canPass && isPlayerTurn && <span className="text-[8px] ml-1">(P)</span>}
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
        PLAY {canPlay && isPlayerTurn && <span className="text-[8px] ml-1">(SPACE)</span>}
      </button>
    </div>
  );
};

export default GameControls;
