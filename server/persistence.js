// SUPABASE PERSISTENCE — token verification and match recording.
// The realtime game itself never touches the database (see ARCHITECTURE.md);
// Supabase is only used to verify JWTs on connect and to write results when a
// match finishes.

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

/**
 * Records a finished match: one game_sessions row, one game_players row per
 * human seat, and profile stat updates for signed-in players.
 *
 * @param {Object} rec
 * @param {String} rec.lobbyId
 * @param {String} rec.lobbyName
 * @param {Boolean} rec.isPrivate
 * @param {String|null} rec.hostUserId
 * @param {String} rec.hostDisplayName
 * @param {Date} rec.startedAt
 * @param {Date} rec.finishedAt
 * @param {Array} rec.seats - { seatIndex, userId|null, name, tag }
 * @param {Object} rec.state - final game state
 */
export async function recordMatch(rec) {
  if (!supabaseAdmin) return;

  const { state, seats } = rec;
  // Rank all 4 seats: match winner first, then by score ascending (lower = better).
  const ranking = state.players
    .map((p, i) => ({ i, p }))
    .sort((a, b) => {
      if (a.p.isEliminated !== b.p.isEliminated) return a.p.isEliminated ? 1 : -1;
      return a.p.score - b.p.score;
    });
  const positionBySeat = {};
  ranking.forEach((entry, rank) => {
    positionBySeat[entry.i] = rank + 1;
  });

  const { data: session, error: sessionError } = await supabaseAdmin
    .from("game_sessions")
    .insert({
      game_type: "thirteen",
      status: "finished",
      host_id: rec.hostUserId,
      host_display_name: rec.hostDisplayName,
      name: rec.lobbyName,
      is_private: !!rec.isPrivate,
      lobby_code: rec.lobbyId,
      max_players: 4,
      current_player_count: seats.length,
      started_at: rec.startedAt?.toISOString(),
      finished_at: rec.finishedAt?.toISOString() || new Date().toISOString(),
    })
    .select("id")
    .single();

  if (sessionError) {
    console.error("[supabase] failed to insert game_sessions:", sessionError.message);
    return;
  }

  const playerRows = seats.map((seat) => {
    const position = positionBySeat[seat.seatIndex];
    const reward = REWARDS[position - 1] || REWARDS[REWARDS.length - 1];
    return {
      session_id: session.id,
      player_id: seat.userId || null,
      guest_name: seat.userId ? null : seat.name,
      guest_tag: seat.userId ? null : seat.tag,
      seat_index: seat.seatIndex,
      final_score: state.players[seat.seatIndex].score,
      final_position: position,
      is_winner: position === 1,
      coins_earned: reward.coins,
      exp_earned: reward.exp,
    };
  });

  if (playerRows.length) {
    const { error: playersError } = await supabaseAdmin
      .from("game_players")
      .insert(playerRows);
    if (playersError) {
      console.error("[supabase] failed to insert game_players:", playersError.message);
    }
  }

  // Update profile stats for signed-in players.
  for (const row of playerRows) {
    if (!row.player_id) continue;
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("coins, exp, wins, games_played")
      .eq("id", row.player_id)
      .single();
    if (profileError || !profile) continue;

    const exp = profile.exp + row.exp_earned;
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        coins: profile.coins + row.coins_earned,
        exp,
        level: levelForExp(exp),
        wins: profile.wins + (row.is_winner ? 1 : 0),
        games_played: profile.games_played + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.player_id);
    if (updateError) {
      console.error("[supabase] failed to update profile:", updateError.message);
    }
  }

  console.log(
    `[supabase] recorded match ${session.id} (lobby ${rec.lobbyId}, ${seats.length} human players)`,
  );
}
