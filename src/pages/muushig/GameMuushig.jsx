// GAME MUUSHIG — a Muushig match against four CPU players.
//
// The rules live in utils/muushig/engine.js and the CPUs in utils/muushig/
// ai.js; this page renders the engine's state and feeds it moves. It runs
// entirely in the browser (there's no Muushig server yet), at the difficulty
// picked in the lobby. You always sit in seat 0, at the bottom; seats go
// clockwise from you.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { prefersReducedMotion, useTableMetrics } from "../../hooks/useTableMetrics";
import PlayerHand from "../../components/thirteen/PlayerHand";
import OpponentSection from "../../components/thirteen/OpponentSection";
import GameChat from "../../components/thirteen/GameChat";
import RoundTable from "../../components/muushig/RoundTable";
import SidePiles from "../../components/muushig/SidePiles";
import RoundResults from "../../components/muushig/RoundResults";
import DealAnimation from "../../components/thirteen/DealAnimation";
import DealerIntro from "../../components/muushig/DealerIntro";
import DealDraw from "../../components/muushig/DealDraw";
import CardFlight from "../../components/muushig/CardFlight";
import { STAGGER, legTime } from "../../components/muushig/flightTiming";
import Callout from "../../components/Callout";
import Suit from "../../components/muushig/Suit";
import MuushigScoreBoard from "../../components/muushig/MuushigScoreBoard";
import MuushigControls from "../../components/muushig/MuushigControls";
import MuushigRules from "../../components/muushig/MuushigRules";
import PixelIcon from "../../components/PixelIcon";
import { SignalBars } from "../../components/PixelUI";
import {
  MAX_FOLDS_IN_A_ROW,
  PHASES,
  START_SCORE,
  TRICKS_PER_ROUND,
  allowedPlays,
  collectTrick,
  createMatch,
  decide,
  drawForDeal,
  foldBlock,
  maxDiscard,
  maxDrawDepth,
  playCard,
  rematch,
  stackOrder,
  startNextRound,
  swap,
  takeTrump,
} from "../../utils/muushig/engine";
import { aiAction, applyAction } from "../../utils/muushig/ai";
import { soundManager } from "../../utils/SoundManager";
import { useSoloMatchReport } from "../../hooks/useSoloMatchReport";
import { muushigSoloReport } from "../../utils/soloReport";
import { BOT_NAMES } from "../../utils/constants";

const ME = 0;
const AVATAR_COLOR = { 1: "#f4c430", 2: "#5fd4d6", 3: "#e85a7a", 4: "#9bd14f", 5: "#c5a8ff", custom: "#ead8b1" };
const LEVEL_COLOR = { EASY: "#9bd14f", MEDIUM: "#f4c430", HARD: "#e85a7a" };
const CPUS = [
  { name: BOT_NAMES[0], variant: 2 },
  { name: BOT_NAMES[1], variant: 3 },
  { name: BOT_NAMES[2], variant: 4 },
  { name: BOT_NAMES[3], variant: 1 },
];
// Seats clockwise from yours: bottom, bottom-left, top-left, top-right, bottom-right.
const SEAT_POSITIONS = ["bottom", "bottomLeft", "topLeft", "topRight", "bottomRight"];
// The deal animation: each seat's fan faces the felt, and all 5 seats get cards.
const DEAL_ROTATION = { bottomLeft: 90, topLeft: 90, topRight: 270, bottomRight: 270 };
const ALL_SEATS_IN = [true, true, true, true, true];
const NO_CARDS = [0, 0, 0, 0, 0];
// How long a CPU "thinks" in each phase, and how long a full trick stays up.
// DECIDE is slower so each seat's IN/FOLD callout plays out on its own; SWAP
// is quicker since its cards' flight (see CardFlight) plays before it. DRAW
// leaves time for the last drawn card to land and turn (see DealDraw), and a
// tie holds a little longer so everyone sees who draws again.
const AI_DELAY = { DRAW: 1300, DECIDE: 1100, SWAP: 600, TRUMP: 900, PLAY: 950 };
const TIE_PAUSE = 2000;
const TRICK_PAUSE = 1500;
const ACTION_PHASES = new Set([PHASES.DECIDE, PHASES.SWAP, PHASES.TRUMP, PHASES.PLAY]);

