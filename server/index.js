// KHUZUR CARD HALL — authoritative game server.
// All game state lives in RAM here. Clients only send move requests; the
// server validates everything and emits redacted state (hidden hands stripped).

import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import { ThirteenGame, redactState, DEFAULT_DELAYS } from "./game/engine.js";
import { createSession, finishSession, closeOrphanedSessions } from "./persistence.js";
import { authRouter, verifyToken } from "./auth.js";
import { migrate, pool } from "./db/index.js";

const PORT = process.env.PORT || 3001;
const CORS_ORIGINS = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim());

const envMs = (name, fallback) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= 0 && process.env[name] !== "" ? n : fallback;
};

// How long a disconnected player keeps their seat before a CPU takes over.
const DISCONNECT_GRACE_MS = envMs("DISCONNECT_GRACE_MS", 60_000);
// Engine pacing. Unset means the engine's defaults; the test suite shortens them.
const GAME_DELAYS = {
  aiTurn: envMs("AI_TURN_DELAY_MS", DEFAULT_DELAYS.aiTurn),
  roundEnd: envMs("ROUND_END_DELAY_MS", DEFAULT_DELAYS.roundEnd),
  deal: envMs("DEAL_DELAY_MS", DEFAULT_DELAYS.deal),
};

const app = express();
app.use(cors({ origin: CORS_ORIGINS }));
app.get("/", (_req, res) => res.json({ ok: true, service: "card-game-server" }));
app.use("/api/auth", authRouter);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CORS_ORIGINS, methods: ["GET", "POST"] },
});

/**
 * lobbies: Map<lobbyId, {
 *   id, name, isPrivate, maxPlayers, hostKey, createdAt, startedAt,
 *   members: Map<playerKey, {
 *     key, userId, name, tag, displayName,
 *     socketId, connected, seatIndex, disconnectTimer
 *   }>,
 *   seats: Array(4) of { kind: "human", key } | { kind: "cpu", name } | null,
 *     // who sits where while the table waits; frozen into the game at start
 *   roster: Map<playerKey, seat ledger>,   // never pruned — see below
 *   rounds: Array<round summary>,
 *   sessionPromise, recorded,
 *   game: ThirteenGame | null
 * }>
 *
 * `members` is the LIVE connection map and loses a player the moment they quit.
 * `roster` is the recording ledger: every seat ever occupied for the current
 * match, kept until the session is written. Recording from `members` is what
 * previously made quitters vanish from match history entirely.
 */
const lobbies = new Map();

// ---------- AUTH MIDDLEWARE ----------
// Signed-in players pass their JWT from /api/auth; guests pass name + tag.
// Identity (playerKey) is what survives refreshes and reconnects.
io.use(async (socket, next) => {
  const { token, name, tag, avatar } = socket.handshake.auth || {};
  const user = verifyToken(token);

  const safeName = String(name || "PLAYER").slice(0, 12);
  const safeTag = String(tag || "0000").slice(0, 4);

  socket.data.userId = user?.id || null;
  socket.data.name = safeName;
  socket.data.tag = safeTag;
  socket.data.displayName = `${safeName} #${safeTag}`;
  socket.data.playerKey = user?.id || `guest:${safeName}#${safeTag}`;
  socket.data.avatar = await loadAvatar(user, avatar);
  next();
});

// ---------- HELPERS ----------

const PRESET_AVATARS = new Set(["1", "2", "3", "4", "5"]);

/**
 * The avatar other players see at the table: { variant, custom }.
 * Signed-in players get what their profile says (painted avatars were already
 * shape-checked by the profiles constraint); guests may only pick a preset.
 */
async function loadAvatar(user, requested) {
  if (user && pool) {
    try {
      const { rows } = await pool.query("select avatar, custom_avatar from profiles where id = $1", [user.id]);
      if (rows[0]) {
        const custom = rows[0].avatar === "custom" ? rows[0].custom_avatar : null;
        return { variant: custom ? "custom" : rows[0].avatar, custom };
      }
    } catch (err) {
      console.error("[auth] avatar lookup failed:", err.message);
    }
  }
  const preset = String(requested ?? "");
  return { variant: PRESET_AVATARS.has(preset) ? preset : "1", custom: null };
}

const makeLobbyId = (isPrivate) => {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  return isPrivate ? code : `PUB-${code}`;
};

const SEATS = 4;

// The 6 characters people type or share; public ids carry a "PUB-" prefix.
const shareCode = (id) => id.replace(/^PUB-/, "");

