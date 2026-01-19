// GAME THIRTEEN - Multiplayer Version

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { socket } from '../utils/socket';
import PlayerHand from '../components/PlayerHand';
import OpponentSection from '../components/OpponentSection';
import PlayArea from '../components/PlayArea';
import GameControls from '../components/GameControls';
import ScoreBoard from '../components/ScoreBoard';
import GameChat from '../components/GameChat';
import { initializeGame, getCardDisplay } from '../utils/deckUtils';

// --- FIXED IMPORTS ---
import { 
  createGameState, 
  playCards, 
  passAction
} from '../utils/gameLogic';
import { validatePlay } from '../utils/handEvaluator'; // FIXED: Imported from correct file
import { COMBO_NAMES } from '../utils/constants';

// --- SAFE SOUND IMPORT ---
// We define a fallback object in case the file doesn't exist or fails to load
let soundManager = {
  init: () => {},
  playSnap: () => {},
  playDeal: () => {},
  playVictory: () => {},
  playTurnAlert: () => {},
  playClick: () => {},
  toggleMute: () => false,
  setMasterVolume: () => {},
  setSFXVolume: () => {}
};

// Try to load the real sound manager
try {
  const sm = require('../utils/SoundManager').soundManager;
  if (sm) soundManager = sm;
} catch (e) {
  // If SoundManager file is missing, we use the silent fallback above
  console.warn("SoundManager not found, running in silent mode.");
}

