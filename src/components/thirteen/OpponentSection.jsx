// OPPONENT SECTION - Compact CPU Player Display

import React from "react";
import Card from "../Card";

/**
 * OpponentSection Component
 * @param {Object}  player   - Player object { name, hand, isEliminated }
 * @param {Boolean} isActive  - Whether it's their turn
 * @param {Boolean} hasPassed - Whether they passed this round
 * @param {String}  cardBack  - Back colour for face-down cards (e.g. 'red', 'green', 'purple')
 */
const OpponentSection = ({
  player,
  isActive = false,
  hasPassed = false,
  cardBack = "red",
}) => {
  const { name, hand, isEliminated } = player;
  const cardCount = hand.length;

  const activeRing = isActive && !isEliminated ? "ring-2 ring-yellow-400" : "";

  return (
    <div
      className={`flex items-center gap-2 ${isEliminated ? "opacity-40" : ""}`}
    >
      {/* Avatar */}
      <div
        className={`
          w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm
          ${isActive && !isEliminated ? "bg-yellow-500" : "bg-blue-600"}
          ${activeRing}
          transition-all duration-300
        `}
      >
        {name.slice(-1)}
      </div>

      {/* Name + status */}
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

      {/* Face-down card display (up to 2 cards + overflow badge) */}
      {!isEliminated && cardCount > 0 && (
        <div className="flex items-center -space-x-3 ml-1">
          <Card faceDown={true} size="small" cardBack={cardBack} />
          {cardCount > 1 && (
            <Card faceDown={true} size="small" cardBack={cardBack} />
          )}
          {cardCount > 2 && (
            <div className="w-12 h-16 bg-gray-700 rounded border-2 border-gray-600 flex items-center justify-center text-white text-xs font-bold z-10">
              +{cardCount - 2}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OpponentSection;
