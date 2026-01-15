// OPPONENT SECTION - CPU Player Display

import React from 'react';
import Card from './Card';
import { COMBO_NAMES } from '../utils/constants';

/**
 * OpponentSection Component
 * @param {Object} player - Player object
 * @param {String} position - 'left', 'top', 'right'
 * @param {Boolean} isActive - Whether it's their turn
 * @param {Boolean} hasPassed - Whether they passed
 */
const OpponentSection = ({ 
  player, 
  position = 'top',
  isActive = false,
  hasPassed = false
}) => {
  const { name, hand, score, isEliminated, lastPlay } = player;
  const cardCount = hand.length;

  // Position-based layout classes
  const positionClasses = {
    left: 'flex-col items-start',
    top: 'flex-col items-center',
    right: 'flex-col items-end'
  };

  const containerClass = positionClasses[position] || positionClasses.top;

  // Active player indicator
  const activeRing = isActive && !isEliminated 
    ? 'ring-4 ring-yellow-400 ring-offset-2' 
    : '';

  return (
    <div className={`flex ${containerClass} gap-2`}>
      {/* Player Info Card */}
      <div className={`
        bg-white rounded-lg shadow-lg p-3 min-w-[180px]
        ${activeRing}
        ${isEliminated ? 'opacity-50 bg-gray-100' : ''}
        transition-all duration-300
      `}>
        {/* Name and Status */}
        <div className="flex items-center justify-between mb-2">
          <div className="font-bold text-gray-800 flex items-center gap-2">
            {name}
            {isActive && !isEliminated && (
              <span className="text-yellow-500 text-xl animate-pulse">⚡</span>
            )}
          </div>
          
          {isEliminated && (
            <span className="bg-red-500 text-white px-2 py-0.5 rounded text-xs font-bold">
              OUT
            </span>
          )}
        </div>

        {/* Score */}
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-gray-600">Score:</span>
          <span className={`font-bold ${
            score >= 20 ? 'text-red-600' : 
            score >= 15 ? 'text-orange-600' : 
            'text-gray-800'
          }`}>
            {score} / 25
          </span>
        </div>

        {/* Card Count */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Cards:</span>
          <span className="font-bold text-gray-800">{cardCount}</span>
        </div>

        {/* Passed Indicator */}
        {hasPassed && !isEliminated && (
          <div className="mt-2 bg-gray-200 text-gray-600 text-center py-1 rounded text-xs font-semibold">
            PASSED
          </div>
        )}

        {/* Last Play Info */}
        {lastPlay && !hasPassed && !isEliminated && (
          <div className="mt-2 bg-blue-50 border border-blue-200 rounded p-2">
            <div className="text-xs text-gray-600 mb-1">Last Played:</div>
            <div className="text-xs font-semibold text-blue-700">
              {COMBO_NAMES[lastPlay.type]}
            </div>
            <div className="flex gap-1 mt-1 flex-wrap">
              {lastPlay.cards.slice(0, 3).map((card, idx) => (
                <span key={idx} className="text-xs bg-white px-1 py-0.5 rounded border">
                  {card.rank}{card.suit}
                </span>
              ))}
              {lastPlay.cards.length > 3 && (
                <span className="text-xs text-gray-500">
                  +{lastPlay.cards.length - 3}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Face-down Cards Display */}
      {!isEliminated && cardCount > 0 && (
        <div className="flex gap-1 flex-wrap justify-center max-w-[200px]">
          {/* Show up to 5 card backs */}
          {Array.from({ length: Math.min(cardCount, 5) }).map((_, idx) => (
            <Card
              key={idx}
              faceDown={true}
              size="small"
            />
          ))}
          {cardCount > 5 && (
            <div className="w-12 h-16 bg-gray-200 rounded-lg flex items-center justify-center text-gray-600 text-xs font-bold">
              +{cardCount - 5}
            </div>
          )}
        </div>
      )}

      {/* No Cards - Winner Display */}
      {!isEliminated && cardCount === 0 && (
        <div className="bg-green-100 border-2 border-green-400 rounded-lg p-3 text-center">
          <div className="text-2xl mb-1">🏆</div>
          <div className="text-green-700 font-bold text-sm">Round Winner!</div>
        </div>
      )}
    </div>
  );
};

export default OpponentSection;
