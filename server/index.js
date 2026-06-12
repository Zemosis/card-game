// KHUZUR CARD HALL — authoritative game server.
// All game state lives in RAM here. Clients only send move requests; the
// server validates everything and emits redacted state (hidden hands stripped).

import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import { ThirteenGame, redactState } from "./game/engine.js";
import { verifyToken, recordMatch } from "./persistence.js";

const PORT = process.env.PORT || 3001;
const CORS_ORIGINS = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim());

// How long a disconnected player keeps their seat before a CPU takes over.
const DISCONNECT_GRACE_MS = 60_000;

const app = express();
app.use(cors({ origin: CORS_ORIGINS }));
app.get("/", (_req, res) => res.json({ ok: true, service: "card-game-server" }));

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
 *   game: ThirteenGame | null
 * }>
 */
const lobbies = new Map();

// ---------- AUTH MIDDLEWARE ----------
// Signed-in players pass their Supabase access token; guests pass name + tag.
// Identity (playerKey) is what survives refreshes and reconnects.
io.use(async (socket, next) => {
  const { token, name, tag } = socket.handshake.auth || {};
  const user = await verifyToken(token);

  const safeName = String(name || "PLAYER").slice(0, 12);
  const safeTag = String(tag || "0000").slice(0, 4);

  socket.data.userId = user?.id || null;
  socket.data.name = safeName;
  socket.data.tag = safeTag;
  socket.data.displayName = `${safeName} #${safeTag}`;
  socket.data.playerKey = user?.id || `guest:${safeName}#${safeTag}`;
  next();
});

// ---------- HELPERS ----------

const makeLobbyId = (isPrivate) => {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  return isPrivate ? code : `PUB-${code}`;
};

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
    socketId: socket.id,
    connected: true,
    seatIndex: null,
    disconnectTimer: null,
  };
  lobby.members.set(member.key, member);
  return member;
}

/** Sends each lobby member their own redacted view of the game state. */
function broadcastState(lobby) {
  if (!lobby.game) return;
  const state = lobby.game.state;
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

function buildMatchRecord(lobby, game) {
  const host = lobby.members.get(lobby.hostKey);
  return {
    lobbyId: lobby.id,
    lobbyName: lobby.name,
    isPrivate: lobby.isPrivate,
    hostUserId: host?.userId || null,
    hostDisplayName: host?.displayName || "?",
    startedAt: game.startedAt,
    finishedAt: game.finishedAt || new Date(),
    seats: [...lobby.members.values()]
      .filter((m) => m.seatIndex != null)
      .map((m) => ({
        seatIndex: m.seatIndex,
        userId: m.userId,
        name: m.name,
        tag: m.tag,
      })),
    state: game.state,
  };
}

function startGame(lobby) {
  const seats = [];
  for (const member of lobby.members.values()) {
    if (seats.length >= 4) break;
    member.seatIndex = seats.length;
    seats.push({ type: "HUMAN", name: member.displayName, socketId: member.socketId });
  }
  let cpu = 1;
  while (seats.length < 4) {
    seats.push({ type: "AI", name: `CPU ${cpu++}`, socketId: null });
  }

  lobby.game = new ThirteenGame({
    seats,
    onState: () => broadcastState(lobby),
    onGameOver: (game) => {
      recordMatch(buildMatchRecord(lobby, game)).catch((err) =>
        console.error("[supabase] recordMatch failed:", err),
      );
    },
  });
  console.log(`Game started in lobby ${lobby.id} (${lobby.members.size} humans)`);
  broadcastLobbyList();
}

function removeMember(lobby, member, { convertSeat = true } = {}) {
  if (member.disconnectTimer) clearTimeout(member.disconnectTimer);
  lobby.members.delete(member.key);

  // Mid-game: a CPU inherits the seat and hand so the match can continue.
  if (convertSeat && lobby.game && member.seatIndex != null) {
    lobby.game.replaceSeat(member.seatIndex, {
      type: "AI",
      name: `${member.name} (CPU)`,
      socketId: null,
    });
  }

  if (lobby.members.size === 0) {
    destroyLobby(lobby);
  } else if (lobby.hostKey === member.key) {
    lobby.hostKey = lobby.members.keys().next().value;
  }
  broadcastLobbyList();
}

function destroyLobby(lobby) {
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
    ack({
      online: io.engine.clientsCount,
      tables: [...lobbies.values()].filter((l) => !l.isPrivate).length,
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
      game: null,
    };
    addMember(lobby, socket);
    lobbies.set(lobbyId, lobby);
    socket.join(lobbyId);
    console.log(`Lobby created: ${lobbyId} by ${socket.data.displayName}`);
    socket.emit("lobby_joined", { lobbyId, isHost: true, mySocketId: socket.id });
    broadcastLobbyList();
  });

  socket.on("join_lobby", ({ lobbyId } = {}) => {
    const lobby = lobbies.get(lobbyId);
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
        });
      }
      socket.emit("lobby_joined", {
        lobbyId,
        isHost: lobby.hostKey === member.key,
        mySocketId: socket.id,
      });
      sendStateTo(lobby, socket);
      return;
    }

    if (lobby.members.size >= lobby.maxPlayers) {
      socket.emit("error_message", "Lobby is full");
      return;
    }

    member = addMember(lobby, socket);
    socket.join(lobbyId);
    console.log(`${socket.data.displayName} joined ${lobbyId}`);

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
        });
      }
    }

    socket.emit("lobby_joined", { lobbyId, isHost: false, mySocketId: socket.id });
    sendStateTo(lobby, socket);
    broadcastLobbyList();
  });

  // Game page asks for state; the host's first ask starts the match.
  socket.on("check_game_status", ({ lobbyId } = {}) => {
    const lobby = lobbies.get(lobbyId);
    if (!lobby) {
      socket.emit("error_message", "Lobby not found");
      return;
    }
    const member = lobby.members.get(socket.data.playerKey);
    if (!member) return;

    if (lobby.game) {
      sendStateTo(lobby, socket);
    } else if (lobby.hostKey === member.key) {
      startGame(lobby);
    }
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
    }
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

server.listen(PORT, () => {
  console.log(`CARD GAME SERVER RUNNING ON PORT ${PORT}`);
});
