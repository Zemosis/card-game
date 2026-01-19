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
import { getCardDisplay } from '../utils/deckUtils';

// IMPORTS
import { 
  createGameState, 
  playCards, 
  passAction
} from '../utils/gameLogic';
import { validatePlay } from '../utils/handEvaluator';
import { COMBO_NAMES, GAME_STATES } from '../utils/constants';
import { makeAIDecision } from '../utils/aiPlayer';

// SAFE AUDIO IMPORT
import { soundManager } from '../utils/SoundManager'; 

const GameThirteen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const { lobbyId, isHost, playerName, mySocketId } = location.state || {};

  const [gameState, setGameState] = useState(null);
  const [selectedCards, setSelectedCards] = useState([]);
  const [messages, setMessages] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  
  // UI State
  const [showSettings, setShowSettings] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false); // RESTORED
  
  // Volume State
  const [volumes, setVolumes] = useState({ master: 50, sfx: 50 });

  const lastHistoryLengthRef = useRef(0);
  const gameStateRef = useRef(gameState);
  
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  // --- SAFE AUDIO HELPERS ---
  const safePlay = (method) => {
    try {
      if (soundManager.context && soundManager.context.state === 'suspended') {
        soundManager.context.resume();
      }
      if (soundManager && typeof soundManager[method] === 'function') {
        soundManager[method]();
      }
    } catch (e) { console.warn("Audio error:", e); }
  };

  // --- MULTIPLAYER SETUP ---
  useEffect(() => {
    if (!lobbyId) {
      navigate('/'); 
      return;
    }

    if (soundManager && soundManager.init) soundManager.init();

    // 1. HOST INIT
    if (isHost && !gameState) {
      import('../utils/deckUtils').then(({ initializeGame }) => {
          const { hands } = initializeGame();
          const initialState = createGameState(hands, 0);
          
          if (initialState.players[0]) {
            initialState.players[0].name = playerName || 'Host';
            initialState.players[0].type = 'HUMAN';
            initialState.players[0].socketId = mySocketId;
          }
          
          setGameState(initialState);
          socket.emit('send_initial_state', { lobbyId, gameState: initialState });
      });
    }

    // 2. LISTENERS
    const handleStateUpdate = (newState) => {
      setGameState(newState);
      const myIdx = getMyPlayerIndex(newState, mySocketId);
      if (newState.currentPlayerIndex === myIdx) {
        safePlay('playTurnAlert');
      }
    };

    const handleReceiveChat = (msg) => {
      const isMe = msg.sender === (playerName || 'Host');
      const formattedMsg = { ...msg, isMe };
      setMessages(prev => [...prev, formattedMsg]);
      if (!isMe) safePlay('playClick');
    };

    const handlePlayerJoined = ({ newPlayer }) => {
      if (isHost) {
        const current = gameStateRef.current;
        if (!current) return;

        const updatedPlayers = [...current.players];
        const slotIndex = updatedPlayers.findIndex((p, idx) => idx > 0 && p.type === 'AI');
        
        if (slotIndex !== -1) {
          updatedPlayers[slotIndex] = {
            ...updatedPlayers[slotIndex],
            name: newPlayer.name,
            type: 'HUMAN',
            socketId: newPlayer.id
          };

          const newState = { ...current, players: updatedPlayers };
          setGameState(newState);
          socket.emit('sync_game_state', { lobbyId, gameState: newState });
        }
      }
    };

    const handlePlayerLeft = ({ leaverId }) => {
      if (isHost) {
        const current = gameStateRef.current;
        if (!current) return;
        
        const updatedPlayers = current.players.map(p => {
          if (p.socketId === leaverId) {
            return { ...p, name: `CPU ${p.id}`, type: 'AI', socketId: null };
          }
          return p;
        });

        const newState = { ...current, players: updatedPlayers };
        setGameState(newState);
        socket.emit('sync_game_state', { lobbyId, gameState: newState });
      }
    };

    const handleClientMove = ({ action, data, senderId }) => {
      if (isHost) handleRemoteAction(action, data, senderId);
    };

    const handleRequestSync = () => {
      if (isHost && gameStateRef.current) {
         socket.emit('sync_game_state', { lobbyId, gameState: gameStateRef.current });
      }
    };

    socket.on('game_state_update', handleStateUpdate);
    socket.on('receive_chat', handleReceiveChat);
    socket.on('player_joined', handlePlayerJoined);
    socket.on('player_left', handlePlayerLeft);
    socket.on('client_move_request', handleClientMove);
    socket.on('request_sync', handleRequestSync);

    return () => {
      socket.off('game_state_update', handleStateUpdate);
      socket.off('receive_chat', handleReceiveChat);
      socket.off('player_joined', handlePlayerJoined);
      socket.off('player_left', handlePlayerLeft);
      socket.off('client_move_request', handleClientMove);
      socket.off('request_sync', handleRequestSync);
    };
  }, [lobbyId, isHost, mySocketId]);

  // --- HOST LOGIC ---
  const handleRemoteAction = (action, data, senderId) => {
    const currentState = gameStateRef.current;
    if (!currentState) return;

    const player = currentState.players[data.playerIndex];
    if (player.socketId !== senderId) {
       // console.warn("ID Mismatch ignored for MVP resilience");
    }

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

  // --- AI LOGIC (HOST ONLY) ---
  useEffect(() => {
    if (!isHost || !gameState || gameState.gameState === GAME_STATES.GAME_OVER) return;

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    
    if (currentPlayer.type === 'AI' && !currentPlayer.isEliminated) {
      const timer = setTimeout(() => {
        const decision = makeAIDecision(currentPlayer, gameState.currentPlay, gameState);
        let result = null;

        if (decision.action === 'play') {
          const playResult = playCards(gameState, decision.cards);
          if (playResult.success) result = playResult.newState;
          else result = passAction(gameState);
        } else {
          result = passAction(gameState);
        }

        if (result) {
          setGameState(result);
          socket.emit('sync_game_state', { lobbyId, gameState: result });
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [gameState, isHost]);

  // --- HELPER: FIND MY INDEX ---
  const getMyPlayerIndex = (state, socketId) => {
    if (!state) return -1;
    const idx = state.players.findIndex(p => p.socketId === socketId);
    return idx !== -1 ? idx : -1;
  };

  // --- ACTIONS ---
  const handlePlay = () => {
    if (soundManager.context && soundManager.context.state === 'suspended') {
      soundManager.context.resume();
    }

    const myIndex = getMyPlayerIndex(gameState, mySocketId);
    if (myIndex === -1) { setErrorMessage("You are spectating"); return; }
    
    const validation = validatePlay(selectedCards, gameState.currentPlay);
    if (!validation.valid) {
      setErrorMessage(validation.reason);
      safePlay('playError');
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
      setSelectedCards([]);
    }
  };

  const handlePass = () => {
    const myIndex = getMyPlayerIndex(gameState, mySocketId);
    if (myIndex === -1) return;

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

  const handleSendMessage = (text) => {
    if (!text.trim()) return;
    socket.emit('send_chat', { 
      lobbyId, 
      message: text, 
      playerName: playerName || (isHost ? 'Host' : 'Guest') 
    });
  };

  // --- SETTINGS HANDLERS ---
  const handleToggleMute = () => {
    if (soundManager) {
      const muted = soundManager.toggleMute();
      setIsMuted(muted);
    }
  };

  const handleVolumeChange = (type, value) => {
    if (!soundManager) return;
    const newVal = parseInt(value);
    setVolumes(prev => ({ ...prev, [type]: newVal }));
    if (type === 'master') soundManager.setMasterVolume(newVal / 100);
    if (type === 'sfx') soundManager.setSFXVolume(newVal / 100);
    if (!isMuted) soundManager.playClick();
  };

  // --- LOGS & SFX ---
  useEffect(() => {
    if (!gameState) return;
    const history = gameState.moveHistory;
    if (history.length > lastHistoryLengthRef.current) {
      const newMoves = history.slice(lastHistoryLengthRef.current);
      newMoves.forEach((move, index) => {
        setTimeout(() => {
          if (move.type === 'PLAY') safePlay('playSnap');
          if (move.type === 'NEW_ROUND') safePlay('playDeal');
          
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
  if (!gameState) return <div className="text-white flex justify-center items-center h-screen">Loading Game...</div>;

  const myIndex = getMyPlayerIndex(gameState, mySocketId);
  const iAmSpectator = myIndex === -1;
  const viewIndex = iAmSpectator ? 0 : myIndex;

  const playersList = gameState.players || [];
  if (playersList.length < 4) return <div>Error: Invalid Player Count</div>;

  const rotatedPlayers = [
    ...playersList.slice(viewIndex),
    ...playersList.slice(0, viewIndex)
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
          <h1 className="text-xl font-bold text-white">Game "13" {iAmSpectator ? '(SPECTATOR)' : (isHost ? '(HOST)' : '(CLIENT)')}</h1>
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
                onSelectionChange={(cards) => { setSelectedCards(cards); safePlay('playClick'); }}
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
          <div className="w-80 flex flex-col border-l border-gray-800 bg-gray-900 shrink-0 transition-all duration-300">
            <div className="flex-1 min-h-0 border-b border-gray-700 overflow-hidden relative">
              <ScoreBoard players={gameState.players} currentPlayerIndex={gameState.currentPlayerIndex} roundNumber={gameState.roundNumber} />
            </div>
            
            {/* RESTORED FOLDABLE CHAT CONTAINER */}
            <div className={`
              ${isChatCollapsed ? 'h-12' : 'h-[50%]'}
              min-h-[48px] transition-[height] duration-300 ease-in-out overflow-hidden flex flex-col
            `}>
              <GameChat 
                messages={messages} 
                onSendMessage={handleSendMessage}
                isCollapsed={isChatCollapsed} // PASSED PROP
                onToggleCollapse={() => setIsChatCollapsed(!isChatCollapsed)} // PASSED PROP
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameThirteen;
