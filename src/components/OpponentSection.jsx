// OPPONENT SECTION - Compact CPU Player Display

import React from 'react';
import Card from './Card';

/**
 * OpponentSection Component - Simplified Colonist.io style
 * @param {Object} player - Player object
 * @param {Boolean} isActive - Whether it's their turn
 * @param {Boolean} hasPassed - Whether they passed
 */
const OpponentSection = ({ 
  player, 
  isActive = false,
  hasPassed = false
}) => {
  const { name, hand, isEliminated } = player;
  const cardCount = hand.length;

  // Active player indicator
  const activeRing = isActive && !isEliminated 
    ? 'ring-2 ring-yellow-400' 
    : '';

  return (
    <div className={`flex items-center gap-2 ${isEliminated ? 'opacity-40' : ''}`}>
      {/* Player Avatar/Icon */}
      <div className={`
        w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm
        ${isActive && !isEliminated ? 'bg-yellow-500' : 'bg-blue-600'}
        ${activeRing}
        transition-all duration-300
      `}>
        {name.slice(-1)}
      </div>

      {/* Player Info */}
      <div className="flex flex-col">
        <div className="flex items-center gap-1">
          <span className="font-bold text-white text-sm">{name}</span>
          {isActive && !isEliminated && (
            <span className="text-yellow-400 text-xs">⚡</span>
          )}
          {isEliminated && (
            <span className="bg-red-500 text-white px-1 rounded text-xs">OUT</span>
          )}
          {hasPassed && !isEliminated && (
            <span className="bg-gray-400 text-white px-1 rounded text-xs">PASS</span>
          )}
        </div>
        <div className="text-white/80 text-xs">{cardCount} cards</div>
      </div>

      {/* Card Display - 2 overlapping cards + count */}
      {!isEliminated && cardCount > 0 && (
        <div className="flex items-center -space-x-3 ml-1">
          <Card faceDown={true} size="small" />
          {cardCount > 1 && <Card faceDown={true} size="small" />}
          {cardCount > 2 && (
            <div className="w-12 h-16 bg-blue-700 rounded border-2 border-blue-900 flex items-center justify-center text-white text-xs font-bold">
              +{cardCount - 2}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OpponentSection;
