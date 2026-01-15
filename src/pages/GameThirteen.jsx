// GAME THIRTEEN - Main Game Page

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/Card';
import PlayerHand from '../components/PlayerHand';
import OpponentSection from '../components/OpponentSection';
import PlayArea from '../components/PlayArea';
import GameControls from '../components/GameControls';
import ScoreBoard from '../components/ScoreBoard';
import { initializeGame } from '../utils/deckUtils';
import { 
  createGameState, 
  playCards, 
  passAction, 
  isHumanTurn,
  endRound,
  startNextRound,
  getWinner,
  getActivePlayers
} from '../utils/gameLogic';
import { makeAIDecision } from '../utils/aiPlayer';
import { validatePlay } from '../utils/handEvaluator';
import { GAME_SETTINGS, GAME_STATES } from '../utils/constants';

const GameThirteen = () => {
  const navigate = useNavigate();
  
  // Game State
  const [gameState, setGameState] = useState(null);
  const [selectedCards, setSelectedCards] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [showGameOver, setShowGameOver] = useState(false);
  
  // Initialize game on mount
  useEffect(() => {
    startNewGame();
  }, []);

  // Start a new game
  const startNewGame = () => {
    const { hands } = initializeGame();
    const initialState = createGameState(hands, 0);
    setGameState(initialState);
    setSelectedCards([]);
    setErrorMessage('');
    setStatusMessage("Your turn! Select cards and play.");
    setShowGameOver(false);
  };

  // AI Turn Logic
  useEffect(() => {
    if (!gameState || gameState.gameState === GAME_STATES.GAME_OVER) return;
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    
    // If it's AI's turn and game is playing
    if (currentPlayer.type === 'AI' && !currentPlayer.isEliminated && gameState.gameState === GAME_STATES.PLAYING) {
      const timer = setTimeout(() => {
        executeAITurn();
      }, GAME_SETTINGS.AI_TURN_DELAY);
      
      return () => clearTimeout(timer);
    }
  }, [gameState?.currentPlayerIndex, gameState?.gameState]);

  // Execute AI turn
  const executeAITurn = () => {
    if (!gameState) return;
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const decision = makeAIDecision(currentPlayer, gameState.currentPlay, gameState);
    
    if (decision.action === 'play') {
      const result = playCards(gameState, decision.cards);
      if (result.success) {
        setGameState(result.newState);
        
        // Check if round ended
        if (result.playerWon) {
          handleRoundEnd(result.newState);
        }
      } else {
        // AI should pass if can't play
        const newState = passAction(gameState);
        setGameState(newState);
      }
    } else {
      // AI passes
      const newState = passAction(gameState);
      setGameState(newState);
    }
  };

  // Handle human play
  const handlePlay = () => {
    if (!gameState || selectedCards.length === 0) {
      setErrorMessage('Please select cards to play');
      return;
    }

    // Validate play
    const validation = validatePlay(selectedCards, gameState.currentPlay);
    
    if (!validation.valid) {
      setErrorMessage(validation.reason);
      setTimeout(() => setErrorMessage(''), 2000);
      return;
    }

    // Execute play
    const result = playCards(gameState, selectedCards);
    
    if (result.success) {
      setGameState(result.newState);
      setSelectedCards([]);
      setErrorMessage('');
      
      // Check if player won the round
      if (result.playerWon) {
        handleRoundEnd(result.newState);
      }
    } else {
      setErrorMessage(result.error);
      setTimeout(() => setErrorMessage(''), 2000);
    }
  };

  // Handle human pass
  const handlePass = () => {
    if (!gameState) return;
    
    const newState = passAction(gameState);
    setGameState(newState);
    setSelectedCards([]);
    setErrorMessage('');
    setStatusMessage('You passed this round');
    setTimeout(() => setStatusMessage(''), 2000);
  };

  // Handle round end
  const handleRoundEnd = (state) => {
    setTimeout(() => {
      checkGameOver(state);
    }, 2000);
  };

  // Check if game is over
  const checkGameOver = (state) => {
    const activePlayers = getActivePlayers(state);
    
    if (activePlayers.length === 1) {
      setGameState({ ...state, gameState: GAME_STATES.GAME_OVER });
      setShowGameOver(true);
    } else {
      // Start next round
      setTimeout(() => {
        const { hands } = initializeGame();
        const nextState = startNextRound(state, hands);
        setGameState(nextState);
        setSelectedCards([]);
        
        if (isHumanTurn(nextState)) {
          setStatusMessage("Your turn! Select cards and play.");
        }
      }, 1500);
    }
  };

  // Handle selection change
  const handleSelectionChange = (cards) => {
    setSelectedCards(cards);
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

  // Get opponent players (indices 1, 2, 3)
  const leftOpponent = gameState.players[1];
  const topOpponent = gameState.players[2];
  const rightOpponent = gameState.players[3];

  // Get current player name for play area
  const currentPlayerName = gameState.lastPlayedBy !== null 
    ? gameState.players[gameState.lastPlayedBy].name 
    : null;

  const winner = getWinner(gameState);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-800 to-green-900 p-4">
      <div className="max-w-7xl mx-auto h-screen flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate('/')}
            className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
          >
            ← Main Menu
          </button>
          <h1 className="text-3xl font-bold text-white">Game "13"</h1>
          <button
            onClick={startNewGame}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
          >
            New Game
          </button>
        </div>

        {/* Main Game Area */}
        <div className="flex-1 grid grid-cols-12 gap-4">
          
          {/* Left Side - Left Opponent */}
          <div className="col-span-2 flex items-center">
            <OpponentSection
              player={leftOpponent}
              position="left"
              isActive={gameState.currentPlayerIndex === 1}
              hasPassed={leftOpponent.hasPassed}
            />
          </div>

          {/* Center Area */}
          <div className="col-span-8 flex flex-col">
            
            {/* Top Opponent */}
            <div className="flex justify-center mb-4">
              <OpponentSection
                player={topOpponent}
                position="top"
                isActive={gameState.currentPlayerIndex === 2}
                hasPassed={topOpponent.hasPassed}
              />
            </div>

            {/* Play Area */}
            <div className="flex-1">
              <PlayArea
                currentPlay={gameState.currentPlay}
                lastPlayerName={currentPlayerName}
                roundNumber={gameState.roundNumber}
              />
            </div>

            {/* Player Hand */}
            <div className="mt-4">
              <PlayerHand
                hand={humanPlayer.hand}
                selectedCards={selectedCards}
                onSelectionChange={handleSelectionChange}
                isActive={isMyTurn && !humanPlayer.isEliminated}
                showCardCount={true}
              />
            </div>

            {/* Game Controls */}
            <div className="mt-4">
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

          {/* Right Side - Right Opponent + Scoreboard */}
          <div className="col-span-2 flex flex-col gap-4">
            <OpponentSection
              player={rightOpponent}
              position="right"
              isActive={gameState.currentPlayerIndex === 3}
              hasPassed={rightOpponent.hasPassed}
            />
            <ScoreBoard
              players={gameState.players}
              currentPlayerIndex={gameState.currentPlayerIndex}
              roundNumber={gameState.roundNumber}
            />
          </div>
        </div>
      </div>

      {/* Game Over Modal */}
      {showGameOver && winner && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md text-center shadow-2xl">
            <div className="text-6xl mb-4">
              {winner.id === 0 ? '🎉' : '😔'}
            </div>
            <h2 className="text-3xl font-bold mb-4">
              {winner.id === 0 ? 'You Win!' : 'Game Over'}
            </h2>
            <p className="text-gray-600 mb-6">
              {winner.id === 0 
                ? 'Congratulations! You are the last player standing!' 
                : `${winner.name} wins! Better luck next time!`}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={startNewGame}
                className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-bold transition-colors"
              >
                Play Again
              </button>
              <button
                onClick={() => navigate('/')}
                className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-bold transition-colors"
              >
                Main Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameThirteen;
