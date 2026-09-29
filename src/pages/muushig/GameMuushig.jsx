// GAME MUUSHIG — a Muushig match against four CPU players.
//
// The rules live in utils/muushig/engine.js and the CPUs in utils/muushig/
// ai.js; this page renders the engine's state and feeds it moves. It runs
// entirely in the browser (there's no Muushig server yet), at the difficulty
// picked in the lobby. You always sit in seat 0, at the bottom; seats go
// clockwise from you.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useTableMetrics } from "../../hooks/useTableMetrics";
import PlayerHand from "../../components/thirteen/PlayerHand";
import OpponentSection from "../../components/thirteen/OpponentSection";
import GameChat from "../../components/thirteen/GameChat";
import RoundTable from "../../components/muushig/RoundTable";
import SidePiles from "../../components/muushig/SidePiles";
import RoundResults from "../../components/muushig/RoundResults";
import Suit from "../../components/muushig/Suit";
import MuushigScoreBoard from "../../components/muushig/MuushigScoreBoard";
import MuushigControls from "../../components/muushig/MuushigControls";
import MuushigRules from "../../components/muushig/MuushigRules";
import PixelIcon from "../../components/PixelIcon";
import { SignalBars } from "../../components/PixelUI";
import {
  PHASES,
  START_SCORE,
  TRICKS_PER_ROUND,
  allowedPlays,
  canFold,
  collectTrick,
  createMatch,
  decide,
  maxDiscard,
  penaltyFor,
  playCard,
  rematch,
  stackOrder,
  startNextRound,
  swap,
  takeTrump,
} from "../../utils/muushig/engine";
import { aiAction, applyAction } from "../../utils/muushig/ai";
import { soundManager } from "../../utils/SoundManager";

const ME = 0;
const AVATAR_COLOR = { 1: "#f4c430", 2: "#5fd4d6", 3: "#e85a7a", 4: "#9bd14f", 5: "#c5a8ff", custom: "#ead8b1" };
const LEVEL_COLOR = { EASY: "#9bd14f", MEDIUM: "#f4c430", HARD: "#e85a7a" };
const CPUS = [
  { name: "Sarnai", variant: 2 },
  { name: "Batu", variant: 3 },
  { name: "Oyun", variant: 4 },
  { name: "Temur", variant: 1 },
];
// Seats clockwise from yours: bottom, bottom-left, top-left, top-right, bottom-right.
const SEAT_POSITIONS = ["bottom", "bottomLeft", "topLeft", "topRight", "bottomRight"];
// How long a CPU "thinks" in each phase, and how long a full trick stays up.
const AI_DELAY = { DECIDE: 700, SWAP: 900, TRUMP: 900, PLAY: 950 };
const TRICK_PAUSE = 1500;
const ACTION_PHASES = new Set([PHASES.DECIDE, PHASES.SWAP, PHASES.TRUMP, PHASES.PLAY]);

const now = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const cardText = (c) => `${c.rank}${c.suit}`;
const baseName = (name = "") => name.split(" #")[0];

/** One engine event → one chat-log entry (see GameChat's LogLine), or null. */
function logEntry(e, game) {
  const name = (seat) => baseName(game.players[seat]?.name);
  const at = (fields) => ({ playerIndex: e.seat, name: name(e.seat), ...fields });
  switch (e.type) {
    case "firstDealer":
      return { text: `${name(e.seat)} drew the highest card and deals first.` };
    case "round":
      return { kind: "round", round: e.round };
    case "playIn":
      return at({ kind: "pass", verb: "plays this round" });
    case "fold":
      return at({ kind: "pass", verb: "folded" });
    case "swap":
      return at({
        kind: "pass",
        verb: e.emptyPile ? "can't swap: the draw pile is empty" : e.count ? `swapped ${e.count} card${e.count > 1 ? "s" : ""}` : "kept all 5 cards",
      });
    case "takeTrump":
      return at({ kind: "pass", verb: `took the trump ${cardText(e.card)}` });
    case "keepTrump":
      return at({ kind: "pass", verb: "left the trump card" });
    case "play":
      return at({ kind: "play", cards: [e.card] });
    case "debuff":
      return at({ kind: "pass", verb: `${e.reason === "ace" ? "held back the trump ace" : "held back a trump"}: ${cardText(e.card)} is debuffed` });
    case "eat":
      return at({ kind: "trick", verb: "EATS THE PILE" });
    case "roundEnd":
      return e.roundWinner !== null
        ? { kind: "roundEnd", playerIndex: e.roundWinner, name: name(e.roundWinner) }
        : { text: `Round ${e.round} scored.` };
    case "matchEnd":
      return at({ kind: "roundEnd", verb: "WINS THE MATCH" });
    default:
      return null;
  }
}

