// THIRTEEN GAME ENGINE — server-authoritative wrapper around the pure game logic.
// One instance per lobby. Owns the full (secret) game state, schedules CPU turns
// and round transitions, and reports every state change through onState.

import { initializeGame, findPlayerWithCard } from "./deckUtils.js";
import {
  createGameState,
  playCards,
  passAction,
  startNextRound,
} from "./gameLogic.js";
import { makeAIDecision } from "./aiPlayer.js";
import { GAME_STATES } from "./constants.js";

const AI_TURN_DELAY = 1500;
// Client round-end overlay shows for ~4s before expecting the next round.
const ROUND_END_DELAY = 4500;
// Client deal animation (shuffle + 52 cards + sort) runs ~3s; CPUs wait it out.
const DEAL_ANIMATION_DELAY = 4000;

const cardValue = (card) => card.rankValue * 4 + card.suitValue;

export class ThirteenGame {
  /**
   * @param {Object} opts
   * @param {Array} opts.seats - 4 entries of { type: "HUMAN"|"AI", name, socketId }
   * @param {String} opts.aiDifficulty
   * @param {Function} opts.onState - called after every state change
   * @param {Function} opts.onGameOver - called once per finished match
   */
  constructor({ seats, aiDifficulty = "MEDIUM", onState, onGameOver }) {
    this.onState = onState;
    this.onGameOver = onGameOver;
    this.aiTimer = null;
    this.roundTimer = null;
    this.destroyed = false;
    this.state = null;
    this.startMatch(seats, { matchNumber: 1, matchWins: [0, 0, 0, 0] }, aiDifficulty);
  }

  startMatch(seats, matchMeta, aiDifficulty) {
    const { hands } = initializeGame();
    const starting = findPlayerWithCard(hands, "3", "♦");
    const state = createGameState(
      hands,
      starting >= 0 ? starting : 0,
      aiDifficulty || this.state?.aiDifficulty,
      matchMeta,
    );
    state.players = state.players.map((p, i) => ({
      ...p,
      name: seats[i].name,
      type: seats[i].type,
      socketId: seats[i].socketId || null,
    }));
    this.startedAt = new Date();
    this.finishedAt = null;
    this.state = state;
    this.broadcast();
    this.scheduleAI(DEAL_ANIMATION_DELAY);
  }

  rematch() {
    if (!this.state || this.state.gameState !== GAME_STATES.GAME_OVER) {
      return { ok: false, error: "Match is still in progress" };
    }
    const seats = this.state.players.map((p) => ({
      type: p.type,
      name: p.name,
      socketId: p.socketId,
    }));
    const matchMeta = {
      matchNumber: (this.state.matchNumber || 1) + 1,
      matchWins: this.state.matchWins || [0, 0, 0, 0],
    };
    this.clearTimers();
    this.startMatch(seats, matchMeta);
    return { ok: true };
  }

  /** A verified player move. cards may be card objects or card id strings. */
  handleMove(seatIndex, action, cards) {
    const s = this.state;
    if (!s || s.gameState !== GAME_STATES.PLAYING) {
      return { ok: false, error: "Game is not active" };
    }
    if (s.currentPlayerIndex !== seatIndex) {
      return { ok: false, error: "Not your turn" };
    }
    const player = s.players[seatIndex];
    if (player.isEliminated) {
      return { ok: false, error: "You are eliminated" };
    }

    if (action === "pass") {
      if (!s.currentPlay) {
        return { ok: false, error: "You lead the trick — you must play" };
      }
      this.applyState(passAction(s));
      return { ok: true };
    }

    if (action === "play") {
      const ids = (cards || []).map((c) => (typeof c === "string" ? c : c?.id));
      if (!ids.length || ids.some((id) => !id)) {
        return { ok: false, error: "No cards selected" };
      }
      if (new Set(ids).size !== ids.length) {
        return { ok: false, error: "Duplicate cards in selection" };
      }
      // Anti-cheat: resolve ids against the server-side hand, never trust
      // card objects sent by the client.
      const selected = ids.map((id) => player.hand.find((c) => c.id === id));
      if (selected.some((c) => !c)) {
        return { ok: false, error: "Those cards are not in your hand" };
      }
      const result = playCards(s, selected);
      if (!result.success) {
        return { ok: false, error: result.error };
      }
      this.applyState(result.newState);
      return { ok: true };
    }

    return { ok: false, error: "Unknown action" };
  }