/** "CPU n" with the lowest n not already used at this table. */
function nextCpuName(seats) {
  const used = new Set(seats.filter((s) => s?.kind === "cpu").map((s) => s.name));
  let n = 1;
  while (used.has(`CPU ${n}`)) n++;
  return `CPU ${n}`;
}

/** Seats a member at a waiting table: first empty seat, else bumps a CPU. */
function takeSeat(lobby, member) {
  let i = lobby.seats.findIndex((s) => s === null);
  if (i === -1) i = lobby.seats.findIndex((s) => s?.kind === "cpu");
  if (i === -1) return false;
  lobby.seats[i] = { kind: "human", key: member.key };
  member.seatIndex = i;
  return true;
}

/** The waiting table as one member sees it. Never includes player keys. */
function tableViewFor(lobby, member) {
  return {
    lobbyId: lobby.id,
    name: lobby.name,
    isPrivate: lobby.isPrivate,
    status: "waiting",
    code: shareCode(lobby.id),
    mySeat: member.seatIndex,
    isHost: lobby.hostKey === member.key,
    seats: lobby.seats.map((s) => {
      if (!s) return null;
      if (s.kind === "cpu") return { kind: "cpu", name: s.name };
      const m = lobby.members.get(s.key);
      return {
        kind: "human",
        name: m?.displayName || "?",
        avatar: m?.avatar || null,
        isHost: lobby.hostKey === s.key,
        connected: !!m?.connected,
      };
    }),
  };
}

/** Sends every connected member of a WAITING table their view of it. */
function broadcastTable(lobby) {
  if (lobby.game) return;
  for (const member of lobby.members.values()) {
    if (!member.connected || !member.socketId) continue;
    io.to(member.socketId).emit("table_update", tableViewFor(lobby, member));
  }
}

function sendTableTo(lobby, socket) {
  if (lobby.game) return;
  const member = lobby.members.get(socket.data.playerKey);
  if (member) socket.emit("table_update", tableViewFor(lobby, member));
}

function publicLobbyList() {
  return [...lobbies.values()]
    .filter((l) => !l.isPrivate)
    .map((l) => {
      const host = l.members.get(l.hostKey);
      return {
        id: l.id,
        name: l.name,
        host: host?.displayName || "?",
        current: l.members.size,
        max: l.maxPlayers,
        inProgress: !!l.game,
      };
    });
}

function broadcastLobbyList() {
  io.emit("public_lobbies_update", publicLobbyList());
}

function addMember(lobby, socket) {
  const member = {
    key: socket.data.playerKey,
    userId: socket.data.userId,
    name: socket.data.name,
    tag: socket.data.tag,
    displayName: socket.data.displayName,
    avatar: socket.data.avatar,
    socketId: socket.id,
    connected: true,
    seatIndex: null,
    disconnectTimer: null,
  };
  lobby.members.set(member.key, member);
  return member;
}

/**
 * Sends each lobby member their own redacted view of the game state.
 *
 * `game` is passed explicitly because the very first broadcast happens INSIDE
 * the ThirteenGame constructor, before `lobby.game` has been assigned. Reading
 * lobby.game here dropped that initial deal on every single match: clients only
 * recovered when the first AI move triggered another broadcast ~4s later, and
 * when a human held the opening turn no AI was scheduled, so nothing ever
 * arrived and the board stayed blank.
 */
function broadcastState(lobby, game = lobby.game) {
  if (!game) return;
  const state = game.state;
  for (const member of lobby.members.values()) {
    if (!member.connected || !member.socketId) continue;
    const seat = member.seatIndex ?? -1;
    io.to(member.socketId).emit("game_state_update", redactState(state, seat));
  }
}

function sendStateTo(lobby, socket) {
  if (!lobby.game) return;
  const member = lobby.members.get(socket.data.playerKey);
  const seat = member?.seatIndex ?? -1;
  socket.emit("game_state_update", redactState(lobby.game.state, seat));
}

/** Adds (or refreshes) a seat in the recording ledger. Never removes. */
function rosterEnter(lobby, member) {
  if (member.seatIndex == null) return;
  const existing = lobby.roster.get(member.key);
  if (existing) {
    // Rejoined: they are back in a seat, so this is no longer an early exit.
    existing.seatIndex = member.seatIndex;
    existing.leftAt = null;
    existing.leftEarly = false;
    return;
  }
  lobby.roster.set(member.key, {
    playerKey: member.key,
    userId: member.userId,
    name: member.name,
    tag: member.tag,
    seatIndex: member.seatIndex,
    joinedAt: new Date(),
    leftAt: null,
    leftEarly: false,
    cpuTookOver: false,
    disconnectCount: 0,
  });
}

