// SUPABASE PERSISTENCE — token verification and match recording.
// The realtime game itself never touches the database (see docs/ARCHITECTURE.md);
// Supabase is only used to verify JWTs on connect and to record matches.
//
// A session row is written when the match STARTS and updated when it ends, so
// abandoned matches leave a trace instead of vanishing. Player rows come from
// the lobby's roster (every seat that was ever occupied) rather than from the
// live member map, which drops players the moment they quit.

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };

// Admin client (bypasses RLS) — only available when the service role key is set.
export const supabaseAdmin =
  url && serviceRoleKey ? createClient(url, serviceRoleKey, clientOptions) : null;

// Auth verification works with the anon key too, so guests-only setups still
// get JWT validation even before the service role key is configured.
const supabaseAuth =
  url && (serviceRoleKey || anonKey)
    ? createClient(url, serviceRoleKey || anonKey, clientOptions)
    : null;

if (!supabaseAuth) {
  console.warn(
    "[supabase] SUPABASE_URL / keys not configured — all connections treated as guests.",
  );
}
if (!supabaseAdmin) {
  console.warn(
    "[supabase] SUPABASE_SERVICE_ROLE_KEY not set — match results will NOT be recorded.",
  );
}

/** Returns the Supabase user for a JWT, or null for guests/invalid tokens. */
export async function verifyToken(token) {
  if (!supabaseAuth || !token) return null;
  try {
    const { data, error } = await supabaseAuth.auth.getUser(token);
    return error ? null : data.user;
  } catch {
    return null;
  }
}

// Rewards by final position (1st..4th). Level-ups come from exp: 100 exp/level.
const REWARDS = [
  { coins: 100, exp: 60 },
  { coins: 50, exp: 35 },
  { coins: 25, exp: 20 },
  { coins: 10, exp: 10 },
];

const levelForExp = (exp) => Math.floor(exp / 100) + 1;

// Elo. Pairwise across the rated field, averaged — the standard extension of
// two-player Elo to a placement result. Only signed-in players are rated, so
// you cannot farm rating off CPUs or guests; with fewer than two, nobody moves.
const K_FACTOR = 32;
export const DEFAULT_RATING = 1000;

export function computeRatingDeltas(entries) {
  const deltas = new Map();
  if (entries.length < 2) return deltas;

  for (const a of entries) {
    let sum = 0;
    for (const b of entries) {
      if (a.playerKey === b.playerKey) continue;
      const expected = 1 / (1 + 10 ** ((b.rating - a.rating) / 400));
      const actual = a.position < b.position ? 1 : a.position > b.position ? 0 : 0.5;
      sum += actual - expected;
    }
    deltas.set(a.playerKey, Math.round((K_FACTOR * sum) / (entries.length - 1)));
  }
  return deltas;
}

/**
 * Inserts the session row at match start. Returns the new session id, or null
 * if persistence is unconfigured (in which case the match still runs fine).
 */
