// GAME CONTROLS - Player Action Buttons

import React, { useEffect } from 'react';

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
  message = '',
  errorMessage = ''
}) => {
  
  // Keyboard shortcuts
  useEffect(() => {
    if (!isPlayerTurn) return;

    const handleKeyPress = (e) => {
      // Space bar to play
      if (e.code === 'Space' && canPlay) {
        e.preventDefault();
        onPlay();
      }
      // P key to pass
      if (e.key.toLowerCase() === 'p' && canPass) {
        e.preventDefault();
        onPass();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isPlayerTurn, canPlay, canPass, onPlay, onPass]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Status Message */}
      <div className="mb-4 text-center min-h-[60px]">
        {!isPlayerTurn && (
          <div className="bg-gray-100 border-2 border-gray-300 rounded-lg p-3">
            <div className="text-gray-600 text-lg font-semibold">
              ⏳ Waiting for other players...
            </div>
          </div>
        )}

        {isPlayerTurn && (
          <div className="space-y-2">
            {/* Main message */}
            {message && (
              <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-3">
                <div className="text-blue-700 text-lg font-semibold">
                  {message}
                </div>
              </div>
            )}

            {/* Error message */}
            {errorMessage && (
              <div className="bg-red-50 border-2 border-red-300 rounded-lg p-2 animate-shake">
                <div className="text-red-700 font-semibold text-sm">
                  ⚠️ {errorMessage}
                </div>
              </div>
            )}

            {/* Selection info */}
            {selectedCount > 0 && !errorMessage && (
              <div className="text-gray-600 text-sm">
                {selectedCount} {selectedCount === 1 ? 'card' : 'cards'} selected
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 justify-center">
        {/* Play Button */}
        <button
          onClick={onPlay}
          disabled={!canPlay || !isPlayerTurn}
          className={`
            px-8 py-4 rounded-xl font-bold text-lg
            transition-all duration-200 transform
            shadow-lg
            ${canPlay && isPlayerTurn
              ? 'bg-green-500 hover:bg-green-600 text-white hover:scale-105 active:scale-95 cursor-pointer'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          <div className="flex items-center gap-2">
            <span>🃏</span>
            <span>Play Cards</span>
          </div>
          {canPlay && isPlayerTurn && (
            <div className="text-xs mt-1 opacity-75">
              Press SPACE
            </div>
          )}
        </button>

        {/* Pass Button */}
        <button
          onClick={onPass}
          disabled={!canPass || !isPlayerTurn}
          className={`
            px-8 py-4 rounded-xl font-bold text-lg
            transition-all duration-200 transform
            shadow-lg
            ${canPass && isPlayerTurn
              ? 'bg-yellow-500 hover:bg-yellow-600 text-white hover:scale-105 active:scale-95 cursor-pointer'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          <div className="flex items-center gap-2">
            <span>⏭️</span>
            <span>Pass</span>
          </div>
          {canPass && isPlayerTurn && (
            <div className="text-xs mt-1 opacity-75">
              Press P
            </div>
          )}
        </button>
      </div>

      {/* Help Text */}
      {isPlayerTurn && (
        <div className="mt-4 text-center text-gray-500 text-xs">
          💡 Tip: Select cards from your hand, then click "Play Cards" to play them
        </div>
      )}

      {/* Shake animation for errors */}
      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }

        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default GameControls;
