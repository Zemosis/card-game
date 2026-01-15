// ============================================
// PLAYER HAND COMPONENT - Interactive Hand Display
// ============================================

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
    <div className="w-full">
      {/* Controls */}
      <div className="flex items-center justify-between mb-3 px-2">
        <div className="flex items-center gap-3">
          {showCardCount && (
            <div className="bg-gray-800 text-white px-3 py-1 rounded-full text-sm font-semibold">
              {hand.length} {hand.length === 1 ? 'card' : 'cards'}
            </div>
          )}
          
          {selectedCards.length > 0 && (
            <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
              comboInfo?.isValid 
                ? 'bg-green-100 text-green-700' 
                : 'bg-red-100 text-red-700'
            }`}>
              {selectedCards.length} selected
              {comboInfo && ` • ${comboInfo.text}`}
            </div>
          )}
        </div>

        {/* Selection buttons */}
        {isActive && hand.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={handleClearSelection}
              disabled={selectedCards.length === 0}
              className="px-3 py-1 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 text-gray-700 rounded text-sm font-medium transition-colors"
            >
              Clear
            </button>
            <button
              onClick={handleSelectAll}
              className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm font-medium transition-colors"
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
          <div className="text-center py-12 text-gray-500">
            <div className="text-4xl mb-2">🎉</div>
            <div className="text-lg font-semibold">No cards remaining</div>
          </div>
        )}

        {/* Cards with overlap */}
        {hand.length > 0 && (
          <div className="flex justify-center items-end min-h-32">
            <div className="relative flex" style={{ 
              width: Math.min(sortedHand.length * 35 + 65, 800) 
            }}>
              {sortedHand.map((card, index) => {
                const isSelected = isCardSelected(card);
                const leftPosition = index * 35; // Card overlap

                return (
                  <div
                    key={card.id}
                    className="absolute transition-all duration-200"
                    style={{ 
                      left: `${leftPosition}px`,
                      zIndex: isSelected ? 100 + index : index
                    }}
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
        <div className="text-center mt-2 text-gray-500 text-sm">
          Waiting for your turn...
        </div>
      )}
    </div>
  );
};

export default PlayerHand;
