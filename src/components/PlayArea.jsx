// PLAY AREA - Center Table Display

import React from 'react';
import Card from './Card';
import { COMBO_NAMES } from '../utils/constants';

/**
 * PlayArea Component
 * @param {Object|null} currentPlay - Current combination on table
 * @param {String|null} lastPlayerName - Name of player who made the play
 * @param {Number} roundNumber - Current round number
 */
const PlayArea = ({ 
  currentPlay = null, 
  lastPlayerName = null,
  roundNumber = 1
}) => {
  return (
    <div className="w-full h-full flex items-center justify-center p-4">
      {/* Green Felt Table Background */}
      <div className="relative w-full max-w-2xl h-64 bg-gradient-to-br from-green-700 to-green-900 rounded-3xl shadow-2xl border-8 border-amber-900 overflow-hidden">
        
        {/* Table Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-8 border-4 border-white rounded-2xl"></div>
        </div>

        {/* Round Number */}
        <div className="absolute top-4 left-6 bg-amber-900 text-amber-100 px-3 py-1 rounded-full text-sm font-bold shadow-lg">
          Round {roundNumber}
        </div>

        {/* Center Content */}
        <div className="relative z-10 h-full flex flex-col items-center justify-center gap-4">
          
          {/* No Play Yet */}
          {!currentPlay && (
            <div className="text-center text-green-200">
              <div className="text-4xl mb-2">🃏</div>
              <div className="text-xl font-semibold">Waiting for first play...</div>
            </div>
          )}

          {/* Current Play Display */}
          {currentPlay && (
            <div className="text-center animate-fade-in">
              {/* Player Name */}
              {lastPlayerName && (
                <div className="text-green-200 text-sm font-semibold mb-2">
                  {lastPlayerName} played:
                </div>
              )}

              {/* Combination Type */}
              <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-lg mb-3 shadow-lg">
                <div className="text-gray-600 text-xs uppercase tracking-wide mb-1">
                  Combination
                </div>
                <div className="text-gray-900 text-lg font-bold">
                  {COMBO_NAMES[currentPlay.type]}
                </div>
              </div>

              {/* Cards Display */}
              <div className="flex gap-2 justify-center items-center flex-wrap">
                {currentPlay.cards.map((card, index) => (
                  <div 
                    key={card.id}
                    className="transform transition-all duration-300"
                    style={{
                      animation: `cardSlideIn 0.3s ease-out ${index * 0.05}s both`
                    }}
                  >
                    <Card
                      card={card}
                      size="medium"
                      isPlayable={false}
                    />
                  </div>
                ))}
              </div>

              {/* Beat This Message */}
              <div className="mt-3 text-green-200 text-sm font-semibold">
                Beat this or pass!
              </div>
            </div>
          )}
        </div>

        {/* Decorative Corner Elements */}
        <div className="absolute top-2 right-2 text-amber-700 opacity-30">♠</div>
        <div className="absolute bottom-2 left-2 text-amber-700 opacity-30">♥</div>
        <div className="absolute top-2 left-2 text-amber-700 opacity-30">♦</div>
        <div className="absolute bottom-2 right-2 text-amber-700 opacity-30">♣</div>
      </div>

      {/* Inline animation styles */}
      <style jsx>{`
        @keyframes cardSlideIn {
          from {
            opacity: 0;
            transform: translateY(-20px) scale(0.8);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .animate-fade-in {
          animation: fade-in 0.4s ease-out;
        }
      `}</style>
    </div>
  );
};

export default PlayArea;
