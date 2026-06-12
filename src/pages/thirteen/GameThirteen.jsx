// GAME THIRTEEN - Multiplayer Version with Pixel Retro UI

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { socket, connectSocket } from "../../utils/socket";
import { useAuth } from "../../hooks/useAuth";
import { useServerStats } from "../../hooks/useServerStats";
import PlayerHand from "../../components/thirteen/PlayerHand";
import OpponentSection from "../../components/thirteen/OpponentSection";
import PlayArea from "../../components/thirteen/PlayArea";
import GameControls from "../../components/thirteen/GameControls";
import ScoreBoard from "../../components/thirteen/ScoreBoard";
import GameChat from "../../components/thirteen/GameChat";
import {
  getCardDisplay,
  initializeGame,
  findPlayerWithCard,
} from "../../utils/deckUtils";
import DealAnimation from "../../components/thirteen/DealAnimation";

import {
  createGameState,
  playCards,
  passAction,
  startNextRound,
} from "../../utils/gameLogic";
import { validatePlay } from "../../utils/handEvaluator";
import { COMBO_NAMES, GAME_STATES, GAME_SETTINGS } from "../../utils/constants";
import { makeAIDecision } from "../../utils/aiPlayer";

import { soundManager } from "../../utils/SoundManager";

const GameThirteen = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    lobbyId,
    isHost,
    playerName,
    aiDifficulty = "MEDIUM",
  } = location.state || {};

  const { identity } = useAuth();

  const [gameState, setGameState] = useState(null);
  const [selectedCards, setSelectedCards] = useState([]);
  const [messages, setMessages] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [showRoundEnd, setShowRoundEnd] = useState(false);
  const [roundEndData, setRoundEndData] = useState(null);
  const [isDealing, setIsDealing] = useState(true);
  const [dealCounts, setDealCounts] = useState([0, 0, 0, 0]);

  const [showSettings, setShowSettings] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);

  const [volumes, setVolumes] = useState({ master: 50, sfx: 50 });

  const lastHistoryLengthRef = useRef(0);
  const gameStateRef = useRef(gameState);
  const dealOrderRef = useRef(null);

  const handleDealProgress = useCallback((counts) => setDealCounts(counts), []);
  const handleDealComplete = useCallback(() => {
    setDealCounts([13, 13, 13, 13]);
    dealOrderRef.current = null;
    setIsDealing(false);
  }, []);

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
    } catch {
      /* audio not ready yet — safe to ignore */
    }
  };

  const isSoloGame = lobbyId?.startsWith("SOLO-");
  const { connected, ping } = useServerStats({ enabled: !isSoloGame });

  // --- HELPER: FIND MY INDEX ---
  const getMyPlayerIndex = useCallback(
    (state) => {
      if (isSoloGame) return 0;
      if (!state) return -1;
      let idx = state.players.findIndex(
        (p) => p.socketId && p.socketId === socket.id,
      );
      if (idx === -1 && playerName) {
        idx = state.players.findIndex((p) => p.name === playerName);
      }
      return idx;
    },
    [isSoloGame, playerName],
  );

  // --- GAME SETUP ---
  // Solo runs entirely locally. Multiplayer is server-authoritative: the
  // server deals, validates moves, and runs CPU seats — we render its state.
  useEffect(() => {
    if (!lobbyId) {
      navigate("/");
      return;
    }

    if (soundManager && soundManager.init) soundManager.init();

    if (isSoloGame) {
      if (!gameStateRef.current) {
        const { hands } = initializeGame();
        const startingPlayer = findPlayerWithCard(hands, "3", "♦");
        const initialState = createGameState(
          hands,
          startingPlayer >= 0 ? startingPlayer : 0,
          aiDifficulty,
        );
        if (initialState.players[0]) {
          initialState.players[0].name = playerName || "You";
          initialState.players[0].type = "HUMAN";
        }
        setGameState(initialState);
      }
      return;
    }

    const joinGame = () => {
      socket.emit("join_lobby", { lobbyId, playerName });
      socket.emit("check_game_status", { lobbyId });
    };

    connectSocket({ name: identity.name, tag: identity.tag }).then(() => {
      if (socket.connected) joinGame();
    });

    const handleStateUpdate = (newState) => {
      const prev = gameStateRef.current;
      const isNewRoundOrMatch =
        newState.gameState === GAME_STATES.PLAYING &&
        (!prev ||
          prev.roundNumber !== newState.roundNumber ||
          prev.matchNumber !== newState.matchNumber);
      setGameState(newState);
      if (newState.gameState === GAME_STATES.PLAYING) {
        setShowRoundEnd(false);
        setRoundEndData(null);
        if (isNewRoundOrMatch) {
          dealOrderRef.current = null;
          setDealCounts([0, 0, 0, 0]);
          setIsDealing(true);
        }
      }
      const myIdx = getMyPlayerIndex(newState);
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

    const handleMoveRejected = ({ reason }) => {
      setErrorMessage(reason || "Move rejected");
      safePlay("playError");
    };

    socket.on("connect", joinGame);
    socket.on("game_state_update", handleStateUpdate);
    socket.on("receive_chat", handleReceiveChat);
    socket.on("move_rejected", handleMoveRejected);

    return () => {
      socket.off("connect", joinGame);
      socket.off("game_state_update", handleStateUpdate);
      socket.off("receive_chat", handleReceiveChat);
      socket.off("move_rejected", handleMoveRejected);
    };
  }, [lobbyId]);

  // --- AI LOGIC (SOLO ONLY — multiplayer CPUs run on the server) ---
  useEffect(() => {
    if (
      !isSoloGame ||
      !gameState ||
      isDealing ||
      gameState.gameState === GAME_STATES.GAME_OVER ||
      gameState.gameState === GAME_STATES.ROUND_END
    )
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

        if (result) setGameState(result);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [gameState, isSoloGame, isDealing]);

  // --- AUTO-CONTINUE: ROUND_END → next round ---
  useEffect(() => {
    if (!gameState) return;

    if (
      gameState.gameState === GAME_STATES.ROUND_END ||
      gameState.gameState === GAME_STATES.GAME_OVER
    ) {
      const roundWinner =
        gameState.winnerIndex !== undefined
          ? gameState.players[gameState.winnerIndex]
          : null;

      setRoundEndData({
        roundNumber: gameState.roundNumber,
        players: gameState.players.map((p, idx) => ({
          name: p.name,
          score: p.score,
          isEliminated: p.isEliminated,
          matchWins: (gameState.matchWins || [0, 0, 0, 0])[idx],
        })),
        roundWinnerName: roundWinner?.name,
        isGameOver: gameState.gameState === GAME_STATES.GAME_OVER,
      });
      setShowRoundEnd(true);
    }

    // Multiplayer: the server starts the next round itself.
    if (!isSoloGame) return;
    if (gameState.gameState !== GAME_STATES.ROUND_END) return;

    const timer = setTimeout(() => {
      const { hands } = initializeGame();
      const nextState = startNextRound(gameState, hands);

      setShowRoundEnd(false);
      setRoundEndData(null);
      dealOrderRef.current = null;
      setDealCounts([0, 0, 0, 0]);
      setIsDealing(true);
      setGameState(nextState);
    }, 4000);

    return () => clearTimeout(timer);
  }, [gameState?.gameState]);

  // --- ACTIONS ---
  const handlePlay = () => {
    if (soundManager.context && soundManager.context.state === "suspended") {
      soundManager.context.resume();
    }

    const myIndex = getMyPlayerIndex(gameState);
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

    if (isSoloGame) {
      const result = playCards(gameState, selectedCards);
      if (result.success) {
        setSelectedCards([]);
        setGameState(result.newState);
      }
    } else {
      socket.emit("request_move", {
        lobbyId,
        action: "play",
        data: { cards: selectedCards.map((c) => c.id) },
      });
      setSelectedCards([]);
    }
  };

  const handlePass = () => {
    const myIndex = getMyPlayerIndex(gameState);
    if (myIndex === -1) return;

    if (isSoloGame) {
      setGameState(passAction(gameState));
    } else {
      socket.emit("request_move", { lobbyId, action: "pass", data: {} });
    }
  };

  const handleSendMessage = (text) => {
    if (!text.trim()) return;

    // Solo games have no server — chat is local
    if (isSoloGame) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-${Math.random()}`,
          type: "CHAT",
          sender: playerName || "You",
          text: text.trim(),
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          isMe: true,
        },
      ]);
      return;
    }

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

  // --- EXIT ---
  const handleExit = () => {
    if (!isSoloGame) socket.emit("leave_lobby", { lobbyId });
    navigate("/");
  };

  // --- REMATCH ---
  const handleRematch = () => {
    if (!isSoloGame) {
      if (isHost) socket.emit("request_rematch", { lobbyId });
      return;
    }

    const { hands } = initializeGame();
    const startingPlayer = findPlayerWithCard(hands, "3", "♦");
    const matchMeta = {
      matchNumber: (gameState.matchNumber || 1) + 1,
      matchWins: gameState.matchWins || [0, 0, 0, 0],
    };
    const freshState = createGameState(
      hands,
      startingPlayer >= 0 ? startingPlayer : 0,
      gameState.aiDifficulty,
      matchMeta,
    );

    freshState.players = freshState.players.map((p, idx) => ({
      ...p,
      name: gameState.players[idx].name,
      type: gameState.players[idx].type,
    }));

    setShowRoundEnd(false);
    setRoundEndData(null);
    dealOrderRef.current = null;
    setDealCounts([0, 0, 0, 0]);
    setIsDealing(true);
    setSelectedCards([]);
    lastHistoryLengthRef.current = 0;
    setMessages([]);
    setGameState(freshState);
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

  const myIndex = getMyPlayerIndex(gameState);
  const iAmSpectator = myIndex === -1;
  const viewIndex = iAmSpectator ? 0 : myIndex;

  const playersList = gameState.players || [];
  if (playersList.length < 4)
    return (
      <div className="flex items-center justify-center h-full starfield font-pixel-display text-rose">
        Error: Invalid Player Count
      </div>
    );

  if (isDealing && !dealOrderRef.current && playersList[0]?.hand.length > 0) {
    dealOrderRef.current = playersList.map((p) => {
      const indices = p.hand.map((_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      return indices;
    });
  }

  const visiblePlayers = isDealing
    ? playersList.map((p, idx) => {
        const count = dealCounts[idx] || 0;
        const order = dealOrderRef.current?.[idx];
        if (!order) return { ...p, hand: [] };
        const shown = order.slice(0, count).map((i) => p.hand[i]);
        return { ...p, hand: shown };
      })
    : playersList;

  const rotatedPlayers = [
    ...visiblePlayers.slice(viewIndex),
    ...visiblePlayers.slice(0, viewIndex),
  ];

  const bottomPlayer = rotatedPlayers[0];
  const leftPlayer = rotatedPlayers[1];
  const topPlayer = rotatedPlayers[2];
  const rightPlayer = rotatedPlayers[3];

  const isMyTurn = !isDealing && gameState.currentPlayerIndex === myIndex;
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
            onClick={handleExit}
            className="pixel-btn font-pixel-display text-[10px] px-3 py-2"
            style={{
              backgroundColor: "#7a1530",
              borderColor: "#3a0a18",
              color: "#ead8b1",
            }}
          >
            ◄ EXIT
          </button>
          <div className="font-pixel-display text-[10px] text-bone/60 ml-2">
            LOBBY <span className="text-glow-cyan">#{lobbyId}</span>
          </div>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-6">
          <div
            className="flex flex-col items-center px-3 py-1"
            style={{ backgroundColor: "#0a0712", border: "3px solid #1f1a3d" }}
          >
            <div className="font-pixel-display text-[8px] text-bone/60 tracking-wider">
              MATCH
            </div>
            <div className="font-pixel-display text-sm text-glow-gold">
              {gameState.matchNumber || 1}
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
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-pixel-body text-sm">
            {isSoloGame ? (
              <>
                <span style={{ color: "#9bd14f" }}>●●●</span>
                <span className="text-bone/70">LOCAL</span>
              </>
            ) : !connected ? (
              <>
                <span style={{ color: "#e85a7a" }}>●○○</span>
                <span style={{ color: "#e85a7a" }}>OFFLINE</span>
              </>
            ) : (
              <>
                <span
                  style={{
                    color:
                      ping == null || ping < 80
                        ? "#9bd14f"
                        : ping < 160
                          ? "#f4c430"
                          : "#e85a7a",
                  }}
                >
                  {ping == null || ping < 80 ? "●●●" : ping < 160 ? "●●○" : "●○○"}
                </span>
                <span className="text-bone/70">
                  {ping != null ? `${ping}ms` : "..."}
                </span>
              </>
            )}
          </div>
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
        </div>
      </div>

      {/* SETTINGS MODAL */}
      {showSettings && (
        <div
          className="absolute top-16 right-4 z-50 p-4"
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
            <button
              onClick={handleToggleMute}
              className="pixel-btn font-pixel-display text-[9px] px-3 py-2"
              style={{
                backgroundColor: isMuted ? "#7a1530" : "#463a78",
                borderColor: isMuted ? "#3a0a18" : "#2a234d",
                color: "#ead8b1",
              }}
            >
              {isMuted ? "🔇 SOUND OFF" : "🔊 SOUND ON"}
            </button>
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
        style={{ gridTemplateColumns: "minmax(0, 1fr) 300px" }}
      >
        {/* TABLE */}
        <div className="relative flex flex-col min-h-0 px-4 py-2">
          {/* Top opponent */}
          <div className="flex justify-center relative z-10">
            <OpponentSection
              player={topPlayer}
              isActive={gameState.currentPlayerIndex === topPlayer.id}
              hasPassed={topPlayer.hasPassed}
              position="top"
              isDealing={isDealing}
            />
          </div>

          {/* Middle row: left + table + right */}
          <div className="flex-1 flex items-center justify-between gap-4 my-2 min-h-0">
            <OpponentSection
              player={leftPlayer}
              isActive={gameState.currentPlayerIndex === leftPlayer.id}
              hasPassed={leftPlayer.hasPassed}
              position="left"
              isDealing={isDealing}
            />
            <div className="flex-1 h-full flex items-center justify-center relative">
              <PlayArea
                currentPlay={isDealing ? null : gameState.currentPlay}
                lastPlayerName={isDealing ? null : currentPlayerName}
                roundNumber={gameState.roundNumber}
              />
              {isDealing && gameState && (
                <DealAnimation
                  dealerIndex={gameState.dealerIndex}
                  viewIndex={viewIndex}
                  onDealProgress={handleDealProgress}
                  onComplete={handleDealComplete}
                />
              )}
            </div>
            <OpponentSection
              player={rightPlayer}
              isActive={gameState.currentPlayerIndex === rightPlayer.id}
              hasPassed={rightPlayer.hasPassed}
              position="right"
              isDealing={isDealing}
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
            isDealing={isDealing}
          />
          <GameControls
            onPlay={handlePlay}
            onPass={handlePass}
            canPlay={canPlay}
            canPass={canPass}
            isPlayerTurn={isMyTurn && !bottomPlayer.isEliminated}
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
            matchWins={gameState.matchWins || [0, 0, 0, 0]}
            myIndex={myIndex}
          />
          <GameChat
            messages={messages}
            onSendMessage={handleSendMessage}
            isCollapsed={isChatCollapsed}
            onToggleCollapse={() => setIsChatCollapsed(!isChatCollapsed)}
          />
        </div>
      </div>

      {/* ROUND END / GAME OVER OVERLAY */}
      {showRoundEnd && roundEndData && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center"
          style={{
            backgroundColor: "rgba(10, 7, 18, 0.85)",
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            className="flex flex-col items-center gap-4 p-8"
            style={{
              backgroundColor: "#1f1a3d",
              border: "4px solid #0a0712",
              boxShadow: "0 0 0 4px #463a78, 8px 8px 0 #0a0712",
              minWidth: 400,
            }}
          >
            {roundEndData.isGameOver ? (
              <>
                <div className="font-pixel-display text-lg text-glow-gold shimmer-text">
                  MATCH OVER
                </div>
                <div className="font-pixel-display text-[10px] text-parchment">
                  {(() => {
                    const winner = roundEndData.players.find(
                      (p) => !p.isEliminated,
                    );
                    return winner
                      ? `${winner.name.toUpperCase()} WINS!`
                      : "GAME FINISHED";
                  })()}
                </div>
              </>
            ) : (
              <>
                <div className="font-pixel-display text-base text-glow-gold">
                  ROUND {roundEndData.roundNumber} COMPLETE
                </div>
                {roundEndData.roundWinnerName && (
                  <div className="font-pixel-display text-[10px] text-glow-cyan">
                    {roundEndData.roundWinnerName} won the round!
                  </div>
                )}
              </>
            )}

            {/* Score summary table */}
            <div className="w-full flex flex-col gap-1 mt-2">
              {roundEndData.players
                .slice()
                .sort((a, b) => a.score - b.score)
                .map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-1.5"
                    style={{
                      backgroundColor: p.isEliminated ? "#2a0e18" : "#14102a",
                      border: "2px solid #1f1a3d",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="font-pixel-display text-[10px]"
                        style={{
                          color: i === 0 ? "#f4c430" : "#ead8b1",
                          width: 20,
                        }}
                      >
                        #{i + 1}
                      </span>
                      <span className="font-pixel-display text-[9px] text-parchment">
                        {p.name}
                      </span>
                      {p.isEliminated && (
                        <span
                          className="font-pixel-display text-[7px] px-1"
                          style={{
                            backgroundColor: "#7a1530",
                            color: "#ead8b1",
                          }}
                        >
                          ELIMINATED
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-pixel-display text-[10px] text-glow-gold">
                        {p.score} pts
                      </span>
                      {p.matchWins > 0 && (
                        <span
                          className="font-pixel-display text-[7px] px-1"
                          style={{
                            backgroundColor: "#f4c430",
                            color: "#1a1024",
                          }}
                        >
                          {p.matchWins}W
                        </span>
                      )}
                    </div>
                  </div>
                ))}
            </div>

            {roundEndData.isGameOver ? (
              <div className="flex flex-col items-center gap-3 mt-4">
                {isHost || isSoloGame ? (
                  <>
                    <button
                      onClick={handleRematch}
                      className="pixel-btn font-pixel-display text-[10px] px-6 py-3"
                      style={{
                        backgroundColor: "#f4c430",
                        borderColor: "#c89820",
                        color: "#1a1024",
                      }}
                    >
                      REMATCH
                    </button>
                    <button
                      onClick={handleExit}
                      className="pixel-btn font-pixel-display text-[10px] px-6 py-3"
                      style={{
                        backgroundColor: "#7a1530",
                        borderColor: "#3a0a18",
                        color: "#ead8b1",
                      }}
                    >
                      ABANDON LOBBY
                    </button>
                  </>
                ) : (
                  <>
                    <div className="font-pixel-display text-[9px] text-bone/60 blink">
                      WAITING FOR HOST...
                    </div>
                    <button
                      onClick={handleExit}
                      className="pixel-btn font-pixel-display text-[10px] px-6 py-3"
                      style={{
                        backgroundColor: "#7a1530",
                        borderColor: "#3a0a18",
                        color: "#ead8b1",
                      }}
                    >
                      ABANDON LOBBY
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="font-pixel-display text-[8px] text-bone/60 mt-2 blink">
                NEXT ROUND STARTING...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GameThirteen;
