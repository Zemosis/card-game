// ACCOUNTS — email/password sign-up, JWT sessions, and profile reads/writes.
// Replaces Supabase Auth. Tokens are HS256 JWTs signed with JWT_SECRET; the
// same token authenticates both these HTTP routes and the socket handshake.

import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool, withTransaction } from "./db/index.js";

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_TTL = "30d";

if (pool && !JWT_SECRET) {
  throw new Error("JWT_SECRET must be set when DATABASE_URL is configured");
}

// The only profile columns a client may write. Coins, exp, level, wins,
// games_played and rating are awarded by the game server alone.
const EDITABLE_PROFILE_FIELDS = ["username", "tag", "avatar", "custom_avatar", "custom_colors"];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

/** Returns { id, email } for a valid token, or null for guests/invalid tokens. */
export function verifyToken(token) {
  if (!JWT_SECRET || !token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return { id: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

function requireUser(req, res, next) {
  const header = req.get("authorization") || "";
  const user = verifyToken(header.replace(/^Bearer\s+/i, ""));
  if (!user) return res.status(401).json({ error: "Not signed in" });
  req.user = user;
  next();
}

function requireDb(_req, res, next) {
  if (!pool) return res.status(503).json({ error: "Accounts are not available on this server" });
  next();
}

async function getProfile(userId) {
  const { rows } = await pool.query("select * from profiles where id = $1", [userId]);
  return rows[0] || null;
}

/** Maps Postgres constraint violations to messages a player can act on. */
function profileError(err) {
  if (err.code === "23505") return "That name#tag is already taken";
  if (err.code === "23514") {
    if (err.constraint === "profiles_username_length") return "Name must be 1–6 characters";
    if (err.constraint === "profiles_tag_format") return "Tag must be 4 letters or digits";
    if (err.constraint === "profiles_custom_colors_limit") return "Too many saved colors";
    return "Invalid profile data";
  }
  return null;
}

export const authRouter = express.Router();
authRouter.use(express.json({ limit: "32kb" }), requireDb);

authRouter.post("/signup", async (req, res) => {
  const email = String(req.body?.email || "").trim();
  const password = String(req.body?.password || "");
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Enter a valid email" });
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const { user, profile } = await withTransaction(async (client) => {
      const {
        rows: [user],
      } = await client.query(
        "insert into users (email, password_hash) values ($1, $2) returning id, email",
        [email, passwordHash],
      );
      const {
        rows: [profile],
      } = await client.query("insert into profiles (id) values ($1) returning *", [user.id]);
      return { user, profile };
    });
    res.status(201).json({ token: signToken(user), user, profile });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Email already registered" });
    console.error("[auth] signup failed:", err);
    res.status(500).json({ error: "Sign up failed" });
  }
});

authRouter.post("/login", async (req, res) => {
  const email = String(req.body?.email || "").trim();
  const password = String(req.body?.password || "");

  const {
    rows: [row],
  } = await pool.query(
    "select id, email, password_hash from users where lower(email) = lower($1)",
    [email],
  );
  if (!row || !(await bcrypt.compare(password, row.password_hash))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const user = { id: row.id, email: row.email };
  res.json({ token: signToken(user), user, profile: await getProfile(user.id) });
});

authRouter.get("/me", requireUser, async (req, res) => {
  const profile = await getProfile(req.user.id);
  if (!profile) return res.status(401).json({ error: "Account no longer exists" });
  res.json({ user: req.user, profile });
});

// Everything the profile page charts, in one round trip. All of it is derived
// from the match rows by the views in 001_initial.sql.
const HISTORY_LIMIT = 30;

authRouter.get("/stats", requireUser, async (req, res) => {
  const id = req.user.id;
  const [stats, streaks, gameTypes, placements, history] = await Promise.all([
    pool.query("select * from player_stats where player_id = $1", [id]),
    pool.query("select * from player_streaks where player_id = $1", [id]),
    pool.query(
      "select * from player_game_type_stats where player_id = $1 order by game_type",
      [id],
    ),
    pool.query(
      `select final_position, sum(times)::int as times
         from player_placement_stats where player_id = $1
        group by final_position order by final_position`,
      [id],
    ),
    pool.query(
      `select session_id, game_type, final_position, final_score, is_winner,
              left_early, rating_after, rating_delta, coins_earned, exp_earned,
              finished_at, duration_seconds
         from player_match_history where player_id = $1
        order by finished_at desc limit $2`,
      [id, HISTORY_LIMIT],
    ),
  ]);

  res.json({
    stats: stats.rows[0] || null,
    streaks: streaks.rows[0] || null,
    gameTypes: gameTypes.rows,
    placements: placements.rows,
    // Oldest first, which is the order a chart reads left to right.
    history: history.rows.reverse(),
  });
});

authRouter.patch("/profile", requireUser, async (req, res) => {
  const updates = Object.entries(req.body || {}).filter(([key]) =>
    EDITABLE_PROFILE_FIELDS.includes(key),
  );
  if (!updates.length) return res.json({ profile: await getProfile(req.user.id) });

  const sets = updates.map(([key], i) => `${key} = $${i + 2}`).join(", ");
  const values = updates.map(([key, value]) =>
    key === "custom_avatar" && value != null ? JSON.stringify(value) : value,
  );

  try {
    const { rows } = await pool.query(
      `update profiles set ${sets} where id = $1 returning *`,
      [req.user.id, ...values],
    );
    res.json({ profile: rows[0] });
  } catch (err) {
    const message = profileError(err);
    if (message) return res.status(400).json({ error: message });
    console.error("[auth] profile update failed:", err);
    res.status(500).json({ error: "Profile update failed" });
  }
});