/** Marks a seat as vacated. The entry stays so the loss is still recorded. */
function rosterLeave(lobby, member, { cpuTookOver = false } = {}) {
  const entry = lobby.roster.get(member.key);
  if (!entry) return;
  entry.leftAt = new Date();
  entry.leftEarly = true;
  if (cpuTookOver) entry.cpuTookOver = true;
}

/**
 * Writes the session outcome exactly once. Called on game over and again if the
 * lobby dies first, so an abandoned match still leaves a record.
 */
function closeSession(lobby, { completed, endedReason }) {
  if (!lobby.sessionPromise || lobby.recorded) return;
  lobby.recorded = true;

  // Snapshot now: the lobby may be torn down before the insert resolves.
  const snapshot = {
    completed,
    endedReason,
    finishedAt: lobby.game?.finishedAt || new Date(),
    roster: [...lobby.roster.values()],
    rounds: [...lobby.rounds],
    state: lobby.game?.state || null,
  };

  lobby.sessionPromise
    .then((sessionId) => sessionId && finishSession({ sessionId, ...snapshot }))
    .catch((err) => console.error("[db] finishSession failed:", err));
}

/**
 * Opens a fresh recording session for the match now running in this lobby.
 * Called for the first match AND for every rematch — a rematch is a separate
 * match and gets its own session row.
 *
 * The row is written at match start, not at game over, so a match that is
 * abandoned still leaves a trace.
 */
function beginSession(lobby) {
  lobby.roster.clear();
  lobby.rounds = [];
  lobby.recorded = false;
  for (const member of lobby.members.values()) rosterEnter(lobby, member);

  const host = lobby.members.get(lobby.hostKey);
  lobby.sessionPromise = createSession({
    gameType: "thirteen",
    lobbyId: lobby.id,
    lobbyName: lobby.name,
    isPrivate: lobby.isPrivate,
    hostUserId: host?.userId || null,
    hostDisplayName: host?.displayName || "?",
    maxPlayers: lobby.maxPlayers,
    playerCount: lobby.roster.size,
    startedAt: lobby.game?.startedAt,
  }).catch((err) => {
    console.error("[db] createSession failed:", err);
    return null;
  });
}

function startGame(lobby) {
  // Empty seats become CPUs; seat i is engine player i.
  lobby.seats = lobby.seats.map((s) => s ?? { kind: "cpu", name: null });
  for (const s of lobby.seats) if (s.kind === "cpu" && !s.name) s.name = nextCpuName(lobby.seats);
  const seats = lobby.seats.map((s) => {
    if (s.kind === "cpu") return { type: "AI", name: s.name, socketId: null };
    const m = lobby.members.get(s.key);
    return { type: "HUMAN", name: m.displayName, socketId: m.socketId, avatar: m.avatar };
  });

  lobby.game = new ThirteenGame({
    seats,
    delays: GAME_DELAYS,
    // The engine hands us itself, which is what makes the constructor-time
    // broadcast work -- see broadcastState.
    onState: (game) => broadcastState(lobby, game),
    // Fires before onGameOver, so the final round is captured before the
    // session is closed out.
    onRoundEnd: (round) => lobby.rounds.push(round),
    onGameOver: () => closeSession(lobby, { completed: true, endedReason: "completed" }),
  });

  beginSession(lobby);
  console.log(`Game started in lobby ${lobby.id} (${lobby.members.size} humans)`);
  broadcastLobbyList();
}

function removeMember(lobby, member, { convertSeat = true } = {}) {
  if (member.disconnectTimer) clearTimeout(member.disconnectTimer);
  lobby.members.delete(member.key);

  // Mid-game: a CPU inherits the seat and hand so the match can continue.
  const cpuTookOver = !!(convertSeat && lobby.game && member.seatIndex != null);
  if (cpuTookOver) {
    lobby.game.replaceSeat(member.seatIndex, {
      type: "AI",
      name: `${member.name} (CPU)`,
      socketId: null,
    });
  }

  // The ledger keeps the seat so the result is still attributed to them.
  if (lobby.game) rosterLeave(lobby, member, { cpuTookOver });

  if (lobby.members.size === 0) {
    destroyLobby(lobby);
  } else if (lobby.hostKey === member.key) {
    lobby.hostKey = lobby.members.keys().next().value;
  }
  broadcastLobbyList();
}

