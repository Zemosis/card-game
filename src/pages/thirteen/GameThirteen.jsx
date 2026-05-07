// GAME THIRTEEN - Multiplayer Version with Pixel Retro UI

import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { socket } from "../../utils/socket";
import PlayerHand from "../../components/thirteen/PlayerHand";
import OpponentSection from "../../components/thirteen/OpponentSection";
import PlayArea from "../../components/thirteen/PlayArea";
import GameControls from "../../components/thirteen/GameControls";
import ScoreBoard from "../../components/thirteen/ScoreBoard";
import GameChat from "../../components/thirteen/GameChat";
import { getCardDisplay } from "../../utils/deckUtils";

import { createGameState, playCards, passAction } from "../../utils/gameLogic";
import { validatePlay } from "../../utils/handEvaluator";
import { COMBO_NAMES, GAME_STATES } from "../../utils/constants";
import { makeAIDecision } from "../../utils/aiPlayer";

import { soundManager } from "../../utils/SoundManager";

const GameThirteen = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    lobbyId,
    isHost,
    playerName,
    mySocketId,
    myPlayerIndex: fixedPlayerIndex,
  } = location.state || {};

  const [gameState, setGameState] = useState(null);
  const [selectedCards, setSelectedCards] = useState([]);
  const [messages, setMessages] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");

  const [showSettings, setShowSettings] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);

  const [volumes, setVolumes] = useState({ master: 50, sfx: 50 });

  const lastHistoryLengthRef = useRef(0);
  const gameStateRef = useRef(gameState);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const safePlay = (method) => {
    try {
      if (soundManager.context && soundManager.context.state === "suspended") {
        soundManager.context.resume();
      }
      if (soundManager && typeof soundManager[method] === "function") {
        soundManager[method]();
      }
    } catch (e) {}
  };

  const isSoloGame = lobbyId?.startsWith("SOLO-");

  // --- MULTIPLAYER SETUP ---
  useEffect(() => {
    if (!lobbyId) {
      navigate("/");
      return;
    }

    if (soundManager && soundManager.init) soundManager.init();

    const initLocalGame = () => {
      import("../../utils/deckUtils").then(({ initializeGame }) => {
        const { hands } = initializeGame();
        const initialState = createGameState(hands, 0);

        if (initialState.players[0]) {
          initialState.players[0].name = playerName || "Host";
          initialState.players[0].type = "HUMAN";
          initialState.players[0].socketId = mySocketId;
        }

        setGameState(initialState);

        if (!isSoloGame) {
          socket.emit("send_initial_state", { lobbyId, gameState: initialState });
        }
      });
    };

    if (isHost && !gameState) {
      if (isSoloGame) {
        initLocalGame();
      } else if (socket.connected) {
        socket.emit("join_lobby", { lobbyId, playerName });
        socket.emit("check_game_status", { lobbyId });
      } else {
        initLocalGame();
      }
    } else if (!isHost && !isSoloGame && !gameState) {
      socket.emit("join_lobby", { lobbyId, playerName });
    }

    const handleGameNotStarted = () => {
      if (isHost) initLocalGame();
    };

    const handleStateUpdate = (newState) => {
      setGameState(newState);
      const myIdx = getMyPlayerIndex(newState, mySocketId);
      if (newState.currentPlayerIndex === myIdx) {
        safePlay("playTurnAlert");
      }
    };

    const handleReceiveChat = (msg) => {
      const isMe = msg.sender === (playerName || "Host");
      const formattedMsg = { ...msg, isMe };
      setMessages((prev) => [...prev, formattedMsg]);
      if (!isMe) safePlay("playClick");
    };

    const handlePlayerJoined = ({ newPlayer }) => {
      if (isHost) {
        const current = gameStateRef.current;
        if (!current) return;

        const updatedPlayers = [...current.players];
        const slotIndex = updatedPlayers.findIndex(
          (p, idx) => idx > 0 && p.type === "AI",
        );

        if (slotIndex !== -1) {
          updatedPlayers[slotIndex] = {
            ...updatedPlayers[slotIndex],
            name: newPlayer.name,
            type: "HUMAN",
            socketId: newPlayer.id,
          };
          const newState = { ...current, players: updatedPlayers };
          setGameState(newState);
          socket.emit("sync_game_state", { lobbyId, gameState: newState });
        }
      }
    };

    const handlePlayerRejoined = ({ name, newSocketId }) => {
      if (isHost) {
        const current = gameStateRef.current;
        if (!current) return;

        const updatedPlayers = current.players.map((p) => {
          if (p.name === name) {
            return { ...p, socketId: newSocketId };
          }
          return p;
        });

        const newState = { ...current, players: updatedPlayers };
        setGameState(newState);
        socket.emit("sync_game_state", { lobbyId, gameState: newState });
      }
    };

    const handleClientMove = ({ action, data, senderId }) => {
      if (isHost) handleRemoteAction(action, data, senderId);
    };

    socket.on("game_not_started", handleGameNotStarted);
    socket.on("game_state_update", handleStateUpdate);
    socket.on("receive_chat", handleReceiveChat);
    socket.on("player_joined", handlePlayerJoined);
    socket.on("player_rejoined", handlePlayerRejoined);
    socket.on("client_move_request", handleClientMove);

    return () => {
      socket.off("game_not_started", handleGameNotStarted);
      socket.off("game_state_update", handleStateUpdate);
      socket.off("receive_chat", handleReceiveChat);
      socket.off("player_joined", handlePlayerJoined);
      socket.off("player_rejoined", handlePlayerRejoined);
      socket.off("client_move_request", handleClientMove);
    };
  }, [lobbyId, isHost, mySocketId]);

  // --- HOST LOGIC ---
  const handleRemoteAction = (action, data, senderId) => {
    const currentState = gameStateRef.current;
    if (!currentState) return;

    const player = currentState.players[data.playerIndex];
    if (player.socketId !== senderId) {
      console.log("ID Mismatch, proceeding if name matches (recovery mode)");
    }

    if (currentState.currentPlayerIndex !== data.playerIndex) return;

    let result = null;
    if (action === "play") {
      const playResult = playCards(currentState, data.cards);
      if (playResult.success) result = playResult.newState;
    } else if (action === "pass") {
      result = passAction(currentState);
    }

    if (result) {
      socket.emit("sync_game_state", { lobbyId, gameState: result });
    }
  };

  // --- AI LOGIC (HOST ONLY) ---
  useEffect(() => {
    if (!isHost || !gameState || gameState.gameState === GAME_STATES.GAME_OVER)
      return;

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];

    if (currentPlayer.type === "AI" && !currentPlayer.isEliminated) {
      const timer = setTimeout(() => {
        const decision = makeAIDecision(
          currentPlayer,
          gameState.currentPlay,
          gameState,
        );
        let result = null;

        if (decision.action === "play") {
          const playResult = playCards(gameState, decision.cards);
          if (playResult.success) result = playResult.newState;
          else result = passAction(gameState);
        } else {
          result = passAction(gameState);
        }

        if (result) {
          setGameState(result);
          if (!isSoloGame) {
            socket.emit("sync_game_state", { lobbyId, gameState: result });
          }
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [gameState, isHost]);

  // --- HELPER: FIND MY INDEX ---
  const getMyPlayerIndex = (state, socketId) => {
    if (fixedPlayerIndex !== undefined && fixedPlayerIndex >= 0) {
      return fixedPlayerIndex;
    }
    if (!state) return -1;
    let idx = state.players.findIndex((p) => p.socketId === socketId);
    if (idx === -1 && playerName) {
      idx = state.players.findIndex((p) => p.name === playerName);
    }
    return idx !== -1 ? idx : -1;
  };

  // --- ACTIONS ---
  const handlePlay = () => {
    if (soundManager.context && soundManager.context.state === "suspended") {
      soundManager.context.resume();
    }

    const myIndex = getMyPlayerIndex(gameState, mySocketId);
    if (myIndex === -1) {
      setErrorMessage("You are spectating");
      return;
    }

    const validation = validatePlay(selectedCards, gameState.currentPlay);
    if (!validation.valid) {
      setErrorMessage(validation.reason);
      safePlay("playError");
      return;
    }

    if (isHost) {
      const result = playCards(gameState, selectedCards);
      if (result.success) {
        setSelectedCards([]);
        if (!isSoloGame) {
          socket.emit("sync_game_state", { lobbyId, gameState: result.newState });
        } else {
          setGameState(result.newState);
        }
      }
    } else {
      socket.emit("request_move", {
        lobbyId,
        action: "play",
        data: { cards: selectedCards, playerIndex: myIndex },
      });
      setSelectedCards([]);
    }
  };

  const handlePass = () => {
    const myIndex = getMyPlayerIndex(gameState, mySocketId);
    if (myIndex === -1) return;

    if (isHost) {
      const newState = passAction(gameState);
      if (!isSoloGame) {
        socket.emit("sync_game_state", { lobbyId, gameState: newState });
      } else {
        setGameState(newState);
      }
    } else {
      socket.emit("request_move", {
        lobbyId,
        action: "pass",
        data: { playerIndex: myIndex },
      });
    }
  };

  const handleSendMessage = (text) => {
    if (!text.trim()) return;
    socket.emit("send_chat", {
      lobbyId,
      message: text,
      playerName: playerName || (isHost ? "Host" : "Guest"),
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
    setVolumes((prev) => ({ ...prev, [type]: newVal }));
    if (type === "master") soundManager.setMasterVolume(newVal / 100);
    if (type === "sfx") soundManager.setSFXVolume(newVal / 100);
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
          if (move.type === "PLAY") safePlay("playSnap");
          if (move.type === "NEW_ROUND") safePlay("playDeal");

          const id = `sys-${Date.now()}-${index}`;
          const timestamp = new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
          let text = "";
          const pName = gameState.players[move.playerIndex]?.name || "System";

          if (move.type === "PLAY") {
            const comboName = COMBO_NAMES[move.combination.type] || "cards";
            const cardsDisplay = move.cards
              .map((c) => getCardDisplay(c))
              .join(" ");
            text = `${pName} played ${comboName} (${cardsDisplay})`;
          } else if (move.type === "PASS") {
            text = `${pName} passed`;
          }
          if (text)
            setMessages((prev) => [
              ...prev,
              { id, type: "SYSTEM", text, timestamp },
            ]);
        }, index * 100);
      });
      lastHistoryLengthRef.current = history.length;
    }
  }, [gameState?.moveHistory]);

  // --- RENDER ---
  if (!gameState)
    return (
      <div className="flex items-center justify-center h-full starfield">
        <div className="font-pixel-display text-[14px] text-glow-gold blink">
          LOADING GAME...
        </div>
      </div>
    );

  const myIndex = getMyPlayerIndex(gameState, mySocketId);
  const iAmSpectator = myIndex === -1;
  const viewIndex = iAmSpectator ? 0 : myIndex;

  const playersList = gameState.players || [];
  if (playersList.length < 4)
    return (
      <div className="flex items-center justify-center h-full starfield font-pixel-display text-rose">
        Error: Invalid Player Count
      </div>
    );

  const rotatedPlayers = [
    ...playersList.slice(viewIndex),
    ...playersList.slice(0, viewIndex),
  ];

  const bottomPlayer = rotatedPlayers[0];
  const leftPlayer = rotatedPlayers[1];
  const topPlayer = rotatedPlayers[2];
  const rightPlayer = rotatedPlayers[3];

  const isMyTurn = gameState.currentPlayerIndex === myIndex;
  const canPlay = selectedCards.length > 0 && isMyTurn;
  const canPass = isMyTurn && gameState.currentPlay !== null;
  const currentPlayerName =
    gameState.lastPlayedBy !== null
      ? playersList[gameState.lastPlayedBy].name
      : null;

  return (
    <div
      className="relative w-full h-full font-pixel-body text-parchment overflow-hidden flex flex-col"
      style={{ position: "fixed", inset: 0 }}
    >
      {/* TABLE BACKDROP */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, #2e0f1d 0%, #14102a 60%, #0a0712 100%)",
        }}
      />
      <div className="absolute inset-0 dither-shadow opacity-40 pointer-events-none" />

      {/* HEADER BAR */}
      <div
        className="relative flex items-center justify-between px-5 py-3 z-10"
        style={{
          backgroundColor: "rgba(10,7,18,0.85)",
          borderBottom: "4px solid #0a0712",
          backdropFilter: "blur(2px)",
        }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="pixel-btn font-pixel-display text-[10px] px-3 py-2"
            style={{
              backgroundColor: "#7a1530",
              borderColor: "#3a0a18",
              color: "#ead8b1",
            }}
          >
            ◄ EXIT
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="pixel-btn font-pixel-display"
            style={{
              backgroundColor: "#463a78",
              borderColor: "#2a234d",
              color: "#ead8b1",
              width: 36,
              height: 36,
              padding: 0,
              fontSize: 12,
            }}
          >
            ⚙
          </button>
          <div className="font-pixel-display text-[10px] text-bone/60 ml-2">
            LOBBY <span className="text-glow-cyan">#{lobbyId}</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div
            className="flex flex-col items-center px-3 py-1"
            style={{ backgroundColor: "#0a0712", border: "3px solid #1f1a3d" }}
          >
            <div className="font-pixel-display text-[8px] text-bone/60 tracking-wider">
              ROUND
            </div>
            <div className="font-pixel-display text-sm text-glow-gold">
              {gameState.roundNumber}
            </div>
          </div>
          <div className="flex flex-col items-center">
            <div className="font-pixel-display text-[8px] text-bone/60 tracking-wider">
              NOW PLAYING
            </div>
            <div className="font-pixel-display text-base text-glow-gold">
              THIRTEEN
            </div>
          </div>
          <div className="font-pixel-display text-[10px] text-bone/60">
            {iAmSpectator ? "SPECTATOR" : isHost ? "HOST" : "CLIENT"}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleMute}
            className="pixel-btn font-pixel-display"
            style={{
              backgroundColor: "#1f1a3d",
              borderColor: "#0a0712",
              color: "#ead8b1",
              width: 36,
              height: 36,
              padding: 0,
              fontSize: 12,
            }}
          >
            {isMuted ? "◊" : "♪"}
          </button>
        </div>
      </div>

      {/* SETTINGS MODAL */}
      {showSettings && (
        <div
          className="absolute top-16 left-4 z-50 p-4"
          style={{
            backgroundColor: "#1f1a3d",
            border: "4px solid #0a0712",
            boxShadow: "0 0 0 4px #463a78, 4px 4px 0 #0a0712",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="font-pixel-display text-[10px] text-glow-gold">
              ⚙ SETTINGS
            </span>
            <button
              onClick={() => setShowSettings(false)}
              className="font-pixel-display text-[10px] text-rose"
            >
              ✕
            </button>
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <label className="font-pixel-display text-[9px] text-bone/60">
                MASTER: {volumes.master}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={volumes.master}
                onChange={(e) => handleVolumeChange("master", e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="font-pixel-display text-[9px] text-bone/60">
                SFX: {volumes.sfx}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={volumes.sfx}
                onChange={(e) => handleVolumeChange("sfx", e.target.value)}
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}

      {/* GAME REGION */}
      <div
        className="relative flex-1 grid min-h-0"
        style={{ gridTemplateColumns: "1fr 320px" }}
      >
        {/* TABLE */}
        <div className="relative flex flex-col min-h-0 px-6 py-2">
          {/* Top opponent */}
          <div className="flex justify-center">
            <OpponentSection
              player={topPlayer}
              isActive={gameState.currentPlayerIndex === topPlayer.id}
              hasPassed={topPlayer.hasPassed}
              position="top"
            />
          </div>

          {/* Middle row: left + table + right */}
          <div className="flex-1 flex items-center justify-between gap-6 my-2 min-h-0">
            <OpponentSection
              player={leftPlayer}
              isActive={gameState.currentPlayerIndex === leftPlayer.id}
              hasPassed={leftPlayer.hasPassed}
              position="left"
            />
            <div className="flex-1 h-full flex items-center justify-center">
              <PlayArea
                currentPlay={gameState.currentPlay}
                lastPlayerName={currentPlayerName}
                roundNumber={gameState.roundNumber}
              />
            </div>
            <OpponentSection
              player={rightPlayer}
              isActive={gameState.currentPlayerIndex === rightPlayer.id}
              hasPassed={rightPlayer.hasPassed}
              position="right"
            />
          </div>

          {/* My hand area */}
          <PlayerHand
            hand={bottomPlayer.hand}
            selectedCards={selectedCards}
            onSelectionChange={(cards) => {
              setSelectedCards(cards);
              safePlay("playClick");
            }}
            isActive={isMyTurn && !bottomPlayer.isEliminated}
            showCardCount={true}
          />
          <GameControls
            onPlay={handlePlay}
            onPass={handlePass}
            canPlay={canPlay}
            canPass={canPass}
            isPlayerTurn={isMyTurn && !bottomPlayer.isEliminated}
            selectedCount={selectedCards.length}
            message={
              isMyTurn
                ? "Your turn!"
                : `Waiting for ${playersList[gameState.currentPlayerIndex].name}...`
            }
            errorMessage={errorMessage}
          />
        </div>

        {/* SIDEBAR */}
        <div
          className="flex flex-col min-h-0 border-l-4"
          style={{ borderColor: "#0a0712", background: "#0e0a1f" }}
        >
          <ScoreBoard
            players={gameState.players}
            currentPlayerIndex={gameState.currentPlayerIndex}
            roundNumber={gameState.roundNumber}
          />
          <GameChat
            messages={messages}
            onSendMessage={handleSendMessage}
            isCollapsed={isChatCollapsed}
            onToggleCollapse={() => setIsChatCollapsed(!isChatCollapsed)}
          />
        </div>
      </div>
    </div>
  );
};

export default GameThirteen;
