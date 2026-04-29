// GAME MUUSHIG - Boilerplate / Coming Soon

import React from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../components/Card";

// Sample cards for sprite sheet smoke test
const SAMPLE_CARDS = [
  { rank: "A", suit: "♠", id: "A♠", rankValue: 11, suitValue: 3 },
  { rank: "K", suit: "♥", id: "K♥", rankValue: 10, suitValue: 2 },
  { rank: "10", suit: "♦", id: "10♦", rankValue: 7, suitValue: 1 },
  { rank: "3", suit: "♣", id: "3♣", rankValue: 0, suitValue: 0 },
];

const GameMuushig = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-teal-900 to-emerald-900 flex flex-col items-center justify-center p-8">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-6xl font-bold text-white mb-4 drop-shadow-lg">
          🃏 Muushig
        </h1>
        <p className="text-xl text-white/70">
          Traditional Mongolian Card Game
        </p>
        <div className="mt-4 inline-block bg-yellow-500/20 border border-yellow-400/50 text-yellow-300 px-6 py-2 rounded-full text-sm font-semibold">
          Coming Soon — Game Logic Under Construction
        </div>
      </div>

      {/* Sprite Sheet Smoke Test */}
      <div className="bg-white/10 backdrop-blur rounded-2xl p-8 mb-10 border border-white/20">
        <p className="text-white/60 text-xs uppercase tracking-widest mb-4 text-center">
          Card Sprite Preview
        </p>
        <div className="flex gap-4 justify-center">
          {SAMPLE_CARDS.map((card) => (
            <Card key={card.id} card={card} size="large" isPlayable={false} />
          ))}
          <Card faceDown={true} size="large" />
        </div>
      </div>

      {/* Placeholder description */}
      <div className="max-w-md text-center text-white/60 mb-10 leading-relaxed">
        Muushig is a Mongolian trick-taking card game. Rules, logic, and
        multiplayer support will be implemented in a future release. Check back
        soon!
      </div>

      {/* Back button */}
      <button
        onClick={() => navigate("/")}
        className="bg-white/20 hover:bg-white/30 text-white font-bold px-8 py-3 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 border border-white/30"
      >
        ← Back to Menu
      </button>
    </div>
  );
};

export default GameMuushig;
