// MAIN MENU - Landing Page with Game Selection

import React from 'react';
import { useNavigate } from 'react-router-dom';

const MainMenu = () => {
  const navigate = useNavigate();

  const games = [
    {
      id: '13',
      title: 'Game "13"',
      description: 'Modified Tien Len - Climb your way to victory by playing combinations. Eliminate opponents to win!',
      emoji: '🎴',
      available: true,
      route: '/lobby-13',
      color: 'from-blue-500 to-purple-600'
    },
    {
      id: 'muushig',
      title: 'Muushig',
      description: 'Coming soon! Traditional Mongolian card game with unique rules and strategy.',
      emoji: '🃏',
      available: false,
      route: '/muushig',
      color: 'from-green-500 to-teal-600'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-8">
      <div className="max-w-6xl w-full">
        
        {/* Header */}
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-6xl font-bold text-white mb-4 drop-shadow-lg">
            🎲 Card Games Collection
          </h1>
          <p className="text-xl text-white/80">
            Choose your game and challenge the CPU opponents!
          </p>
        </div>

        {/* Game Cards */}
        <div className="grid md:grid-cols-2 gap-8">
          {games.map((game, index) => (
            <div
              key={game.id}
              className="animate-slide-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <button
                onClick={() => game.available && navigate(game.route)}
                disabled={!game.available}
                className={`
                  w-full h-full p-8 rounded-2xl
                  bg-white shadow-2xl
                  transition-all duration-300 transform
                  ${game.available 
                    ? 'hover:scale-105 hover:shadow-3xl cursor-pointer active:scale-95' 
                    : 'opacity-60 cursor-not-allowed'
                  }
                `}
              >
                {/* Game Icon */}
                <div className="text-8xl mb-6 animate-bounce-slow">
                  {game.emoji}
                </div>

                {/* Game Title */}
                <h2 className={`
                  text-3xl font-bold mb-4 bg-gradient-to-r ${game.color}
                  bg-clip-text text-transparent
                `}>
                  {game.title}
                </h2>

                {/* Description */}
                <p className="text-gray-600 mb-6 text-lg leading-relaxed">
                  {game.description}
                </p>

                {/* Status Badge */}
                <div className="flex justify-center">
                  {game.available ? (
                    <span className={`
                      px-6 py-2 rounded-full font-bold text-white
                      bg-gradient-to-r ${game.color}
                      shadow-lg
                    `}>
                      Play Now →
                    </span>
                  ) : (
                    <span className="px-6 py-2 rounded-full font-bold bg-gray-300 text-gray-600">
                      Coming Soon
                    </span>
                  )}
                </div>
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-white/60 text-sm">
          <p>Built with React, Tailwind CSS, and Vite</p>
          <p className="mt-2">Version 1.0.0 - 2026</p>
        </div>
      </div>

      {/* Animations */}
      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(40px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes bounce-slow {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.8s ease-out;
        }

        .animate-slide-up {
          animation: slide-up 0.6s ease-out both;
        }

        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }

        .hover\\:shadow-3xl:hover {
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        }
      `}</style>
    </div>
  );
};

export default MainMenu;