export async function createSession({
  gameType = "thirteen",
  lobbyId,
  lobbyName,
  isPrivate,
  hostUserId,
  hostDisplayName,
  maxPlayers = 4,
  playerCount = 0,
  startedAt,
}) {
  if (!supabaseAdmin) return null;

  const { data, error } = await supabaseAdmin
    .from("game_sessions")
    .insert({
      game_type: gameType,
      status: "in_progress",
      host_id: hostUserId,
      host_display_name: hostDisplayName,
      name: lobbyName,
      is_private: !!isPrivate,
      lobby_code: lobbyId,
      max_players: maxPlayers,
      current_player_count: playerCount,
      started_at: (startedAt || new Date()).toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("[supabase] failed to insert game_sessions:", error.message);
    return null;
  }
  return data.id;
}

/** Ranks seats: not-eliminated first, then by score ascending (lower is better). */
function rankSeats(state) {
  const positionBySeat = {};
  state.players
    .map((p, i) => ({ i, p }))
    .sort((a, b) => {
      if (a.p.isEliminated !== b.p.isEliminated) return a.p.isEliminated ? 1 : -1;
      return a.p.score - b.p.score;
    })
    .forEach((entry, rank) => {
      positionBySeat[entry.i] = rank + 1;
    });
  return positionBySeat;
}

/**
 * Closes out a session: updates the session row, writes one game_players row
 * per roster entry, and applies rewards + rating to signed-in players.
 *
 * Rewards and rating are applied ONLY when the match actually finished. An
 * abandoned match records what happened but produces no result.
 *
 * @param {Object} rec
 * @param {String}  rec.sessionId
 * @param {Boolean} rec.completed   - true if the match played to game over
 * @param {String}  rec.endedReason - 'completed' | 'abandoned' | 'all_left'
 * @param {Date}    rec.finishedAt
 * @param {Array}   rec.roster - every seat ever occupied: { playerKey, userId,
 *                  name, tag, seatIndex, joinedAt, leftAt, leftEarly,
 *                  cpuTookOver, disconnectCount }
 * @param {Array}   rec.rounds - per-round summaries from the engine
 * @param {Object}  rec.state - final game state
 */
export async function finishSession(rec) {
  if (!supabaseAdmin || !rec.sessionId) return;

  const { state, roster, completed } = rec;
  const finishedAt = (rec.finishedAt || new Date()).toISOString();
  const positionBySeat = completed && state ? rankSeats(state) : {};

  const { error: sessionError } = await supabaseAdmin
    .from("game_sessions")
    .update({
      status: completed ? "finished" : "abandoned",
      ended_reason: rec.endedReason || (completed ? "completed" : "abandoned"),
      round_count: state?.roundNumber ?? null,
      current_player_count: roster.length,
      finished_at: finishedAt,
    })
    .eq("id", rec.sessionId);

  if (sessionError) {
    console.error("[supabase] failed to update game_sessions:", sessionError.message);
  }

  // Round-level history. Written before the player rows so rounds_won and the
  // stats blob can be derived from the same source.
  const rounds = rec.rounds || [];
  if (rounds.length) {
    const { error } = await supabaseAdmin.from("game_rounds").upsert(
      rounds.map((r) => ({
        session_id: rec.sessionId,
        round_number: r.roundNumber,
        winner_seat: r.winnerSeat,
        seat_results: r.seatResults,
      })),
      { onConflict: "session_id,round_number" },
    );
    if (error) {
      console.error("[supabase] failed to write game_rounds:", error.message);
    }
  }

  /** Per-seat round aggregates, derived from the round summaries. */
  function roundStatsFor(seatIndex) {
    let roundsWon = 0;
    let roundsPlayed = 0;
    let cardsLeftTotal = 0;
    let bestRoundCardsLeft = null;
    let eliminatedAtRound = null;

    for (const round of rounds) {
      const seat = round.seatResults.find((x) => x.seat_index === seatIndex);
      if (!seat) continue;
      roundsPlayed += 1;
      if (round.winnerSeat === seatIndex) roundsWon += 1;
      cardsLeftTotal += seat.cards_left;
      if (bestRoundCardsLeft === null || seat.cards_left < bestRoundCardsLeft) {
        bestRoundCardsLeft = seat.cards_left;
      }
      if (seat.eliminated && eliminatedAtRound === null) {
        eliminatedAtRound = round.roundNumber;
      }
    }

    return {
      roundsWon,
      stats: rounds.length
        ? {
            rounds_played: roundsPlayed,
            rounds_won: roundsWon,
            cards_left_total: cardsLeftTotal,
            best_round_cards_left: bestRoundCardsLeft,
            eliminated_at_round: eliminatedAtRound,
          }
        : null,
    };
  }

  // Current ratings for the signed-in players, fetched in one round trip.
  const userIds = roster.map((r) => r.userId).filter(Boolean);
  const profiles = new Map();
  if (userIds.length) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, coins, exp, wins, games_played, rating")
      .in("id", userIds);
    if (error) {
      console.error("[supabase] failed to read profiles:", error.message);
    } else {
      for (const p of data) profiles.set(p.id, p);
    }
  }

  // Rating only moves on a completed match, and only among signed-in players.
  const ratingDeltas = completed
    ? computeRatingDeltas(
        roster
          .filter((r) => r.userId && positionBySeat[r.seatIndex])
          .map((r) => ({
            playerKey: r.playerKey,
            rating: profiles.get(r.userId)?.rating ?? DEFAULT_RATING,
            position: positionBySeat[r.seatIndex],
          })),
      )
    : new Map();

  const playerRows = roster.map((seat) => {
    const position = completed ? positionBySeat[seat.seatIndex] ?? null : null;
    const reward = completed && position ? REWARDS[position - 1] || REWARDS.at(-1) : null;
    const profile = seat.userId ? profiles.get(seat.userId) : null;
    const before = profile?.rating ?? (seat.userId ? DEFAULT_RATING : null);
    const delta = ratingDeltas.get(seat.playerKey);
    const roundStats = roundStatsFor(seat.seatIndex);

    return {
      session_id: rec.sessionId,
      player_key: seat.playerKey,
      player_id: seat.userId || null,
      guest_name: seat.userId ? null : seat.name,
      guest_tag: seat.userId ? null : seat.tag,
      seat_index: seat.seatIndex,
      final_score: state?.players?.[seat.seatIndex]?.score ?? null,
      final_position: position,
      is_winner: position === 1,
      coins_earned: reward?.coins ?? 0,
      exp_earned: reward?.exp ?? 0,
      joined_at: seat.joinedAt ? new Date(seat.joinedAt).toISOString() : null,
      left_at: seat.leftAt ? new Date(seat.leftAt).toISOString() : null,
      left_early: !!seat.leftEarly,
      cpu_took_over: !!seat.cpuTookOver,
      disconnect_count: seat.disconnectCount || 0,
      rating_before: before,
      rating_after: delta == null ? before : before + delta,
      rounds_won: roundStats.roundsWon,
      stats: roundStats.stats,
    };
  });

  if (playerRows.length) {
    const { error } = await supabaseAdmin
      .from("game_players")
      .upsert(playerRows, { onConflict: "session_id,player_key" });
    if (error) {
      console.error("[supabase] failed to write game_players:", error.message);
    }
  }

  if (!completed) {
    console.log(`[supabase] session ${rec.sessionId} closed as abandoned`);
    return;
  }

  // Progression for signed-in players.
  for (const row of playerRows) {
    if (!row.player_id) continue;
    const profile = profiles.get(row.player_id);
    if (!profile) continue;

    const exp = profile.exp + row.exp_earned;
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        coins: profile.coins + row.coins_earned,
        exp,
        level: levelForExp(exp),
        wins: profile.wins + (row.is_winner ? 1 : 0),
        games_played: profile.games_played + 1,
        rating: row.rating_after ?? profile.rating,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.player_id);
    if (error) {
      console.error("[supabase] failed to update profile:", error.message);
    }
  }

  console.log(
    `[supabase] recorded match ${rec.sessionId} (${playerRows.length} seats, ` +
      `${rounds.length} rounds, ` +
      `${playerRows.filter((r) => r.left_early).length} left early)`,
  );
}