const GameMuushig = () => {
  const navigate = useNavigate();
  const { lobbyId, playerName, aiDifficulty = "MEDIUM" } = useLocation().state || {};
  const { identity } = useAuth();
  const myName = baseName(playerName || identity?.name || "You");
  const { handW, deckW } = useTableMetrics();

  const [game, setGame] = useState(() =>
    createMatch({
      players: [{ name: myName, type: "HUMAN" }, ...CPUS.map((c) => ({ name: c.name, type: "AI", level: aiDifficulty }))],
    }),
  );
  // Selection and errors belong to one turn: a new turn starts clean.
  const turnKey = `${game.matchNumber}-${game.roundNumber}-${game.phase}-${game.turn}-${game.trickNumber}`;
  const [selection, setSelection] = useState({ key: null, cards: [] });
  const selected = selection.key === turnKey ? selection.cards : [];
  const setSelected = (cards) => setSelection({ key: turnKey, cards });
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState({ key: null, text: "" });
  const errorMessage = error.key === turnKey ? error.text : "";
  const [showRules, setShowRules] = useState(false);
  const closeRules = useCallback(() => setShowRules(false), []);
  const [showSettings, setShowSettings] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volumes, setVolumes] = useState({ master: 50, sfx: 50 });
  const [sortMode, setSortMode] = useState(() => {
    try {
      return localStorage.getItem("khuzur_sort") === "suit" ? "suit" : "rank";
    } catch {
      return "rank";
    }
  });
  const loggedRef = useRef({ first: null, count: 0 });

  const safePlay = (method) => {
    try {
      if (soundManager.context?.state === "suspended") soundManager.context.resume();
      soundManager[method]?.();
    } catch {
      /* audio not ready yet — safe to ignore */
    }
  };

  useEffect(() => {
    soundManager.init?.();
  }, []);

  // --- CPU turns, and the pause after a full trick ---
  useEffect(() => {
    let run = null;
    let delay = 0;
    if (game.phase === PHASES.TRICK_END) {
      run = collectTrick;
      delay = TRICK_PAUSE;
    } else if (ACTION_PHASES.has(game.phase) && game.players[game.turn]?.type === "AI") {
      run = (s) => applyAction(s, aiAction(s));
      delay = AI_DELAY[game.phase];
    }
    if (!run) return;
    const timer = setTimeout(() => setGame((s) => run(s)), delay);
    return () => clearTimeout(timer);
  }, [game]);

  // --- Your turn: a ping ---
  const myTurn = ACTION_PHASES.has(game.phase) && game.turn === ME;
  useEffect(() => {
    if (myTurn) safePlay("playTurnAlert");
  }, [turnKey, myTurn]);

  // --- Engine events → the move log, plus sounds ---
  useEffect(() => {
    const logged = loggedRef.current;
    if (logged.first !== game.events[0]) {
      // A new match: its event list starts over.
      logged.first = game.events[0];
      logged.count = 0;
    }
    const fresh = game.events.slice(logged.count);
    logged.count = game.events.length;
    if (!fresh.length) return;
    const entries = fresh
      .map((e) => {
        if (e.type === "play") safePlay("playSnap");
        if (e.type === "round") safePlay("playDeal");
        const fields = logEntry(e, game);
        return fields && { id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type: "SYSTEM", timestamp: now(), ...fields };
      })
      .filter(Boolean);
    setMessages((m) => [...m, ...entries]);
  }, [game]);

  const changeSortMode = (mode) => {
    setSortMode(mode);
    safePlay("playClick");
    try {
      localStorage.setItem("khuzur_sort", mode);
    } catch {
      /* private window: the choice just won't persist */
    }
  };

  // --- Your moves ---
  // Validate against the current state first so a rule error shows in the
  // status line instead of throwing inside a state update.
  const act = (fn) => {
    try {
      const next = fn(game);
      setGame(next);
    } catch (err) {
      setError({ key: turnKey, text: err.message });
      safePlay("playError");
    }
  };
  const onDecide = (play) => act((s) => decide(s, ME, play));
  const onSwap = () => act((s) => swap(s, ME, selected.map((c) => c.id)));
  const onTakeTrump = (cardId) => act((s) => takeTrump(s, ME, cardId));
  const onThrow = () => selected[0] && act((s) => playCard(s, ME, selected[0].id));
  const onNextRound = () => setGame((s) => startNextRound(s));
  const onRematch = () => {
    setMessages([]);
    setGame((s) => rematch(s));
  };

  const handleSendMessage = (text) => {
    if (!text.trim()) return;
    setMessages((m) => [
      ...m,
      { id: `msg-${Date.now()}-${Math.random()}`, type: "CHAT", sender: myName, text: text.trim(), timestamp: now(), isMe: true },
    ]);
  };

  const handleToggleMute = () => setIsMuted(soundManager.toggleMute());
  const handleVolumeChange = (type, value) => {
    const v = parseInt(value);
    setVolumes((prev) => ({ ...prev, [type]: v }));
    if (type === "master") soundManager.setMasterVolume(v / 100);
    if (type === "sfx") soundManager.setSFXVolume(v / 100);
    if (!isMuted) soundManager.playClick();
  };

  // --- Derived view ---
  const { players, phase, trumpSuit } = game;
  const me = players[ME];
  const nameOf = (seat) => baseName(players[seat]?.name);

  const faceFor = (seat) =>
    seat === ME
      ? { variant: identity?.avatar ?? 1, customAvatarData: identity?.customAvatar }
      : { variant: CPUS[seat - 1].variant, customAvatarData: null };
  const colorFor = (seat) => (players[seat] ? AVATAR_COLOR[faceFor(seat).variant] : null) || "#ead8b1";
  const avatarFor = (msg) => (msg.isMe ? faceFor(ME) : faceFor(Math.max(0, players.findIndex((p) => p.name === msg.sender))));

  const allowed = useMemo(
    () => (game.phase === PHASES.PLAY && game.turn === ME ? new Set(allowedPlays(game, ME).map((c) => c.id)) : null),
    [game],
  );
  const stack = stackOrder(game.trick, trumpSuit).map((p) => ({
    key: `${game.roundNumber}-${game.trickNumber}-${p.card.id}`,
    card: p.card,
    seat: SEAT_POSITIONS[p.seat],
    name: nameOf(p.seat),
  }));
  const eater = stack.length ? stack[stack.length - 1].name : null;
  const phaseLabel = {
    [PHASES.DECIDE]: "PLAY OR FOLD",
    [PHASES.SWAP]: "SWAPPING",
    [PHASES.TRUMP]: "DEALER'S TRUMP",
  }[phase];

  // Status line and buttons for the current phase.
  const pick = selected[0] ? me.hand.find((c) => c.id === selected[0].id) : null;
  let message;
  let warning = null;
  let buttons = [];
  if (!myTurn) {
    const who = nameOf(game.turn);
    message =
      phase === PHASES.DECIDE
        ? `${who} is deciding...`
        : phase === PHASES.SWAP
          ? `${who} is swapping...`
          : phase === PHASES.TRUMP
            ? `${who} may take the trump card...`
            : phase === PHASES.PLAY
              ? `Waiting for ${who}...`
              : phase === PHASES.TRICK_END
                ? `${nameOf(game.trickWinner)} eats the pile!`
                : "Round over.";
    if (me.status === "fold" && phase !== PHASES.DECIDE) message = `You folded. ${message}`;
  } else if (phase === PHASES.DECIDE) {
    const foldable = canFold(game, ME);
    message = foldable ? "Play this round, or fold and sit it out?" : "You must play: at least 2 players are needed.";
    buttons = [
      { label: "FOLD", tone: "rose", onClick: () => onDecide(false), disabled: !foldable },
      { label: "PLAY", tone: "green", primary: true, onClick: () => onDecide(true) },
    ];
  } else if (phase === PHASES.SWAP) {
    const max = maxDiscard(game);
    message = `Pick up to ${max} card${max === 1 ? "" : "s"} to swap. The draw pile has ${game.drawPile.length}.`;
    buttons = [
      selected.length
        ? { label: `SWAP ${selected.length}`, tone: "green", primary: true, onClick: onSwap }
        : { label: "KEEP ALL", tone: "dusk", primary: true, onClick: onSwap },
    ];
  } else if (phase === PHASES.TRUMP) {
    message = (
      <>
        You're the dealer: take the trump {game.trumpCard.rank}
        <Suit suit={trumpSuit} size={18} />? Pick a card to give up.
      </>
    );
    buttons = [
      { label: "KEEP HAND", tone: "dusk", onClick: () => onTakeTrump(null) },
      { label: "TAKE TRUMP", tone: "gold", primary: true, disabled: !pick, onClick: () => onTakeTrump(pick.id) },
    ];
  } else if (phase === PHASES.PLAY) {
    const debuffed = me.hand.find((c) => c.debuffed);
    const led = game.trick.find((p) => !p.card.debuffed)?.card.suit;
    const followSuit = led && led !== trumpSuit;
    message = debuffed ? (
      <>
        Your {debuffed.rank}
        <Suit suit={debuffed.suit} size={18} /> is debuffed. You must throw it and lose this pile.
      </>
    ) : !game.trick.length ? (
      "Your lead. Throw any card."
    ) : (
      <>
        {eater} is eating. Play a higher {followSuit ? "" : "trump "}
        <Suit suit={followSuit ? led : trumpSuit} size={18} /> if you have one.
      </>
    );
    const hit = pick ? penaltyFor(game, ME, pick) : null;
    if (hit)
      warning = (
        <>
          Throwing this debuffs your {hit.rank}
          <Suit suit={hit.suit} size={18} />: you'll have to throw it next trick.
        </>
      );
    buttons = [{ label: "THROW", tone: "green", primary: true, disabled: !pick, onClick: onThrow }];
  }
  if (errorMessage) warning = errorMessage;

  const canSelect = myTurn && (phase === PHASES.SWAP || phase === PHASES.TRUMP || phase === PHASES.PLAY);
  const onSelectionChange = (picked) => {
    if (phase === PHASES.SWAP) {
      if (picked.length <= maxDiscard(game)) setSelected(picked);
    } else {
      // One card at a time: the newest pick replaces the old one.
      setSelected(picked.filter((c) => !selected.some((s) => s.id === c.id)).slice(-1));
    }
    safePlay("playClick");
  };

  const seat = (index, position) => {
    const p = players[index];
    const folded = p.status === "fold";
    const active = index === game.turn && ACTION_PHASES.has(phase);
    return (
      <OpponentSection
        player={{ ...p, isEliminated: folded }}
        isActive={active}
        position={position}
        face={faceFor(index)}
        chip={
          folded
            ? { label: "FOLD", bg: "#463a78", fg: "#ead8b1" }
            : active
              ? { label: "TURN", bg: "#f4c430", blink: true }
              : p.status === "play" && phase === PHASES.DECIDE
                ? { label: "IN", bg: "#9bd14f", fg: "#1a3a0e" }
                : null
        }
        tag={index === game.dealer ? { label: "DEAL", bg: "#5fd4d6", fg: "#0a3a3a" } : null}
        detail={<SeatDetail eaten={p.eaten} folded={folded} />}
      />
    );
  };

  const showResults = (phase === PHASES.ROUND_END || phase === PHASES.MATCH_OVER) && game.roundResults;
  const isSolo = !lobbyId || lobbyId.startsWith("SOLO-");

  return (
    <div className="relative w-full h-full font-pixel-body text-parchment overflow-hidden flex flex-col" style={{ position: "fixed", inset: 0 }}>
      {/* TABLE BACKDROP */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, #123526 0%, #14102a 60%, #0a0712 100%)" }} />
      <div className="absolute inset-0 dither-shadow opacity-40 pointer-events-none" />

      {/* HEADER BAR */}
      <div
        className="relative flex items-center justify-between px-5 py-3 z-10"
        style={{ backgroundColor: "rgba(10,7,18,0.85)", borderBottom: "4px solid #0a0712", backdropFilter: "blur(2px)" }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="pixel-btn font-pixel-display text-[10px] px-3 py-2"
            style={{ backgroundColor: "#7a1530", borderColor: "#3a0a18", color: "#ead8b1" }}
          >
            <span className="flex items-center gap-2">
              <PixelIcon name="back" size={12} />
              EXIT
            </span>
          </button>
          <span
            className="font-pixel-display text-[10px] leading-none px-1.5 py-1 ml-2"
            style={{ backgroundColor: LEVEL_COLOR[aiDifficulty] || "#f4c430", color: "#1a1024", boxShadow: "0 0 0 2px #0a0712" }}
            title={isSolo ? "Practice against CPU players" : "Online Muushig isn't available yet, so this is a practice game"}
          >
            PRACTICE · {aiDifficulty}
          </span>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-6">
          <div className="flex flex-col items-center px-3 py-1" style={{ backgroundColor: "#0a0712", border: "3px solid #1f1a3d" }}>
            <div className="font-pixel-display text-[8px] text-bone/60 tracking-wider">MATCH</div>
            <div className="font-pixel-display text-sm text-glow-gold">{game.matchNumber}</div>
          </div>
          <div className="flex flex-col items-center">
            <div className="font-pixel-display text-[8px] text-bone/60 tracking-wider">NOW PLAYING</div>
            <div className="font-pixel-display text-base" style={{ color: "#9bd14f", textShadow: "2px 2px 0 #000, 0 0 8px rgba(155,209,79,0.4)" }}>
              MUUSHIG
            </div>
          </div>
          <div className="flex flex-col items-center px-3 py-1" style={{ backgroundColor: "#0a0712", border: "3px solid #1f1a3d" }}>
            <div className="font-pixel-display text-[8px] text-bone/60 tracking-wider">ROUND</div>
            <div className="font-pixel-display text-sm text-glow-gold">{game.roundNumber}</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-pixel-body text-sm">
            <SignalBars level={3} color="#9bd14f" />
            <span className="text-bone/70">LOCAL</span>
          </div>
          <button
            onClick={() => setShowRules(true)}
            className="pixel-btn font-pixel-display text-[10px] px-3 flex items-center gap-2"
            style={{ backgroundColor: "#9bd14f", borderColor: "#6a9a30", color: "#1a3a0e", height: 36 }}
            title="How to play"
          >
            <PixelIcon name="book" size={14} />
            RULES
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="pixel-btn font-pixel-display"
            style={{ backgroundColor: "#463a78", borderColor: "#2a234d", color: "#ead8b1", width: 36, height: 36, padding: 0, fontSize: 12 }}
            title="Settings"
          >
            <PixelIcon name="gear" size={16} className="mx-auto" />
          </button>
        </div>
      </div>

      {showRules && <MuushigRules onClose={closeRules} />}

      {/* SETTINGS */}
      {showSettings && (
        <div
          className="absolute top-16 right-4 z-50 p-4"
          style={{ backgroundColor: "#1f1a3d", border: "4px solid #0a0712", boxShadow: "0 0 0 4px #463a78, 4px 4px 0 #0a0712" }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="font-pixel-display text-[10px] text-glow-gold">SETTINGS</span>
            <button onClick={() => setShowSettings(false)} className="font-pixel-display text-[10px] text-rose">
              <PixelIcon name="close" size={12} title="Close" />
            </button>
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={handleToggleMute}
              className="pixel-btn font-pixel-display text-[9px] px-3 py-2"
              style={{ backgroundColor: isMuted ? "#7a1530" : "#463a78", borderColor: isMuted ? "#3a0a18" : "#2a234d", color: "#ead8b1" }}
            >
              <span className="flex items-center justify-center gap-2">
                <PixelIcon name={isMuted ? "mute" : "speaker"} size={12} />
                {isMuted ? "SOUND OFF" : "SOUND ON"}
              </span>
            </button>
            {[
              ["master", "MASTER"],
              ["sfx", "SFX"],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="font-pixel-display text-[9px] text-bone/60">
                  {label}: {volumes[key]}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volumes[key]}
                  onChange={(e) => handleVolumeChange(key, e.target.value)}
                  className="w-full"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GAME REGION */}
      <div className="relative flex-1 grid min-h-0" style={{ gridTemplateColumns: "minmax(0, 1fr) 300px" }}>
        {/* TABLE */}
        <div className="relative flex flex-col min-h-0 px-4 py-2">
          <RoundTable
            seats={{
              bottomLeft: seat(1, "left"),
              topLeft: seat(2, "left"),
              topRight: seat(3, "right"),
              bottomRight: seat(4, "right"),
            }}
            stack={stack}
            trump={game.trumpCard}
            trumpTakenBy={game.trumpTakenBy !== null ? nameOf(game.trumpTakenBy) : null}
            trickNumber={Math.max(1, game.trickNumber)}
            tricksPerRound={TRICKS_PER_ROUND}
            phaseLabel={phaseLabel}
            maxCardWidth={deckW}
          />

          {/* My hand, with the draw and dead piles in the corner beside it */}
          <div className="relative">
            <div className="absolute left-2 bottom-2 z-10">
              <SidePiles drawCount={game.drawPile.length} deadCount={game.deadPile.length} cardWidth={Math.round(deckW * 0.85)} />
            </div>
            <PlayerHand
              hand={me.hand}
              selectedCards={selected}
              onSelectionChange={onSelectionChange}
              isActive={canSelect}
              cardWidth={handW}
              deckWidth={deckW}
              sortMode={sortMode}
              isPlayable={allowed ? (c) => allowed.has(c.id) : undefined}
              spread={1.08} // only 5 cards: lay them out side by side
              emptyMessage={me.status === "fold" ? "YOU FOLDED — SITTING THIS ROUND OUT" : ""}
            />
          </div>
          <MuushigControls message={message} warning={warning} buttons={buttons} sortMode={sortMode} onSortModeChange={changeSortMode} />
        </div>

        {/* SIDEBAR */}
        <div className="flex flex-col min-h-0 border-l-4" style={{ borderColor: "#0a0712", background: "#0e0a1f" }}>
          <MuushigScoreBoard
            players={players.map((p) => ({ ...p, folded: p.status === "fold" }))}
            currentPlayerIndex={ACTION_PHASES.has(phase) ? game.turn : -1}
            dealerIndex={game.dealer}
            startScore={START_SCORE}
            myIndex={ME}
            faceFor={faceFor}
          />
          <GameChat messages={messages} onSendMessage={handleSendMessage} avatarFor={avatarFor} colorFor={colorFor} />
        </div>
      </div>

      {showResults && (
        <RoundResults
          round={game.roundNumber}
          results={game.roundResults.results}
          players={players}
          faceFor={faceFor}
          matchWinner={phase === PHASES.MATCH_OVER ? game.matchWinner : null}
          onNext={onNextRound}
          onRematch={onRematch}
          onExit={() => navigate("/")}
        />
      )}
    </div>
  );
};

// Piles eaten this round: one box per trick (5 a round); all 5 wins the
// round. Scores live on the scoreboard.
function SeatDetail({ eaten, folded }) {
  const sweep = eaten >= 5;
  return (
    <div className="mt-2 flex flex-col items-center gap-1.5">
      <div
        className={`font-pixel-display text-[10px] leading-none ${sweep ? "text-glow-gold" : ""}`}
        style={{ color: folded ? "#8a7fb0" : sweep ? undefined : "rgba(234,216,177,0.7)" }}
      >
        {folded ? "FOLDED" : sweep ? "ROUND WON" : "EATEN"}
      </div>
      {!folded && (
        <div className="flex gap-1" title={`${eaten} eaten this round`} aria-label={`${eaten} of 5 piles eaten`}>
          {Array.from({ length: 5 }, (_, i) => (
            <span
              key={i}
              style={{
                width: 12,
                height: 12,
                backgroundColor: i < eaten ? "#f4c430" : "#0a0712",
                boxShadow:
                  i < eaten
                    ? `inset 0 -2px 0 #c89820, 0 0 0 1px #0a0712${sweep ? ", 0 0 6px rgba(244,196,48,0.8)" : ""}`
                    : "inset 0 0 0 2px #463a78",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default GameMuushig;
