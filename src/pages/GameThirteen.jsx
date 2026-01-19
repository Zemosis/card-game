// GAME THIRTEEN - Main Game Page

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import PlayerHand from '../components/PlayerHand';
import OpponentSection from '../components/OpponentSection';
import PlayArea from '../components/PlayArea';
import GameControls from '../components/GameControls';
import ScoreBoard from '../components/ScoreBoard';
import GameChat from '../components/GameChat';
import { initializeGame, getCardDisplay } from '../utils/deckUtils';
import { soundManager } from '../utils/SoundManager'; // IMPORT SOUND MANAGER
import { 
  createGameState, 
  playCards, 
  passAction, 
  isHumanTurn,
  startNextRound,
  getWinner,
  getActivePlayers
} from '../utils/gameLogic';
import { makeAIDecision } from '../utils/aiPlayer';
import { validatePlay } from '../utils/handEvaluator';
import { GAME_SETTINGS, GAME_STATES, COMBO_NAMES } from '../utils/constants';

const GameThirteen = () => {
  const navigate = useNavigate();
  
  // Game State
  const [gameState, setGameState] = useState(null);
  const [selectedCards, setSelectedCards] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [showGameOver, setShowGameOver] = useState(false);
  
  // UI State
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [isMuted, setIsMuted] = useState(false); // Mute state
  
  // Chat & Log State
  const [messages, setMessages] = useState([]);
  const lastHistoryLengthRef = useRef(0);

  // Initialize game on mount
  useEffect(() => {
    startNewGame();
  }, []);

  // Sync Game Log & SFX with Move History
  useEffect(() => {
    if (!gameState) return;

    const history = gameState.moveHistory;
    // Only process new moves
    if (history.length > lastHistoryLengthRef.current) {
      const newMoves = history.slice(lastHistoryLengthRef.current);
      
      newMoves.forEach((move, index) => {
        // --- SOUND EFFECTS TRIGGER ---
        // We put this in a slight timeout to ensure audio context is ready/unblocked
        setTimeout(() => {
          switch(move.type) {
            case 'PLAY':
              soundManager.playSnap();
              break;
            case 'NEW_ROUND':
              soundManager.playDeal();
              break;
            case 'ROUND_END':
              if (move.winnerIndex === 0) {
                soundManager.playVictory();
              }
              break;
            default:
              break;
          }
        }, index * 100);

        // --- LOG MESSAGE GENERATION (Existing Logic) ---
        const id = `sys-${Date.now()}-${index}`;
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        let text = '';
        const player = gameState.players[move.playerIndex];
        const playerName = player ? player.name : 'System';

        switch (move.type) {
          case 'PLAY':
            const comboName = COMBO_NAMES[move.combination.type] || 'cards';
            const cardsDisplay = move.cards.map(c => getCardDisplay(c)).join(' ');
            text = `${playerName} played ${comboName} (${cardsDisplay})`;
            break;
          case 'PASS':
            text = `${playerName} passed`;
            break;
          case 'ROUND_RESET':
             const leader = gameState.players[move.leadPlayer];
            text = `--- Round Cleared. ${leader.name} leads ---`;
            break;
          case 'NEW_ROUND':
            text = `=== Started Round ${move.roundNumber} ===`;
            break;
          case 'ROUND_END':
            const winner = gameState.players[move.winnerIndex];
            text = `🏆 ${winner.name} won the round!`;
            break;
          default:
             // Skip unknown types
             return;
        }

        if (text) {
          setMessages(prev => [...prev, { id, type: 'SYSTEM', text, timestamp }]);
        }
      });

      lastHistoryLengthRef.current = history.length;
    }
  }, [gameState?.moveHistory]);

  // Turn Alert Sound
  useEffect(() => {
    if (gameState && isHumanTurn(gameState)) {
      soundManager.playTurnAlert();
    }
  }, [gameState?.currentPlayerIndex]);

  // Start a new game
  const startNewGame = () => {
    // Initialize Audio Context on user interaction
    soundManager.init(); 

    const { hands } = initializeGame();
    const initialState = createGameState(hands, 0);
    setGameState(initialState);
    setSelectedCards([]);
    setErrorMessage('');
    setStatusMessage("Your turn! Select cards and play.");
    setShowGameOver(false);
    setMessages([{ 
      id: 'init', 
      type: 'SYSTEM', 
      text: 'Game initialized. Good luck!', 
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
    }]);
    lastHistoryLengthRef.current = 0;
    
    // Play deal sound
    soundManager.playDeal();
  };

  const handleToggleMute = () => {
    const muted = soundManager.toggleMute();
    setIsMuted(muted);
  };

  // Handle sending chat messages
  const handleSendMessage = (text) => {
    soundManager.playChat(); // Sound for sending
    const newMessage = {
      id: `chat-${Date.now()}`,
      type: 'CHAT',
      sender: 'You',
      text,
      isMe: true,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, newMessage]);

    // Optional: Random CPU response
    if (Math.random() > 0.8) {
      setTimeout(() => {
        soundManager.playChat(); // Sound for receiving
        const cpuResponses = [
          "Nice move!", "I'm going to win this.", "Wait, what?", "Good luck!", "..."
        ];
        const randomCpu = Math.floor(Math.random() * 3) + 1; // CPU 1-3
        const cpuMsg = {
          id: `chat-cpu-${Date.now()}`,
          type: 'CHAT',
          sender: `CPU ${randomCpu}`,
          text: cpuResponses[Math.floor(Math.random() * cpuResponses.length)],
          isMe: false,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, cpuMsg]);
      }, 2000);
    }
  };

  // AI Turn Logic (Unchanged)
  useEffect(() => {
    if (!gameState || gameState.gameState === GAME_STATES.GAME_OVER) return;
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer.type === 'AI' && !currentPlayer.isEliminated && gameState.gameState === GAME_STATES.PLAYING) {
      const timer = setTimeout(() => { executeAITurn(); }, GAME_SETTINGS.AI_TURN_DELAY);
      return () => clearTimeout(timer);
    }
  }, [gameState?.currentPlayerIndex, gameState?.gameState]);

  const executeAITurn = () => {
    if (!gameState) return;
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const decision = makeAIDecision(currentPlayer, gameState.currentPlay, gameState);
    if (decision.action === 'play') {
      const result = playCards(gameState, decision.cards);
      if (result.success) {
        setGameState(result.newState);
        if (result.playerWon) handleRoundEnd(result.newState);
      } else {
        const newState = passAction(gameState);
        setGameState(newState);
      }
    } else {
      const newState = passAction(gameState);
      setGameState(newState);
    }
  };

  const handlePlay = () => {
    if (!gameState || selectedCards.length === 0) {
      setErrorMessage('Please select cards to play');
      soundManager.playError();
      return;
    }
    const validation = validatePlay(selectedCards, gameState.currentPlay);
    if (!validation.valid) {
      setErrorMessage(validation.reason);
      soundManager.playError();
      setTimeout(() => setErrorMessage(''), 2000);
      return;
    }
    const result = playCards(gameState, selectedCards);
    if (result.success) {
      setGameState(result.newState);
      setSelectedCards([]);
      setErrorMessage('');
      if (result.playerWon) handleRoundEnd(result.newState);
    } else {
      setErrorMessage(result.error);
      soundManager.playError();
      setTimeout(() => setErrorMessage(''), 2000);
    }
  };

  const handlePass = () => {
    if (!gameState) return;
    const newState = passAction(gameState);
    setGameState(newState);
    setSelectedCards([]);
    setErrorMessage('');
    setStatusMessage('You passed this round');
    setTimeout(() => setStatusMessage(''), 2000);
  };

  const handleRoundEnd = (state) => {
    setTimeout(() => { checkGameOver(state); }, 2000);
  };

  const checkGameOver = (state) => {
    const activePlayers = getActivePlayers(state);
    if (activePlayers.length === 1) {
      setGameState({ ...state, gameState: GAME_STATES.GAME_OVER });
      setShowGameOver(true);
      if (activePlayers[0].id === 0) {
          soundManager.playVictory();
      }
    } else {
      setTimeout(() => {
        const { hands } = initializeGame();
        const nextState = startNextRound(state, hands);
        setGameState(nextState);
        setSelectedCards([]);
        if (isHumanTurn(nextState)) setStatusMessage("Your turn! Select cards and play.");
      }, 1500);
    }
  };

  const handleSelectionChange = (cards) => {
    setSelectedCards(cards);
    soundManager.playClick(); // Click sound on selection
    setErrorMessage('');
  };

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-800 to-green-900 flex items-center justify-center">
        <div className="text-white text-2xl">Loading game...</div>
      </div>
    );
  }

  const humanPlayer = gameState.players[0];
  const isMyTurn = isHumanTurn(gameState);
  const canPlay = selectedCards.length > 0 && isMyTurn;
  const canPass = isMyTurn && gameState.currentPlay !== null;
  const leftOpponent = gameState.players[1];
  const topOpponent = gameState.players[2];
  const rightOpponent = gameState.players[3];
  const currentPlayerName = gameState.lastPlayedBy !== null ? gameState.players[gameState.lastPlayedBy].name : null;
  const winner = getWinner(gameState);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-green-800 to-green-900 overflow-hidden">
      <div className="h-full flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-2 bg-black/20 shrink-0 relative z-20">
          <div className="flex items-center gap-2">
            <button className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-lg transition-colors">⚙️</button>
            
            {/* Info Button */}
            <button 
              onClick={() => setShowInfo(!showInfo)}
              className={`p-2 rounded-lg transition-colors font-bold ${
                showInfo 
                  ? 'bg-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]' 
                  : 'bg-white/20 hover:bg-white/30 text-white'
              }`}
            >
              ℹ️
            </button>

            {/* Mute Button */}
            <button 
              onClick={handleToggleMute}
              className={`p-2 rounded-lg transition-colors font-bold ${
                isMuted 
                  ? 'bg-red-500/20 text-red-300' 
                  : 'bg-white/20 text-white'
              }`}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? '🔇' : '🔊'}
            </button>

            <button onClick={() => navigate('/')} className="bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded-lg font-semibold transition-colors text-xs">← Menu</button>
          </div>
          
          <h1 className="text-xl font-bold text-white">Game "13"</h1>
          
          <button onClick={startNewGame} className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-lg font-semibold transition-colors text-xs">New Game</button>

          {/* Info Modal */}
          {showInfo && (
            <div className="absolute top-14 left-14 bg-gray-800 border-2 border-gray-600 text-white p-4 rounded-xl shadow-2xl w-80 animate-fade-in z-50">
              <div className="flex justify-between items-center mb-3 border-b border-gray-600 pb-2">
                <h3 className="font-bold">Game Rules</h3>
                <button onClick={() => setShowInfo(false)} className="text-gray-400 hover:text-white">✕</button>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-xl">🎯</span>
                  <p>First to <span className="text-green-400 font-bold">empty hand</span> wins the round.</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-xl">❌</span>
                  <p>Eliminated at <span className="text-red-400 font-bold">25 points</span>.</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-xl">⚠️</span>
                  <p>Ending with <span className="text-yellow-400 font-bold">10+ cards</span> doubles your penalty points.</p>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-gray-600 text-xs text-gray-400 text-center">
                Click ℹ️ again to close
              </div>
            </div>
          )}
        </div>

        {/* Main Game Area */}
        <div className="flex-1 flex min-h-0">
          
          {/* Left - Game Board */}
          <div className="flex-1 flex flex-col p-3 min-w-0">
            <div className="flex justify-center mb-2 shrink-0">
              <OpponentSection player={topOpponent} isActive={gameState.currentPlayerIndex === 2} hasPassed={topOpponent.hasPassed} />
            </div>

            <div className="flex items-stretch gap-3 flex-1 min-h-0">
              <div className="flex items-center shrink-0">
                <OpponentSection player={leftOpponent} isActive={gameState.currentPlayerIndex === 1} hasPassed={leftOpponent.hasPassed} />
              </div>
              <div className="flex-1 min-h-0">
                <PlayArea currentPlay={gameState.currentPlay} lastPlayerName={currentPlayerName} roundNumber={gameState.roundNumber} />
              </div>
              <div className="flex items-center shrink-0">
                <OpponentSection player={rightOpponent} isActive={gameState.currentPlayerIndex === 3} hasPassed={rightOpponent.hasPassed} />
              </div>
            </div>

            <div className="mt-2 shrink-0">
              <PlayerHand
                hand={humanPlayer.hand}
                selectedCards={selectedCards}
                onSelectionChange={handleSelectionChange}
                isActive={isMyTurn && !humanPlayer.isEliminated}
                showCardCount={true}
              />
            </div>
            <div className="mt-1 shrink-0">
              <GameControls
                onPlay={handlePlay}
                onPass={handlePass}
                canPlay={canPlay}
                canPass={canPass}
                isPlayerTurn={isMyTurn && !humanPlayer.isEliminated}
                selectedCount={selectedCards.length}
                message={isMyTurn ? statusMessage || "Your turn! Select cards and play." : ""}
                errorMessage={errorMessage}
              />
            </div>
          </div>

          {/* Right Sidebar - Dynamic Resizing for Scoreboard & Chat */}
          <div className="w-80 flex flex-col border-l border-gray-800 bg-gray-900 shrink-0 transition-all duration-300">
            
            {/* Scoreboard Area */}
            <div className="flex-1 min-h-0 border-b border-gray-700 overflow-hidden relative">
              <ScoreBoard
                players={gameState.players}
                currentPlayerIndex={gameState.currentPlayerIndex}
                roundNumber={gameState.roundNumber}
              />
            </div>
            
            {/* Chat Area */}
            <div className={`
              ${isChatCollapsed ? 'h-12' : 'h-[50%]'}
              min-h-[48px] transition-[height] duration-300 ease-in-out overflow-hidden flex flex-col
            `}>
              <GameChat 
                messages={messages}
                onSendMessage={handleSendMessage}
                isCollapsed={isChatCollapsed}
                onToggleCollapse={() => setIsChatCollapsed(!isChatCollapsed)}
              />
            </div>
          </div>

        </div>
      </div>

      {/* Game Over Modal */}
      {showGameOver && winner && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md text-center shadow-2xl">
            <div className="text-6xl mb-4">{winner.id === 0 ? '🎉' : '😢'}</div>
            <h2 className="text-3xl font-bold mb-4">{winner.id === 0 ? 'You Win!' : 'Game Over'}</h2>
            <p className="text-gray-600 mb-6">{winner.id === 0 ? 'Congratulations! You are the last player standing!' : `${winner.name} wins! Better luck next time!`}</p>
            <div className="flex gap-3 justify-center">
              <button onClick={startNewGame} className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-bold transition-colors">Play Again</button>
              <button onClick={() => navigate('/')} className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-bold transition-colors">Main Menu</button>
            </div>
          </div>
        </div>
      )}

      {/* Animation for popup */}
      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
};

export default GameThirteen;