const now = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const cardText = (c) => `${c.rank}${c.suit}`;
const nth = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th"}`;

/** A stable shuffle of hand positions, so dealt cards arrive in a random order. */
function dealOrder(hand, salt) {
  const h = (str) => {
    let x = 2166136261;
    for (let i = 0; i < str.length; i++) x = Math.imul(x ^ str.charCodeAt(i), 16777619);
    return x >>> 0;
  };
  return hand.map((c, i) => [h(c.id + salt), i]).sort((a, b) => a[0] - b[0]).map(([, i]) => i);
}
const baseName = (name = "") => name.split(" #")[0];

/** One engine event → chat-log entries (see GameChat's LogLine), or null. */
function logEntry(e, game) {
  const name = (seat) => baseName(game.players[seat]?.name);
  const at = (fields) => ({ playerIndex: e.seat, name: name(e.seat), ...fields });
  switch (e.type) {
    case "drawStart":
      return { text: `${name(e.seat)} draws first for the deal.` };
    case "dealDraw":
      return at({ kind: "pass", verb: `drew the ${nth(e.depth)} card: ${cardText(e.card)}` });
    case "drawTie":
      return { text: `Tie! ${e.seats.map(name).join(" and ")} draw again.` };
    case "firstDealer":
      return { text: `${name(e.seat)} drew the highest card: ${cardText(e.card)}.` };
    case "round":
      return [{ kind: "round", round: e.round }, { text: `${name(e.seat)} deals.` }];
    case "playIn":
      return at({ kind: "pass", verb: "is in this round" });
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

// Each seat's decision, announced over the seat (see Callout).
const DECISION = {
  play: { label: "IN!", bg: "#9bd14f", fg: "#1a3a0e" },
  fold: { label: "FOLD", bg: "#463a78", fg: "#ead8b1" },
};

// A debuffed card, announced over an opponent's seat (yours shows in your hand).
const DEBUFF_CALLOUT = { label: "DEBUFFED", bg: "#c0203a", fg: "#fff7d8" };

/**
 * The cards `next` moved on top of `prev`, as a flight across the table (see
 * CardFlight), or null: a swap, a fold, the dealer taking the trump, or a
 * trick being eaten. fromRects: where the cards leaving your hand sat. Call it
 * before `next` renders: an eaten trick is measured off the felt.
 */
function flightFor(prev, next, fromRects = null) {
  const e = next.events
    .slice(prev.events.length)
    .find((ev) => (ev.type === "swap" && ev.count > 0) || ["fold", "takeTrump", "eat"].includes(ev.type));
  if (!e || prefersReducedMotion()) return null;
  const id = `${next.matchNumber}-${next.roundNumber}-${e.type}-${e.seat}-${e.trick ?? 0}`;
  if (e.type === "eat") {
    // The trick sweeps off the felt, bottom card first, top card on top.
    const cards = stackOrder(prev.trick, prev.trumpSuit).map((p) => p.card);
    const leg = { count: cards.length, from: "trick", to: e.seat === ME ? "mine" : "plate", faces: cards, stagger: 0.04 };
    return { id, seat: e.seat, legs: [leg], fromRects: cardRects(cards, "data-trick-card"), incomingIds: [], leg: 0, landed: 0 };
  }
  const mine = e.seat === ME;
  const p = next.players[e.seat];
  const here = mine ? "hand" : "seat";
  const toDead = (cards) => ({ count: cards.length, from: here, to: "dead", faces: mine ? cards : null });
  let legs;
  let incoming = []; // cards arriving in the hand, which go to its end
  if (e.type === "swap") {
    incoming = p.hand.slice(-e.count);
    legs = [toDead(p.discarded.slice(-e.count)), { count: e.count, from: "draw", to: here, faces: null }];
  } else if (e.type === "fold") {
    legs = [toDead(prev.players[e.seat].hand)];
  } else {
    incoming = p.hand.slice(-1);
    // The trump card is public, so it travels face up.
    legs = [toDead(p.discarded.slice(-1)), { count: 1, from: "trump", to: here, faces: [e.card] }];
  }
  return {
    id,
    seat: e.seat,
    legs,
    fromRects: mine ? fromRects : null,
    incomingIds: mine ? incoming.map((c) => c.id) : [],
    leg: 0, // the leg in the air
    landed: 0, // its cards that have landed
  };
}

/** Index of the flight's first leg matching `test`, or -1. */
const legIndex = (flight, test) => (flight ? flight.legs.findIndex(test) : -1);

/** Where each card sits on the page, found by `attr` (its id); null if any is missing. */
function cardRects(cards, attr) {
  const rects = cards.map((c) => {
    const el = document.querySelector(`[${attr}="${CSS.escape(c.id)}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, width: el.offsetWidth, rotation: Number(gsap.getProperty(el, "rotation")) || 0 };
  });
  return rects.every(Boolean) ? rects : null;
}
const handRects = (cards) => cardRects(cards, "data-card-id");

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
  const feltRef = useRef(null);
  const drawPileRef = useRef(null);
  const deadPileRef = useRef(null);
  const trumpRef = useRef(null);
  const handAreaRef = useRef(null); // your side of the table, where piles you eat go
  // Cards being flown across the table; the game waits for them.
  const [flight, setFlight] = useState(null);
  const flying = flight !== null;
  const updateFlight = (fn) => setFlight((f) => f && { ...f, ...fn(f) });
  // Moves to a new state, flying any cards it moved.
  const advance = (prev, next, fromRects) => {
    setFlight(flightFor(prev, next, fromRects));
    setGame(next);
  };
  // Your IN!/FOLD callout that has already played (by id).
  const [myCalloutDone, setMyCalloutDone] = useState(null);

  // --- A match opens with the draw for the deal. Every round opens with the
  // dealer banner, then the shuffle and deal ---
  const roundKey = `${game.matchNumber}-${game.roundNumber}`;
  const [drawnKey, setDrawnKey] = useState(null);
  const [introKey, setIntroKey] = useState(null);
  const [dealtKey, setDealtKey] = useState(null);
  const stage = drawnKey !== game.matchNumber ? "draw" : introKey !== roundKey ? "intro" : dealtKey !== roundKey ? "deal" : "play";
  const drawing = stage === "draw";
  const handleDrawDone = useCallback(() => setDrawnKey(game.matchNumber), [game.matchNumber]);
  const isDealing = stage !== "play";
  const handleIntroDone = useCallback(() => setIntroKey(roundKey), [roundKey]);
  const [dealProgress, setDealProgress] = useState({ key: null, counts: NO_CARDS });
  const dealCounts = dealProgress.key === roundKey ? dealProgress.counts : NO_CARDS;
  const handleDealProgress = useCallback((counts) => setDealProgress({ key: roundKey, counts }), [roundKey]);
  const handleDealComplete = useCallback(() => setDealtKey(roundKey), [roundKey]);

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

  // --- CPU turns, and the pause after a full trick (both wait for the deal) ---
  useEffect(() => {
    if (flying || (isDealing && game.phase !== PHASES.DRAW)) return;
    let run = null;
    let delay = 0;
    if (game.phase === PHASES.DRAW) {
      if (game.players[game.turn].type === "AI") {
        run = (s) => applyAction(s, aiAction(s));
        delay = game.events.at(-1).type === "drawTie" ? TIE_PAUSE : AI_DELAY.DRAW;
      }
    } else if (game.phase === PHASES.TRICK_END) {
      run = collectTrick;
      delay = TRICK_PAUSE;
    } else if (ACTION_PHASES.has(game.phase) && game.players[game.turn]?.type === "AI") {
      run = (s) => applyAction(s, aiAction(s));
      delay = AI_DELAY[game.phase];
    }
    if (!run) return;
    const timer = setTimeout(() => advance(game, run(game)), delay);
    return () => clearTimeout(timer);
  }, [game, isDealing, flying]);

  // --- A finished match is recorded for your profile's stats ---
  useSoloMatchReport({
    prefix: "MU",
    matchNumber: game.matchNumber,
    finished: game.phase === PHASES.MATCH_OVER,
    build: (times) => muushigSoloReport(game, { ...times, me: ME }),
  });

  // --- Your turn: a ping ---
  const myTurn = !isDealing && !flying && ACTION_PHASES.has(game.phase) && game.turn === ME;
  const myDraw = game.phase === PHASES.DRAW && game.turn === ME;
  useEffect(() => {
    if (myTurn || myDraw) safePlay("playTurnAlert");
  }, [turnKey, myTurn, myDraw]);

  // --- Your draw for the deal: how deep into the pile (arrow keys work too) ---
  const [depth, setDepth] = useState(1);
  const drawMax = game.phase === PHASES.DRAW ? maxDrawDepth(game) : 1;
  const pickDepth = Math.min(depth, drawMax);
  useEffect(() => {
    if (!myDraw) return;
    const onKey = (e) => {
      if (e.target.closest?.("input, textarea")) return;
      const step = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.code];
      if (!step) return;
      e.preventDefault();
      setDepth((d) => Math.max(1, Math.min(drawMax, d + step)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [myDraw, drawMax]);

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
        return [logEntry(e, game)].flat().filter(Boolean);
      })
      .flat()
      .map((fields) => ({ id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type: "SYSTEM", timestamp: now(), ...fields }));
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
  const act = (fn, fromRects) => {
    try {
      advance(game, fn(game), fromRects);
    } catch (err) {
      setError({ key: turnKey, text: err.message });
      safePlay("playError");
    }
  };
  const onDraw = () => act((s) => drawForDeal(s, ME, pickDepth));
  const onDecide = (play) => act((s) => decide(s, ME, play), play ? null : handRects(game.players[ME].hand));
  const onSwap = () => act((s) => swap(s, ME, selected.map((c) => c.id)), handRects(selected));
  const onTakeTrump = (cardId) => act((s) => takeTrump(s, ME, cardId), cardId ? handRects(me.hand.filter((c) => c.id === cardId)) : null);
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
  // Mid-flight, piles and hands only change as the cards reach them.
  const incomingLeg = legIndex(flight, (l) => l.to === "seat" || l.to === "hand");
  const drawLeg = legIndex(flight, (l) => l.from === "draw");
  const trumpLeg = legIndex(flight, (l) => l.from === "trump");
  const eatLeg = legIndex(flight, (l) => l.from === "trick");
  const deadLeg = legIndex(flight, (l) => l.to === "dead");
  const deadPending = deadLeg < 0 || flight.leg > deadLeg ? 0 : flight.legs[deadLeg].count - (flight.leg === deadLeg ? flight.landed : 0);
  const drawPending = drawLeg >= 0 && flight.leg < drawLeg ? flight.legs[drawLeg].count : 0;
  const trumpOnFelt = trumpLeg >= 0 && flight.leg < trumpLeg; // the trump card hasn't left yet
  const { phase, trumpSuit } = game;
  // While dealing, each seat holds only the cards that have landed so far.
  // Your cards arrive in a random order and get sorted once the deal ends.
  const myOrder = useMemo(() => dealOrder(game.players[ME].hand, roundKey), [game.players, roundKey]);
  const players = isDealing
    ? game.players.map((p, seat) => ({
        ...p,
        hand: seat === ME ? myOrder.slice(0, dealCounts[seat]).map((i) => p.hand[i]) : p.hand.slice(0, dealCounts[seat]),
      }))
    : flight
      ? game.players.map((p, seat) => {
          if (seat !== flight.seat) return p;
          let q = p;
          // An opponent's fan drops as cards leave and fills as new ones land.
          if (incomingLeg >= 0 && seat !== ME) {
            const landed = flight.leg === incomingLeg ? flight.landed : 0;
            q = { ...q, hand: p.hand.slice(0, p.hand.length - flight.legs[incomingLeg].count + landed) };
          }
          // An eaten pile counts once all of it has landed.
          if (eatLeg >= 0 && flight.landed < flight.legs[eatLeg].count) q = { ...q, eaten: p.eaten - 1 };
          return q;
        })
      : game.players;
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
    [PHASES.DECIDE]: "IN OR FOLD",
    [PHASES.SWAP]: "SWAPPING",
    [PHASES.TRUMP]: "DEALER'S TRUMP",
  }[phase];

  // Status line and buttons for the current phase.
  const pick = selected[0] ? me.hand.find((c) => c.id === selected[0].id) : null;
  let message;
  let warning = null;
  let buttons = [];
  if (drawing) {
    const tie = game.phase === PHASES.DRAW && game.drawPass > 1;
    message =
      game.phase !== PHASES.DRAW
        ? game.dealer === ME
          ? "You drew the highest card: you deal first."
          : `${nameOf(game.dealer)} drew the highest card and deals first.`
        : myDraw
          ? tie
            ? "Tie! Draw again: how deep this time?"
            : `Your draw: how deep into the pile? Take any card from 1 to ${drawMax} down.`
          : `${tie ? "Tie! " : ""}${nameOf(game.turn)} is drawing...`;
    if (myDraw) buttons = [{ label: "TAKE", tone: "gold", primary: true, onClick: onDraw }];
  } else if (isDealing) {
    message = game.dealer === ME ? "You're the dealer this round. Dealing..." : `${nameOf(game.dealer)} is the dealer this round. Dealing...`;
  } else if (!myTurn) {
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
    const block = foldBlock(game, ME);
    const foldable = block === null;
    message =
      block === "streak"
        ? `You folded the last ${MAX_FOLDS_IN_A_ROW} rounds: this time you must go in.`
        : block === "short"
          ? "You must go in: at least 2 players are needed."
          : "Go in this round, or fold and sit it out?";
    buttons = [
      { label: "FOLD", tone: "rose", onClick: () => onDecide(false), disabled: !foldable },
      { label: "GO IN", tone: "green", primary: true, onClick: () => onDecide(true) },
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
    const trumpedIn = followSuit && game.trick.some((p) => p.card.suit === trumpSuit && !p.card.debuffed);
    message = debuffed ? (
      <>
        Your {debuffed.rank}
        <Suit suit={debuffed.suit} size={18} /> is debuffed. You must throw it and lose this pile.
      </>
    ) : !game.trick.length ? (
      "Your lead. Throw any card."
    ) : trumpedIn ? (
      <>
        {eater} trumped in. Play a higher <Suit suit={led} size={18} /> if you have one, else a trump
        <Suit suit={trumpSuit} size={18} />.
      </>
    ) : (
      <>
        {eater} is eating. Play a higher {followSuit ? "" : "trump "}
        <Suit suit={followSuit ? led : trumpSuit} size={18} /> if you have one.
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

  // Each seat's latest debuff this round (the card), to announce it.
  const debuffs = [];
  for (let i = game.events.length - 1; i >= 0 && game.events[i].type !== "round"; i--) {
    const e = game.events[i];
    if (e.type === "debuff") debuffs[e.seat] ??= e.card;
  }

  const seat = (index, position) => {
    const p = players[index];
    const folded = p.status === "fold";
    // During the round's opening banner the dealer's seat lights up instead.
    const introducing = stage === "intro" && index === game.dealer;
    const active = drawing
      ? phase === PHASES.DRAW && index === game.turn
      : introducing || (!isDealing && index === game.turn && ACTION_PHASES.has(phase));
    return (
      <OpponentSection
        player={{ ...p, isEliminated: folded }}
        isActive={active}
        position={position}
        face={faceFor(index)}
        dealSeat={SEAT_POSITIONS[index]}
        chip={
          drawing
            ? active && { label: "DRAW", bg: "#f4c430", blink: true }
            : introducing
            ? { label: "DEALER", bg: "#5fd4d6", fg: "#0a3a3a", blink: true }
            : folded
            ? { label: "FOLD", bg: "#463a78", fg: "#ead8b1" }
            : active
              ? { label: "TURN", bg: "#f4c430", blink: true }
              : p.status === "play" && phase === PHASES.DECIDE
                ? { label: "IN", bg: "#9bd14f", fg: "#1a3a0e" }
                : null
        }
        tag={index === game.dealer && !introducing && !drawing ? { label: "DEAL", bg: "#5fd4d6", fg: "#0a3a3a" } : null}
        detail={<SeatDetail eaten={p.eaten} folded={folded} />}
        callout={
          debuffs[index]
            ? { id: `${roundKey}-debuff-${debuffs[index].id}`, ...DEBUFF_CALLOUT }
            : p.status && { id: `${roundKey}-${p.status}`, ...DECISION[p.status] }
        }
      />
    );
  };

  // The draw for the deal: each seat's latest card, and who's still in it.
  const draws = game.dealDraws ?? [];
  const latestBySeat = new Map();
  draws.forEach((d, i) =>
    latestBySeat.set(d.seat, { key: `${game.matchNumber}-${i}`, seat: SEAT_POSITIONS[d.seat], card: d.card, depth: d.depth }),
  );
  const tieSeats = phase === PHASES.DRAW && game.drawPass > 1 ? game.events.findLast((e) => e.type === "drawTie")?.seats : null;
  const dealDraw = {
    count: game.dealDeck?.length ?? 0,
    draws: [...latestBySeat.values()],
    latest: draws.length ? `${game.matchNumber}-${draws.length - 1}` : null,
    label: phase !== PHASES.DRAW ? "HIGHEST CARD DEALS" : tieSeats ? "TIE · DRAW AGAIN" : "DRAW FOR THE DEAL",
    contenders: tieSeats ? tieSeats.map((s) => SEAT_POSITIONS[s]) : null,
    winner: phase !== PHASES.DRAW ? SEAT_POSITIONS[game.dealer] : null,
  };

  // Your own decision is announced above your hand.
  const myCallout =
    !isDealing && me.status && `${roundKey}-${me.status}` !== myCalloutDone
      ? { id: `${roundKey}-${me.status}`, ...DECISION[me.status] }
      : null;
  const pileW = Math.round(deckW * 0.85);

  // The results wait for the last pile to reach its eater.
  const showResults = (phase === PHASES.ROUND_END || phase === PHASES.MATCH_OVER) && game.roundResults && !flying;
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
            <div className="font-pixel-display text-sm text-glow-gold">{game.roundNumber || "–"}</div>
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
            trumpTakenBy={game.trumpTakenBy !== null && !trumpOnFelt ? nameOf(game.trumpTakenBy) : null}
            trumpRef={trumpRef}
            trickNumber={Math.max(1, game.trickNumber)}
            tricksPerRound={TRICKS_PER_ROUND}
            phaseLabel={drawing || stage === "intro" ? false : isDealing ? `ROUND ${game.roundNumber}` : phaseLabel}
            maxCardWidth={deckW}
            dealing={isDealing}
            centerRef={feltRef}
            dealerSeat={drawing || stage === "intro" ? null : SEAT_POSITIONS[game.dealer]}
            overlay={(cardWidth, diameter) =>
              drawing ? (
                <DealDraw
                  key={game.matchNumber}
                  D={diameter}
                  cw={cardWidth}
                  {...dealDraw}
                  preview={myDraw ? pickDepth : 0}
                  onDone={handleDrawDone}
                />
              ) : stage === "intro" ? (
                <DealerIntro
                  key={roundKey}
                  round={game.roundNumber}
                  dealerName={nameOf(game.dealer)}
                  face={faceFor(game.dealer)}
                  isMe={game.dealer === ME}
                  drawnCard={game.roundNumber === 1 ? game.events.find((e) => e.type === "firstDealer")?.card : null}
                  onDone={handleIntroDone}
                />
              ) : (
                stage === "deal" && (
                  <DealAnimation
                  key={roundKey}
                  dealerIndex={game.dealer}
                  viewIndex={ME}
                  deckWidth={cardWidth}
                  seats={SEAT_POSITIONS}
                  seatRotation={DEAL_ROTATION}
                  seatsIn={ALL_SEATS_IN}
                  cardsPerSeat={5}
                  onDealProgress={handleDealProgress}
                  onComplete={handleDealComplete}
                />
                )
              )
            }
          />

          {/* My hand, with the draw and dead piles in the corner beside it */}
          <div ref={handAreaRef} className="relative">
            {!isDealing && (
              <div className="absolute left-2 bottom-2 z-10">
                <SidePiles
                  drawCount={game.drawPile.length + drawPending}
                  deadCount={game.deadPile.length - deadPending}
                  cardWidth={pileW}
                  drawRef={drawPileRef}
                  deadRef={deadPileRef}
                />
              </div>
            )}
            {myCallout && (
              <Callout key={myCallout.id} {...myCallout} onDone={() => setMyCalloutDone(myCallout.id)} />
            )}
            <PlayerHand
              hand={me.hand}
              selectedCards={selected}
              onSelectionChange={onSelectionChange}
              isActive={canSelect}
              isDealing={isDealing}
              dealOriginRef={feltRef}
              handSize={5}
              cardWidth={handW}
              deckWidth={deckW}
              sortMode={sortMode}
              isPlayable={allowed ? (c) => allowed.has(c.id) : undefined}
              arrival={
                flight?.seat === ME && incomingLeg >= 0
                  ? {
                      ids: flight.incomingIds,
                      originRef: trumpLeg >= 0 ? trumpRef : drawPileRef,
                      sideways: trumpLeg >= 0,
                      faceUp: trumpLeg >= 0,
                      delay: flight.legs.slice(0, incomingLeg).reduce((t, l) => t + legTime(l.count, l.stagger), 0),
                      stagger: STAGGER,
                    }
                  : undefined
              }
            />
          </div>
          <MuushigControls message={message} warning={warning} buttons={buttons} sortMode={sortMode} onSortModeChange={changeSortMode}>
            {myDraw && <DepthPicker depth={pickDepth} max={drawMax} onChange={setDepth} />}
          </MuushigControls>
        </div>

        {/* SIDEBAR */}
        <div className="flex flex-col min-h-0 border-l-4" style={{ borderColor: "#0a0712", background: "#0e0a1f" }}>
          <MuushigScoreBoard
            players={players.map((p) => ({ ...p, folded: p.status === "fold" }))}
            currentPlayerIndex={phase === PHASES.DRAW || (!isDealing && ACTION_PHASES.has(phase)) ? game.turn : -1}
            dealerIndex={drawing ? -1 : game.dealer}
            startScore={START_SCORE}
            myIndex={ME}
            faceFor={faceFor}
          />
          <GameChat messages={messages} onSendMessage={handleSendMessage} avatarFor={avatarFor} colorFor={colorFor} />
        </div>
      </div>

      {flight && (
        <CardFlight
          key={flight.id}
          legs={flight.legs}
          fromRects={flight.fromRects}
          seat={SEAT_POSITIONS[flight.seat]}
          rotation={DEAL_ROTATION[SEAT_POSITIONS[flight.seat]] ?? 0}
          cardWidth={pileW}
          deadRef={deadPileRef}
          drawRef={drawPileRef}
          trumpRef={trumpRef}
          mineRef={handAreaRef}
          onLeg={(leg) => updateFlight(() => ({ leg, landed: 0 }))}
          onLand={() => updateFlight((f) => ({ landed: f.landed + 1 }))}
          onDone={() => setFlight(null)}
        />
      )}

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

// How deep into the pile you draw for the deal.
function DepthPicker({ depth, max, onChange }) {
  const step = { backgroundColor: "#463a78", borderColor: "#2a234d", color: "#ead8b1" };
  return (
    <div className="flex items-stretch gap-1 p-1" role="group" aria-label="How deep to draw" style={{ backgroundColor: "#0a0712", border: "3px solid #1f1a3d" }}>
      <span className="font-pixel-display text-[10px] text-bone/60 self-center px-2">DEPTH</span>
      <button
        onClick={() => onChange(Math.max(1, depth - 1))}
        disabled={depth <= 1}
        className="pixel-btn font-pixel-display text-[12px] px-3 py-2"
        style={step}
        aria-label="Shallower"
      >
        −
      </button>
      <span className="font-pixel-display text-sm text-glow-gold self-center text-center" style={{ minWidth: 36 }} aria-live="polite">
        {depth}
      </span>
      <button
        onClick={() => onChange(Math.min(max, depth + 1))}
        disabled={depth >= max}
        className="pixel-btn font-pixel-display text-[12px] px-3 py-2"
        style={step}
        aria-label="Deeper"
      >
        +
      </button>
    </div>
  );
}

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
