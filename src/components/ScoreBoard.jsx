// SCOREBOARD - Tournament Score Tracking

import React from "react";
import { GAME_SETTINGS } from "../utils/constants";

/**
 * ScoreBoard Component
 * @param {Array} players - All players in the game
 * @param {Number} currentPlayerIndex - Index of active player
 * @param {Number} roundNumber - Current round number
 */
const ScoreBoard = ({
  players = [],
  currentPlayerIndex = 0,
  roundNumber = 1,
}) => {
  const maxScore = GAME_SETTINGS.ELIMINATION_SCORE;

  // Get score color based on value
  const getScoreColor = (score) => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 80) return "text-red-600";
    if (percentage >= 60) return "text-orange-600";
    if (percentage >= 40) return "text-yellow-600";
    return "text-green-600";
  };

  // Get progress bar color
  const getProgressColor = (score) => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 80) return "bg-red-500";
    if (percentage >= 60) return "bg-orange-500";
    if (percentage >= 40) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <div className="bg-gray-800 h-full p-3 w-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b-2 border-gray-700 shrink-0">
        <h2 className="text-lg font-bold text-white">Tournament Score</h2>
        <div className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-xs font-semibold">
          Round {roundNumber}
        </div>
      </div>

      {/* Players List - Scrollable but with hidden scrollbar */}
      <div className="space-y-2 overflow-y-auto no-scrollbar flex-1">
        {players.map((player, index) => {
          const isActive = index === currentPlayerIndex;
          const scorePercentage = (player.score / maxScore) * 100;

          return (
            <div
              key={player.id}
              className={`
                rounded-lg p-2 transition-all duration-200
                ${
                  isActive && !player.isEliminated
                    ? "bg-yellow-900/50 border-2 border-yellow-400"
                    : "bg-gray-700 border-2 border-gray-600"
                }
                ${player.isEliminated ? "opacity-50" : ""}
              `}
            >
              {/* Player Name and Status */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-white text-sm">
                    {player.name}
                  </span>
                  {isActive && !player.isEliminated && (
                    <span className="text-yellow-400 animate-pulse">⚡</span>
                  )}
                  {player.isEliminated && (
                    <span className="bg-red-500 text-white px-2 py-0.5 rounded text-xs font-bold">
                      ELIMINATED
                    </span>
                  )}
                </div>

                {/* Cards Count */}
                {!player.isEliminated && (
                  <div className="text-sm text-gray-300">
                    {player.hand.length} cards
                  </div>
                )}
              </div>

              {/* Score Display */}
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400">Score:</span>
                <span
                  className={`text-sm font-bold ${getScoreColor(player.score)}`}
                >
                  {player.score} / {maxScore}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-900 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${getProgressColor(player.score)}`}
                  style={{ width: `${Math.min(scorePercentage, 100)}%` }}
                ></div>
              </div>

              {/* Warning Text */}
              {player.score >= 20 && !player.isEliminated && (
                <div className="mt-1 text-xs text-red-400 font-semibold text-center">
                  ⚠️ Danger Zone!
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Styles to hide scrollbar */}
      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default ScoreBoard;