function destroyLobby(lobby) {
  // Everyone left before the match ended — record it rather than losing it.
  closeSession(lobby, { completed: false, endedReason: "all_left" });
  if (lobby.game) lobby.game.destroy();
  for (const m of lobby.members.values()) {
    if (m.disconnectTimer) clearTimeout(m.disconnectTimer);
  }
  lobbies.delete(lobby.id);
  console.log(`Lobby destroyed: ${lobby.id}`);
}

function findMembership(socket) {
  for (const lobby of lobbies.values()) {
    const member = lobby.members.get(socket.data.playerKey);
    if (member && member.socketId === socket.id) return { lobby, member };
  }
  return null;
}

// ---------- SOCKET HANDLERS ----------

io.on("connection", (socket) => {
  console.log(`Connected: ${socket.id} (${socket.data.displayName}${socket.data.userId ? ", auth" : ", guest"})`);

  socket.on("get_public_lobbies", () => {
    socket.emit("public_lobbies_update", publicLobbyList());
  });

  // Latency probe — client measures round-trip via the ack callback.
  socket.on("ping_check", (ack) => {
    if (typeof ack === "function") ack();
  });

  socket.on("get_stats", (ack) => {
    if (typeof ack !== "function") return;
    const tables = [...lobbies.values()].filter((l) => !l.isPrivate).length;
    ack({
      online: io.engine.clientsCount,
      tables,
      // Open public lobbies per game. Only Thirteen is served here so far.
      lobbies: { thirteen: tables, muushig: 0 },
    });
  });

  socket.on("create_lobby", ({ lobbyName, isPrivate } = {}) => {
    // One lobby per player: leaving any previous one keeps the list clean.
    const existing = findMembership(socket);
    if (existing) removeMember(existing.lobby, existing.member);

    const lobbyId = makeLobbyId(!!isPrivate);
    const lobby = {
      id: lobbyId,
      name: String(lobbyName || `${socket.data.displayName}'s Lobby`).slice(0, 40),
      isPrivate: !!isPrivate,
      maxPlayers: 4,
      hostKey: socket.data.playerKey,
      createdAt: new Date(),
      members: new Map(),
      roster: new Map(),
      rounds: [],
      sessionPromise: null,
      recorded: false,
      game: null,
      seats: Array(SEATS).fill(null),
    };
    takeSeat(lobby, addMember(lobby, socket));
    lobbies.set(lobbyId, lobby);
    socket.join(lobbyId);
    console.log(`Lobby created: ${lobbyId} by ${socket.data.displayName}`);
    socket.emit("lobby_joined", { lobbyId, isHost: true, mySocketId: socket.id });
    sendTableTo(lobby, socket);
    broadcastLobbyList();
  });

  socket.on("join_lobby", ({ lobbyId } = {}) => {
    // A shared code is the 6 characters either way; public ids carry a
    // "PUB-" prefix the player doesn't have to type.
    const lobby = lobbies.get(lobbyId) || lobbies.get(`PUB-${lobbyId}`);
    if (lobby) lobbyId = lobby.id;
    if (!lobby) {
      socket.emit("error_message", "Lobby not found");
      return;
    }

    let member = lobby.members.get(socket.data.playerKey);
    if (member) {
      // Rejoin (page refresh / reconnect): re-bind the new socket id.
      if (member.disconnectTimer) {
        clearTimeout(member.disconnectTimer);
        member.disconnectTimer = null;
      }
      member.socketId = socket.id;
      member.connected = true;
      socket.join(lobbyId);
      if (lobby.game && member.seatIndex != null) {
        lobby.game.replaceSeat(member.seatIndex, {
          type: "HUMAN",
          name: member.displayName,
          socketId: socket.id,
          avatar: member.avatar,
        });
        rosterEnter(lobby, member);
      }
      socket.emit("lobby_joined", {
        lobbyId,
        isHost: lobby.hostKey === member.key,
        mySocketId: socket.id,
      });
      sendStateTo(lobby, socket);
      broadcastTable(lobby); // shows them connected again
      return;
    }

    if (lobby.members.size >= lobby.maxPlayers) {
      socket.emit("error_message", "Lobby is full");
      return;
    }

    member = addMember(lobby, socket);
    socket.join(lobbyId);
    console.log(`${socket.data.displayName} joined ${lobbyId}`);
    if (!lobby.game) takeSeat(lobby, member);

    // Game already running: take over the first free CPU seat.
    if (lobby.game) {
      const takenSeats = new Set(
        [...lobby.members.values()].map((m) => m.seatIndex).filter((i) => i != null),
      );
      const seatIdx = lobby.game.state.players.findIndex(
        (p, i) => p.type === "AI" && !takenSeats.has(i),
      );
      if (seatIdx !== -1) {
        member.seatIndex = seatIdx;
        lobby.game.replaceSeat(seatIdx, {
          type: "HUMAN",
          name: member.displayName,
          socketId: socket.id,
          avatar: member.avatar,
        });
        rosterEnter(lobby, member);
      }
    }

    socket.emit("lobby_joined", { lobbyId, isHost: false, mySocketId: socket.id });
    sendStateTo(lobby, socket);
    broadcastTable(lobby);
    broadcastLobbyList();
  });

  // Game page asks where things stand: the waiting table, or the live game.
  socket.on("check_game_status", ({ lobbyId } = {}) => {
    const lobby = lobbies.get(lobbyId);
    if (!lobby) {
      socket.emit("error_message", "Lobby not found");
      return;
    }
    if (!lobby.members.has(socket.data.playerKey)) return;
    if (lobby.game) sendStateTo(lobby, socket);
    else sendTableTo(lobby, socket);
  });

  /** The lobby, if this socket is its host and it is still waiting. */
  const hostCommand = (lobbyId) => {
    const lobby = lobbies.get(lobbyId);
    const member = lobby?.members.get(socket.data.playerKey);
    if (!lobby || !member) return null;
    if (lobby.hostKey !== member.key) {
      socket.emit("move_rejected", { reason: "Only the host can do that" });
      return null;
    }
    if (lobby.game) {
      socket.emit("move_rejected", { reason: "The game has already started" });
      return null;
    }
    return lobby;
  };

  socket.on("start_game", ({ lobbyId } = {}) => {
    const lobby = hostCommand(lobbyId);
    if (lobby) startGame(lobby);
  });

  socket.on("request_move", ({ lobbyId, action, data } = {}) => {
    const lobby = lobbies.get(lobbyId);
    const member = lobby?.members.get(socket.data.playerKey);
    if (!lobby?.game || !member || member.seatIndex == null) return;

    const result = lobby.game.handleMove(member.seatIndex, action, data?.cards);
    if (!result.ok) {
      socket.emit("move_rejected", { reason: result.error });
    }
  });

  socket.on("request_rematch", ({ lobbyId } = {}) => {
    const lobby = lobbies.get(lobbyId);
    const member = lobby?.members.get(socket.data.playerKey);
    if (!lobby?.game || !member) return;
    if (lobby.hostKey !== member.key) {
      socket.emit("move_rejected", { reason: "Only the host can start a rematch" });
      return;
    }
    const result = lobby.game.rematch();
    if (!result.ok) {
      socket.emit("move_rejected", { reason: result.error });
      return;
    }
    beginSession(lobby);
  });

  socket.on("send_chat", ({ lobbyId, message } = {}) => {
    const lobby = lobbies.get(lobbyId);
    if (!lobby || !lobby.members.has(socket.data.playerKey)) return;
    const text = String(message || "").slice(0, 300);
    if (!text.trim()) return;
    io.to(lobbyId).emit("receive_chat", {
      id: `msg-${Date.now()}-${Math.random()}`,
      type: "CHAT",
      sender: socket.data.displayName,
      text,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    });
  });

  socket.on("leave_lobby", ({ lobbyId } = {}) => {
    const lobby = lobbies.get(lobbyId);
    const member = lobby?.members.get(socket.data.playerKey);
    if (!lobby || !member || member.socketId !== socket.id) return;
    socket.leave(lobbyId);
    removeMember(lobby, member);
  });

  socket.on("disconnect", () => {
    console.log(`Disconnected: ${socket.id}`);
    const found = findMembership(socket);
    if (!found) return;
    const { lobby, member } = found;

    member.connected = false;
    const entry = lobby.roster.get(member.key);
    if (entry) entry.disconnectCount += 1;

    if (lobby.game) {
      // Grace period: a refresh/rejoin within 60s keeps the seat.
      member.disconnectTimer = setTimeout(() => {
        member.disconnectTimer = null;
        if (!member.connected) removeMember(lobby, member);
      }, DISCONNECT_GRACE_MS);
    } else {
      removeMember(lobby, member);
    }
  });
});

// Schema first: a server that accepted players before its tables existed would
// fail every match write.
await migrate();
await closeOrphanedSessions();
server.listen(PORT, () => {
  console.log(`CARD GAME SERVER RUNNING ON PORT ${PORT}`);
});
