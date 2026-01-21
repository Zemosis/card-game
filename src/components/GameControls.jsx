// GAME CONTROLS - Player Action Buttons

import React, { useEffect } from "react";

/**
 * GameControls Component
 * @param {Function} onPlay - Callback when player clicks "Play Cards"
 * @param {Function} onPass - Callback when player clicks "Pass"
 * @param {Boolean} canPlay - Whether play button should be enabled
 * @param {Boolean} canPass - Whether pass button should be enabled
 * @param {Boolean} isPlayerTurn - Whether it's the player's turn
 * @param {Number} selectedCount - Number of cards selected
 * @param {String} message - Status message to display
 * @param {String} errorMessage - Error message if any
 */
const GameControls = ({
  onPlay,
  onPass,
  canPlay = false,
  canPass = true,
  isPlayerTurn = false,
  selectedCount = 0,
  message = "",
  errorMessage = "",
}) => {
  // Keyboard shortcuts
  useEffect(() => {
    if (!isPlayerTurn) return;

    const handleKeyPress = (e) => {
      // Space bar to play
      if (e.code === "Space" && canPlay) {
        e.preventDefault();
        onPlay();
      }
      // P key to pass
      if (e.key.toLowerCase() === "p" && canPass) {
        e.preventDefault();
        onPass();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [isPlayerTurn, canPlay, canPass, onPlay, onPass]);

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Status Message Area */}
      <div className="mb-1 text-center min-h-[30px]">
        {!isPlayerTurn && (
          <div className="bg-gray-800/80 backdrop-blur border-2 border-gray-600 rounded-lg p-1.5">
            <div className="text-white text-sm font-semibold">
              ⏳ Waiting for other players...
            </div>
          </div>
        )}

        {isPlayerTurn && (
          <div className="space-y-1">
            {/* Error message (Keep this for invalid move feedback) */}
            {errorMessage && (
              <div className="bg-red-900/80 backdrop-blur border-2 border-red-400 rounded-lg p-2 animate-shake">
                <div className="text-red-100 font-semibold text-sm">
                  ⚠️ {errorMessage}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 justify-center">
        {/* Play Button */}
        <button
          onClick={onPlay}
          disabled={!canPlay || !isPlayerTurn}
          className={`
            px-5 py-1.5 rounded-lg font-bold text-sm
            transition-all duration-200 transform
            shadow-lg
            ${
              canPlay && isPlayerTurn
                ? "bg-green-500 hover:bg-green-600 text-white hover:scale-105 active:scale-95 cursor-pointer"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }
          `}
        >
          <div className="flex items-center gap-1.5">
            <span>🃏</span>
            <span>Play Cards</span>
            {canPlay && isPlayerTurn && (
              <span className="text-xs opacity-75">(SPACE)</span>
            )}
          </div>
        </button>

        {/* Pass Button */}
        <button
          onClick={onPass}
          disabled={!canPass || !isPlayerTurn}
          className={`
            px-5 py-1.5 rounded-lg font-bold text-sm
            transition-all duration-200 transform
            shadow-lg
            ${
              canPass && isPlayerTurn
                ? "bg-yellow-500 hover:bg-yellow-600 text-white hover:scale-105 active:scale-95 cursor-pointer"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }
          `}
        >
          <div className="flex items-center gap-1.5">
            <span>⏭️</span>
            <span>Pass</span>
            {canPass && isPlayerTurn && (
              <span className="text-xs opacity-75">(P)</span>
            )}
          </div>
        </button>
      </div>

      {/* Shake animation for errors */}
      <style jsx>{`
        @keyframes shake {
          0%,
          100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-10px);
          }
          75% {
            transform: translateX(10px);
          }
        }

        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default GameControls;
