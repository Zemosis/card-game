// PLAYER HAND COMPONENT - Interactive Hand Display

import React, { useState, useEffect } from 'react';
import Card from './Card';
import { sortHand } from '../utils/deckUtils';
import { identifyCombination } from '../utils/handEvaluator';
import { COMBO_NAMES } from '../utils/constants';

/**
 * PlayerHand Component
 * @param {Array} hand - Player's cards
 * @param {Array} selectedCards - Currently selected cards
 * @param {Function} onSelectionChange - Callback when selection changes
 * @param {Boolean} isActive - Whether player can interact
 * @param {Boolean} showCardCount - Show card count badge
 */
const PlayerHand = ({ 
  hand = [], 
  selectedCards = [], 
  onSelectionChange,
  isActive = true,
  showCardCount = true
}) => {
  const [sortedHand, setSortedHand] = useState([]);

  // Sort hand whenever it changes
  useEffect(() => {
    setSortedHand(sortHand(hand));
  }, [hand]);

  // Toggle card selection
  const toggleCardSelection = (card) => {
    if (!isActive) return;

    const isSelected = selectedCards.some(c => c.id === card.id);
    
    if (isSelected) {
      // Remove from selection
      onSelectionChange(selectedCards.filter(c => c.id !== card.id));
    } else {
      // Add to selection
      onSelectionChange([...selectedCards, card]);
    }
  };

  // Select all cards
  const handleSelectAll = () => {
    if (!isActive) return;
    onSelectionChange([...sortedHand]);
  };

  // Clear selection
  const handleClearSelection = () => {
    if (!isActive) return;
    onSelectionChange([]);
  };

  // Check if card is selected
  const isCardSelected = (card) => {
    return selectedCards.some(c => c.id === card.id);
  };

  // Get current combination info
  const getCombinationInfo = () => {
    if (selectedCards.length === 0) return null;
    
    const combo = identifyCombination(selectedCards);
    if (!combo) return { text: 'Invalid Combination', isValid: false };
    
    return { 
      text: COMBO_NAMES[combo.type] || 'Valid Combination', 
      isValid: true 
    };
  };

  const comboInfo = getCombinationInfo();

  return (
    <div className="w-full bg-gray-900/30 backdrop-blur rounded-lg p-2">
      {/* Controls */}
      <div className="flex items-center justify-between mb-1 px-2">
        <div className="flex items-center gap-2">
          {showCardCount && (
            <div className="bg-gray-800 text-white px-2 py-0.5 rounded-full text-xs font-semibold border border-gray-600">
              {hand.length} {hand.length === 1 ? 'card' : 'cards'}
            </div>
          )}
          
          {selectedCards.length > 0 && (
            <div className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
              comboInfo?.isValid 
                ? 'bg-green-900/80 text-green-200 border-green-500' 
                : 'bg-red-900/80 text-red-200 border-red-500'
            }`}>
              {selectedCards.length} selected
              {comboInfo && ` • ${comboInfo.text}`}
            </div>
          )}
        </div>

        {/* Selection buttons */}
        {isActive && hand.length > 0 && (
          <div className="flex gap-1.5">
            <button
              onClick={handleClearSelection}
              disabled={selectedCards.length === 0}
              className="px-2 py-0.5 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded text-xs font-medium transition-colors border border-gray-600"
            >
              Clear
            </button>
            <button
              onClick={handleSelectAll}
              className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition-colors border border-blue-500"
            >
              Select All
            </button>
          </div>
        )}
      </div>

      {/* Cards Display */}
      <div className="relative">
        {/* No cards message */}
        {hand.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-2">🎉</div>
            <div className="text-lg font-semibold">No cards remaining</div>
          </div>
        )}

        {/* FIXED CONTAINER:
           1. pt-8: Adds padding to top so selected cards (translate-y-6) don't get cut off.
           2. minHeight: 140px: Ensures container is tall enough for card + animation.
           3. pb-4: Adds space at bottom.
        */}
        {hand.length > 0 && (
          <div 
            className="flex justify-center items-end overflow-x-auto pt-8 pb-4 px-4" 
            style={{ minHeight: '140px' }}
          >
            <div className="flex gap-2">
              {sortedHand.map((card) => {
                const isSelected = isCardSelected(card);

                return (
                  <div
                    key={card.id}
                    className="flex-shrink-0"
                  >
                    <Card
                      card={card}
                      isSelected={isSelected}
                      isPlayable={isActive}
                      onClick={toggleCardSelection}
                      size="medium"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Inactive overlay */}
      {!isActive && hand.length > 0 && (
        <div className="text-center mt-2 text-gray-400 text-sm">
          Waiting for your turn...
        </div>
      )}
    </div>
  );
};

export default PlayerHand;
