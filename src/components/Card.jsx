// CARD COMPONENT - Visual Card Representation

import React from 'react';
import { SUIT_COLORS } from '../utils/constants';

/**
 * Card Component
 * @param {Object} card - Card object {rank, suit, id}
 * @param {Boolean} isSelected - Whether card is selected
 * @param {Boolean} isPlayable - Whether card can be clicked
 * @param {Boolean} faceDown - Show card back instead of face
 * @param {Function} onClick - Click handler
 * @param {String} size - 'small', 'medium', 'large'
 * @param {String} className - Additional CSS classes
 */
const Card = ({ 
  card, 
  isSelected = false, 
  isPlayable = false,
  faceDown = false,
  onClick,
  size = 'medium',
  className = ''
}) => {
  // Size configurations
  const sizeClasses = {
    small: 'w-12 h-16 text-[10px]', 
    medium: 'w-16 h-24 text-xs',
    large: 'w-20 h-28 text-sm'
  };

  // Dynamic padding based on size
  const paddingClasses = {
    small: 'p-0.5',
    medium: 'p-1.5',
    large: 'p-2'
  };

  // Dynamic center symbol size
  const centerTextClasses = {
    small: 'text-xl',
    medium: 'text-3xl',
    large: 'text-4xl'
  };

  // Suit color (red or black)
  const suitColor = card ? SUIT_COLORS[card.suit] : 'black';
  const colorClass = suitColor === 'red' ? 'text-red-600' : 'text-gray-900';

  // Selection and hover states
  const selectTransform = isSelected ? '-translate-y-6' : '';
  const hoverEffect = isPlayable ? 'hover:scale-105 hover:-translate-y-2 cursor-pointer' : '';
  const opacity = !isPlayable && !isSelected ? 'opacity-70' : 'opacity-100';

  // Handle click
  const handleClick = () => {
    if (isPlayable && onClick) {
      onClick(card);
    }
  };

  // Card back design
  if (faceDown) {
    return (
      <div 
        className={`
          ${sizeClasses[size]}
          ${className}
          bg-gradient-to-br from-blue-600 to-blue-800
          border-2 border-blue-900 rounded-lg
          flex items-center justify-center
          shadow-lg
          relative overflow-hidden
        `}
      >
        {/* Card back pattern */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-2 border-2 border-white rounded"></div>
          <div className="absolute inset-4 border-2 border-white rounded"></div>
        </div>
        <div className="text-white text-2xl font-bold opacity-30">♠</div>
      </div>
    );
  }

  // Card face
  return (
    <div
      onClick={handleClick}
      className={`
        ${sizeClasses[size]}
        ${paddingClasses[size]}
        ${hoverEffect}
        ${selectTransform}
        ${opacity}
        ${className}
        bg-white border-2 border-gray-300 rounded-lg
        flex flex-col justify-between
        shadow-lg transition-all duration-200
        ${isSelected ? 'border-blue-500 ring-2 ring-blue-400' : ''}
        relative overflow-hidden
      `}
    >
      {/* Top left corner */}
      <div className={`${colorClass} font-bold leading-none flex flex-col items-center`}>
        <div>{card.rank}</div>
        <div>{card.suit}</div>
      </div>

      {/* Center suit symbol */}
      <div className={`${colorClass} ${centerTextClasses[size]} text-center flex-1 flex items-center justify-center`}>
        {card.suit}
      </div>

      {/* Bottom right corner (rotated) */}
      <div className={`${colorClass} font-bold leading-none transform rotate-180 text-right flex flex-col items-center`}>
        <div>{card.rank}</div>
        <div>{card.suit}</div>
      </div>

      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-0 right-0 bg-blue-500 text-white rounded-bl-lg w-4 h-4 flex items-center justify-center text-[10px] font-bold z-10">
          ✓
        </div>
      )}
    </div>
  );
};

export default Card;