const GameThirteen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Safe destructuring with defaults
  const { lobbyId, isHost, playerName } = location.state || {};

  const [gameState, setGameState] = useState(null);
  const [selectedCards, setSelectedCards] = useState([]);
  const [messages, setMessages] = useState([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volumes, setVolumes] = useState({ master: 50, sfx: 50 });

  const lastHistoryLengthRef = useRef(0);
  
  // --- MULTIPLAYER SETUP ---

  useEffect(() => {
    if (!lobbyId) {
      // If user refreshed the page, they lost the lobby state. Redirect to menu.
      navigate('/'); 
      return;
    }

    // Initialize Audio
    soundManager.init();

    // 1. HOST: Initialize Game if needed
    if (isHost && !gameState) {
      const { hands } = initializeGame();
      const initialState = createGameState(hands, 0);
      
      // Set Host Name
      if (initialState.players[0]) {
        initialState.players[0].name = playerName || 'Host';
        initialState.players[0].type = 'HUMAN';
      }
      
      socket.emit('send_initial_state', { lobbyId, gameState: initialState });
    }

    // 2. LISTENERS
    const handleStateUpdate = (newState) => {
      console.log("Received Game State Update"); 
      setGameState(newState);
      
      // Turn Alert
      const myIdx = getMyPlayerIndex(newState, isHost);
      if (newState.currentPlayerIndex === myIdx) {
        setStatusMessage("Your Turn!");
        soundManager.playTurnAlert();
      }
    };

    const handleMoveRequest = ({ action, data }) => {
      if (isHost) handleRemoteAction(action, data);
    };

    socket.on('game_state_update', handleStateUpdate);
    socket.on('client_move_request', handleMoveRequest);

    return () => {
      socket.off('game_state_update', handleStateUpdate);
      socket.off('client_move_request', handleMoveRequest);
    };
  }, [lobbyId, isHost]);

  // --- HOST LOGIC ---
  const gameStateRef = useRef(gameState);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  const handleRemoteAction = (action, data) => {
    const currentState = gameStateRef.current;
    if (!currentState) return;

    // Verify it's their turn
    if (currentState.currentPlayerIndex !== data.playerIndex) return;

    let result = null;
    if (action === 'play') {
      const playResult = playCards(currentState, data.cards);
      if (playResult.success) result = playResult.newState;
    } else if (action === 'pass') {
      result = passAction(currentState);
    }

    if (result) {
      socket.emit('sync_game_state', { lobbyId, gameState: result });
    }
  };

  // --- PLAYER IDENTIFICATION ---
  const getMyPlayerIndex = (state, amIHost) => {
    if (amIHost) return 0;
    // For MVP: Client is always Player 1. 
    return 1; 
  };

  // --- ACTIONS ---
  const handlePlay = () => {
    const myIndex = getMyPlayerIndex(gameState, isHost);
    
    // Validate
    const validation = validatePlay(selectedCards, gameState.currentPlay);
    if (!validation.valid) {
      setErrorMessage(validation.reason);
      soundManager.playError?.(); // Use optional chaining just in case
      return;
    }

    if (isHost) {
      const result = playCards(gameState, selectedCards);
      if (result.success) {
        setSelectedCards([]);
        socket.emit('sync_game_state', { lobbyId, gameState: result.newState });
      }
    } else {
      socket.emit('request_move', { 
        lobbyId, 
        action: 'play', 
        data: { cards: selectedCards, playerIndex: myIndex } 
      });
      setSelectedCards([]); // Optimistic clear
    }
  };

  const handlePass = () => {
    const myIndex = getMyPlayerIndex(gameState, isHost);
    if (isHost) {
      const newState = passAction(gameState);
      socket.emit('sync_game_state', { lobbyId, gameState: newState });
    } else {
      socket.emit('request_move', { 
        lobbyId, 
        action: 'pass', 
        data: { playerIndex: myIndex } 
      });
    }
  };

  // --- SETTINGS HANDLERS ---
  const handleToggleMute = () => {
    const muted = soundManager.toggleMute();
    setIsMuted(muted);
  };

  const handleVolumeChange = (type, value) => {
    const newVal = parseInt(value);
    setVolumes(prev => ({ ...prev, [type]: newVal }));
    if (type === 'master') soundManager.setMasterVolume(newVal / 100);
    if (type === 'sfx') soundManager.setSFXVolume(newVal / 100);
  };

  // --- LOGIC FOR SYNCING LOGS/SFX ---
  useEffect(() => {
    if (!gameState) return;
    const history = gameState.moveHistory;
    if (history.length > lastHistoryLengthRef.current) {
      const newMoves = history.slice(lastHistoryLengthRef.current);
      newMoves.forEach((move, index) => {
        setTimeout(() => {
          if (move.type === 'PLAY') soundManager.playSnap();
          if (move.type === 'NEW_ROUND') soundManager.playDeal();
          
          // Generate Log Text
          const id = `sys-${Date.now()}-${index}`;
          const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          let text = '';
          const pName = gameState.players[move.playerIndex]?.name || 'System';
          
          if (move.type === 'PLAY') {
             const comboName = COMBO_NAMES[move.combination.type] || 'cards';
             const cardsDisplay = move.cards.map(c => getCardDisplay(c)).join(' ');
             text = `${pName} played ${comboName} (${cardsDisplay})`;
          } else if (move.type === 'PASS') {
             text = `${pName} passed`;
          }
          if(text) setMessages(prev => [...prev, { id, type: 'SYSTEM', text, timestamp }]);

        }, index * 100);
      });
      lastHistoryLengthRef.current = history.length;
    }
  }, [gameState?.moveHistory]);


  // --- RENDER ---
  if (!gameState) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Connecting to Game...</h2>
          <p className="text-gray-400">Waiting for Host to start...</p>
          <button onClick={() => navigate('/')} className="mt-4 text-blue-400 hover:underline">Return to Menu</button>
        </div>
      </div>
    );
  }

  const myIndex = getMyPlayerIndex(gameState, isHost);
  
  // SAFE ROTATION
  const playersList = gameState.players || [];
  if (playersList.length < 4) return <div>Error: Invalid Player Count</div>;

  const rotatedPlayers = [
    ...playersList.slice(myIndex),
    ...playersList.slice(0, myIndex)
  ];
  
  const bottomPlayer = rotatedPlayers[0]; 
  const leftPlayer = rotatedPlayers[1];
  const topPlayer = rotatedPlayers[2];
  const rightPlayer = rotatedPlayers[3];

  const isMyTurn = gameState.currentPlayerIndex === myIndex;
  const canPlay = selectedCards.length > 0 && isMyTurn;
  const canPass = isMyTurn && gameState.currentPlay !== null;
  const currentPlayerName = gameState.lastPlayedBy !== null ? playersList[gameState.lastPlayedBy].name : null;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-green-800 to-green-900 overflow-hidden">
      <div className="h-full flex flex-col">
        {/* HEADER */}
        <div className="flex items-center justify-between p-2 bg-black/20 shrink-0 relative z-20">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-lg transition-colors"
            >
              ⚙️
            </button>
            <div className="text-white font-bold px-2">Lobby: {lobbyId}</div>
            <button onClick={() => navigate('/')} className="bg-white/20 text-white px-3 py-1 rounded text-xs">Exit</button>
          </div>
          <h1 className="text-xl font-bold text-white">Game "13" {isHost ? '(HOST)' : '(PLAYER 2)'}</h1>
          <div className="w-20"></div> 

          {/* SETTINGS MODAL */}
          {showSettings && (
            <div className="absolute top-14 left-2 bg-gray-800 border-2 border-gray-600 text-white p-4 rounded-xl shadow-2xl w-64 animate-fade-in z-50">
              <div className="flex justify-between items-center mb-4 border-b border-gray-600 pb-2">
                <h3 className="font-bold">Settings</h3>
                <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-white">✕</button>
              </div>
              <div className="mb-4">
                <div className="flex justify-between mb-1">
                  <label className="text-xs text-gray-400 font-bold">Master Volume</label>
                  <span className="text-xs text-blue-400">{volumes.master}%</span>
                </div>
                <input 
                  type="range" min="0" max="100" value={volumes.master} 
                  onChange={(e) => handleVolumeChange('master', e.target.value)}
                  className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
              <div className="mb-4">
                <div className="flex justify-between mb-1">
                  <label className="text-xs text-gray-400 font-bold">Sound Effects</label>
                  <span className="text-xs text-blue-400">{volumes.sfx}%</span>
                </div>
                <input 
                  type="range" min="0" max="100" value={volumes.sfx} 
                  onChange={(e) => handleVolumeChange('sfx', e.target.value)}
                  className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
              <button 
                onClick={handleToggleMute}
                className={`w-full py-2 rounded font-bold text-sm transition-colors ${isMuted ? 'bg-red-500 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}
              >
                {isMuted ? 'Unmute All' : 'Mute All'}
              </button>
            </div>
          )}
        </div>

        {/* GAME AREA */}
        <div className="flex-1 flex min-h-0">
          <div className="flex-1 flex flex-col p-3 min-w-0">
            {/* Top Opponent */}
            <div className="flex justify-center mb-2 shrink-0">
              <OpponentSection player={topPlayer} isActive={gameState.currentPlayerIndex === topPlayer.id} hasPassed={topPlayer.hasPassed} />
            </div>

            {/* Middle Row */}
            <div className="flex items-stretch gap-3 flex-1 min-h-0">
              <div className="flex items-center shrink-0">
                <OpponentSection player={leftPlayer} isActive={gameState.currentPlayerIndex === leftPlayer.id} hasPassed={leftPlayer.hasPassed} />
              </div>
              <div className="flex-1 min-h-0">
                <PlayArea currentPlay={gameState.currentPlay} lastPlayerName={currentPlayerName} roundNumber={gameState.roundNumber} />
              </div>
              <div className="flex items-center shrink-0">
                <OpponentSection player={rightPlayer} isActive={gameState.currentPlayerIndex === rightPlayer.id} hasPassed={rightPlayer.hasPassed} />
              </div>
            </div>

            {/* My Hand */}
            <div className="mt-2 shrink-0">
              <PlayerHand
                hand={bottomPlayer.hand}
                selectedCards={selectedCards}
                onSelectionChange={(cards) => { setSelectedCards(cards); soundManager.playClick(); }}
                isActive={isMyTurn && !bottomPlayer.isEliminated}
                showCardCount={true}
              />
            </div>
            <div className="mt-1 shrink-0">
              <GameControls
                onPlay={handlePlay}
                onPass={handlePass}
                canPlay={canPlay}
                canPass={canPass}
                isPlayerTurn={isMyTurn && !bottomPlayer.isEliminated}
                selectedCount={selectedCards.length}
                message={isMyTurn ? "Your turn!" : `Waiting for ${playersList[gameState.currentPlayerIndex].name}...`}
                errorMessage={errorMessage}
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-80 flex flex-col border-l border-gray-800 bg-gray-900 shrink-0">
            <div className="flex-1 min-h-0 border-b border-gray-700 overflow-hidden relative">
              <ScoreBoard players={gameState.players} currentPlayerIndex={gameState.currentPlayerIndex} roundNumber={gameState.roundNumber} />
            </div>
            <div className="h-[50%] min-h-[48px] overflow-hidden flex flex-col">
              <GameChat messages={messages} onSendMessage={() => {}} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameThirteen;
