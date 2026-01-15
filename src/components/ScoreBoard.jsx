// SCOREBOARD - Tournament Score Tracking

import React from 'react';
import { GAME_SETTINGS } from '../utils/constants';

/**
 * ScoreBoard Component
 * @param {Array} players - All players in the game
 * @param {Number} currentPlayerIndex - Index of active player
 * @param {Number} roundNumber - Current round number
 */
const ScoreBoard = ({ 
  players = [], 
  currentPlayerIndex = 0,
  roundNumber = 1
}) => {
  const maxScore = GAME_SETTINGS.ELIMINATION_SCORE;

  // Get score color based on value
  const getScoreColor = (score) => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 80) return 'text-red-600';
    if (percentage >= 60) return 'text-orange-600';
    if (percentage >= 40) return 'text-yellow-600';
    return 'text-green-600';
  };

  // Get progress bar color
  const getProgressColor = (score) => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 80) return 'bg-red-500';
    if (percentage >= 60) return 'bg-orange-500';
    if (percentage >= 40) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 w-full max-w-md">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-gray-200">
        <h2 className="text-xl font-bold text-gray-800">Tournament Score</h2>
        <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-semibold">
          Round {roundNumber}
        </div>
      </div>

      {/* Players List */}
      <div className="space-y-3">
        {players.map((player, index) => {
          const isActive = index === currentPlayerIndex;
          const scorePercentage = (player.score / maxScore) * 100;

          return (
            <div
              key={player.id}
              className={`
                rounded-lg p-3 transition-all duration-200
                ${isActive && !player.isEliminated
                  ? 'bg-yellow-50 border-2 border-yellow-400 shadow-md'
                  : 'bg-gray-50 border-2 border-gray-200'
                }
                ${player.isEliminated ? 'opacity-50' : ''}
              `}
            >
              {/* Player Name and Status */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-800">
                    {player.name}
                  </span>
                  {isActive && !player.isEliminated && (
                    <span className="text-yellow-500 animate-pulse">⚡</span>
                  )}
                  {player.isEliminated && (
                    <span className="bg-red-500 text-white px-2 py-0.5 rounded text-xs font-bold">
                      ELIMINATED
                    </span>
                  )}
                </div>

                {/* Cards Count */}
                {!player.isEliminated && (
                  <div className="text-sm text-gray-600">
                    {player.hand.length} cards
                  </div>
                )}
              </div>

              {/* Score Display */}
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">Score:</span>
                <span className={`text-lg font-bold ${getScoreColor(player.score)}`}>
                  {player.score} / {maxScore}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${getProgressColor(player.score)}`}
                  style={{ width: `${Math.min(scorePercentage, 100)}%` }}
                ></div>
              </div>

              {/* Warning Text */}
              {player.score >= 20 && !player.isEliminated && (
                <div className="mt-2 text-xs text-red-600 font-semibold text-center">
                  ⚠️ Danger Zone!
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t-2 border-gray-200">
        <div className="text-xs text-gray-600 space-y-1">
          <div className="flex items-center justify-between">
            <span>🎯 First to empty hand wins the round</span>
          </div>
          <div className="flex items-center justify-between">
            <span>❌ Eliminated at {maxScore} points</span>
          </div>
          <div className="flex items-center justify-between">
            <span>⚠️ 10+ cards = DOUBLE penalty</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScoreBoard;