  /** Swap a seat's occupant (player join/rejoin or CPU takeover on disconnect). */
  replaceSeat(seatIndex, { type, name, socketId }) {
    const s = this.state;
    if (!s || !s.players[seatIndex]) return;
    s.players = s.players.map((p, i) =>
      i === seatIndex ? { ...p, type, name, socketId: socketId || null } : p,
    );
    this.broadcast();
    this.scheduleAI();
  }

  applyState(next) {
    this.state = next;
    this.broadcast();
    if (next.gameState === GAME_STATES.ROUND_END) {
      this.roundTimer = setTimeout(() => {
        this.roundTimer = null;
        if (!this.destroyed) this.beginNextRound();
      }, ROUND_END_DELAY);
    } else if (next.gameState === GAME_STATES.GAME_OVER) {
      this.finishedAt = new Date();
      this.clearAITimer();
      if (this.onGameOver) this.onGameOver(this);
    } else {
      this.scheduleAI();
    }
  }

  beginNextRound() {
    const { hands } = initializeGame();
    this.state = startNextRound(this.state, hands);
    this.broadcast();
    this.scheduleAI(DEAL_ANIMATION_DELAY);
  }

  scheduleAI(delay = AI_TURN_DELAY) {
    this.clearAITimer();
    const s = this.state;
    if (!s || s.gameState !== GAME_STATES.PLAYING) return;
    const current = s.players[s.currentPlayerIndex];
    if (current.type !== "AI" || current.isEliminated) return;
    this.aiTimer = setTimeout(() => {
      this.aiTimer = null;
      if (!this.destroyed) this.playAITurn();
    }, delay);
  }

  playAITurn() {
    const s = this.state;
    if (!s || s.gameState !== GAME_STATES.PLAYING) return;
    const current = s.players[s.currentPlayerIndex];
    if (current.type !== "AI") return;

    let next = null;
    try {
      const decision = makeAIDecision(current, s.currentPlay, s);
      if (decision.action === "play" && decision.cards?.length) {
        const result = playCards(s, decision.cards);
        next = result.success ? result.newState : null;
      }
    } catch (err) {
      console.error("AI decision failed:", err);
    }

    if (!next) {
      if (s.currentPlay) {
        next = passAction(s);
      } else {
        // Leading a trick: passing is illegal, fall back to lowest single.
        const lowest = [...current.hand].sort((a, b) => cardValue(a) - cardValue(b))[0];
        const result = playCards(s, [lowest]);
        next = result.success ? result.newState : passAction(s);
      }
    }
    this.applyState(next);
  }

  broadcast() {
    if (this.onState) this.onState(this);
  }

  clearAITimer() {
    if (this.aiTimer) {
      clearTimeout(this.aiTimer);
      this.aiTimer = null;
    }
  }

  clearTimers() {
    this.clearAITimer();
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
      this.roundTimer = null;
    }
  }

  destroy() {
    this.destroyed = true;
    this.clearTimers();
  }
}

/**
 * Strips hidden information before sending state to one client.
 * Every hand except the recipient's is replaced with placeholder cards so the
 * UI can still render card backs / counts. seatIndex -1 = spectator.
 */
export function redactState(state, seatIndex) {
  return {
    ...state,
    players: state.players.map((p, i) =>
      i === seatIndex
        ? p
        : { ...p, hand: p.hand.map(() => ({ hidden: true })) },
    ),
  };
}
