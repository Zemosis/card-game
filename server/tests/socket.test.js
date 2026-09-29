// End-to-end over real sockets: starts server/index.js on a free port with the
// database off and fast game timers, then plays through lobbies, moves, chat,
// leaving, reconnecting and a whole match with real socket.io clients.

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { io as connectClient } from "socket.io-client";

const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GRACE_MS = 400;

let server;
let url;
const open = [];

const freePort = () =>
  new Promise((resolve) => {
    const s = net.createServer().listen(0, () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

beforeAll(async () => {
  const port = await freePort();
  url = `http://localhost:${port}`;
  server = spawn(process.execPath, ["index.js"], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_URL: "",
      JWT_SECRET: "socket-test-secret",
      DISCONNECT_GRACE_MS: String(GRACE_MS),
      AI_TURN_DELAY_MS: "2",
      DEAL_DELAY_MS: "2",
      ROUND_END_DELAY_MS: "2",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("server did not start")), 15000);
    server.stdout.on("data", (d) => {
      if (String(d).includes("RUNNING ON PORT")) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.on("exit", (code) => reject(new Error(`server exited with ${code}`)));
  });
});

afterEach(() => {
  while (open.length) open.pop().disconnect();
});

afterAll(() => server?.kill());

// ---------- client helpers ----------

let guestCount = 0;
const guest = async (name = `G${++guestCount}`, tag = String(1000 + guestCount), avatar) => {
  const sock = connectClient(url, { auth: { name, tag, avatar }, forceNew: true, transports: ["websocket"] });
  sock.states = [];
  sock.on("game_state_update", (s) => sock.states.push(s));
  open.push(sock);
  await new Promise((resolve, reject) => {
    sock.once("connect", resolve);
    sock.once("connect_error", reject);
  });
  return sock;
};

/** Resolves with the next `event` payload that satisfies `match`. */
const next = (sock, event, match = () => true, timeout = 5000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      sock.off(event, handler);
      reject(new Error(`timed out waiting for ${event}`));
    }, timeout);
    const handler = (data) => {
      if (!match(data)) return;
      clearTimeout(timer);
      sock.off(event, handler);
      resolve(data);
    };
    sock.on(event, handler);
  });

/** Like next(), but also accepts a matching state that already arrived. */
const stateWhere = (sock, match = () => true, timeout) => {
  const seen = [...sock.states].reverse().find(match);
  return seen ? Promise.resolve(seen) : next(sock, "game_state_update", match, timeout);
};

const ack = (sock, event) => new Promise((resolve) => sock.emit(event, resolve));

const createLobby = async (host, opts = {}) => {
  const joined = next(host, "lobby_joined");
  host.emit("create_lobby", { lobbyName: "Test Table", isPrivate: false, ...opts });
  return (await joined).lobbyId;
};

const joinLobby = async (sock, lobbyId) => {
  const joined = next(sock, "lobby_joined");
  sock.emit("join_lobby", { lobbyId });
  return joined;
};

/** Host starts the match; resolves with each socket's first dealt state. */
const startMatch = async (host, lobbyId, others = []) => {
  const firsts = [host, ...others].map((s) => next(s, "game_state_update"));
  host.emit("check_game_status", { lobbyId });
  return Promise.all(firsts);
};

const mySeat = (state) => state.players.findIndex((p) => p.hand.length && !p.hand[0].hidden);
const lowest = (hand) => [...hand].sort((a, b) => a.rankValue * 4 + a.suitValue - (b.rankValue * 4 + b.suitValue))[0];

// ---------- tests ----------

describe("connection", () => {
  it("answers ping_check and get_stats", async () => {
    const a = await guest();
    await expect(ack(a, "ping_check")).resolves.toBeUndefined();
    const stats = await ack(a, "get_stats");
    expect(stats.online).toBeGreaterThanOrEqual(1);
    expect(typeof stats.tables).toBe("number");
  });
});

describe("lobbies", () => {
  it("a public lobby is listed and joinable by its 6-character code", async () => {
    const host = await guest("HOST");
    const lobbyId = await createLobby(host, { lobbyName: "Public Hall" });
    expect(lobbyId).toMatch(/^PUB-[A-Z0-9]{6}$/);

    const b = await guest();
    const list = next(b, "public_lobbies_update");
    b.emit("get_public_lobbies");
    const entry = (await list).find((l) => l.id === lobbyId);
    expect(entry).toMatchObject({ name: "Public Hall", current: 1, max: 4, inProgress: false });
    expect(entry.host).toMatch(/^HOST #/);

    const joined = await joinLobby(b, lobbyId.replace("PUB-", ""));
    expect(joined).toMatchObject({ lobbyId, isHost: false });
  });

  it("a private lobby is not listed but can be joined by code", async () => {
    const host = await guest();
    const lobbyId = await createLobby(host, { isPrivate: true });
    expect(lobbyId).toMatch(/^[A-Z0-9]{6}$/);
    const b = await guest();
    const list = next(b, "public_lobbies_update");
    b.emit("get_public_lobbies");
    expect((await list).some((l) => l.id === lobbyId)).toBe(false);
    expect(await joinLobby(b, lobbyId)).toMatchObject({ lobbyId, isHost: false });
  });

  it("rejects unknown and full lobbies", async () => {
    const a = await guest();
    const err = next(a, "error_message");
    a.emit("join_lobby", { lobbyId: "NOPE42" });
    expect(await err).toBe("Lobby not found");

    const host = await guest();
    const lobbyId = await createLobby(host);
    for (let i = 0; i < 3; i++) await joinLobby(await guest(), lobbyId);
    const late = await guest();
    const full = next(late, "error_message");
    late.emit("join_lobby", { lobbyId });
    expect(await full).toBe("Lobby is full");
  });

  it("only the host's check_game_status starts the match", async () => {
    const host = await guest();
    const lobbyId = await createLobby(host);
    const b = await guest();
    await joinLobby(b, lobbyId);
    b.emit("check_game_status", { lobbyId });
    await new Promise((r) => setTimeout(r, 150));
    expect(b.states).toHaveLength(0);
    const [hs] = await startMatch(host, lobbyId, [b]);
    expect(hs.gameState).toBe("PLAYING");
  });
});

describe("a running match", () => {
  const fourHumans = async () => {
    const socks = [await guest()];
    const lobbyId = await createLobby(socks[0]);
    for (let i = 0; i < 3; i++) {
      const s = await guest();
      await joinLobby(s, lobbyId);
      socks.push(s);
    }
    const states = await startMatch(socks[0], lobbyId, socks.slice(1));
    return { socks, lobbyId, states };
  };

  it("each player sees only their own hand; CPUs fill empty seats", async () => {
    const host = await guest("SOLO");
    const lobbyId = await createLobby(host);
    const [state] = await startMatch(host, lobbyId);
    expect(mySeat(state)).toBe(0);
    expect(state.players[0].hand).toHaveLength(13);
    expect(state.players.slice(1).map((p) => p.type)).toEqual(["AI", "AI", "AI"]);
    state.players.slice(1).forEach((p) => p.hand.forEach((c) => expect(c).toEqual({ hidden: true })));
  });

  it("four humans each get their own redacted view", async () => {
    const { states } = await fourHumans();
    states.forEach((s, seat) => {
      expect(mySeat(s)).toBe(seat);
      expect(s.players.every((p) => p.type === "HUMAN")).toBe(true);
    });
    expect(new Set(states.map((s) => s.currentPlayerIndex)).size).toBe(1);
  });

  it("illegal moves are rejected with a reason; a legal one reaches everyone", async () => {
    const { socks, lobbyId, states } = await fourHumans();
    const turn = states[0].currentPlayerIndex;
    const other = socks[(turn + 1) % 4];
    const actor = socks[turn];

    let rejected = next(other, "move_rejected");
    other.emit("request_move", { lobbyId, action: "play", data: { cards: ["3♦"] } });
    expect((await rejected).reason).toBe("Not your turn");

    rejected = next(actor, "move_rejected");
    actor.emit("request_move", { lobbyId, action: "pass" });
    expect((await rejected).reason).toMatch(/must play/);

    rejected = next(actor, "move_rejected");
    const notMine = states[(turn + 1) % 4].players[(turn + 1) % 4].hand[0].id;
    actor.emit("request_move", { lobbyId, action: "play", data: { cards: [notMine] } });
    expect((await rejected).reason).toBe("Those cards are not in your hand");

    const card = lowest(states[turn].players[turn].hand);
    const updates = socks.map((s) => next(s, "game_state_update", (st) => st.currentPlay));
    actor.emit("request_move", { lobbyId, action: "play", data: { cards: [card.id] } });
    const after = await Promise.all(updates);
    after.forEach((st) => {
      expect(st.currentPlay.cards[0].id).toBe(card.id);
      expect(st.players[turn].hand).toHaveLength(12);
      expect(st.currentPlayerIndex).toBe((turn + 1) % 4);
    });
  });

  it("chat reaches the whole table and empty messages are dropped", async () => {
    const { socks, lobbyId } = await fourHumans();
    const got = socks.map((s) => next(s, "receive_chat"));
    socks[1].emit("send_chat", { lobbyId, message: "   " });
    socks[1].emit("send_chat", { lobbyId, message: "gl hf" });
    const msgs = await Promise.all(got);
    msgs.forEach((m) => expect(m).toMatchObject({ type: "CHAT", text: "gl hf" }));
    expect(msgs[0].sender).toMatch(/ #/);
  });

  it("only the host can ask for a rematch, and only after game over", async () => {
    const { socks, lobbyId } = await fourHumans();
    let r = next(socks[1], "move_rejected");
    socks[1].emit("request_rematch", { lobbyId });
    expect((await r).reason).toBe("Only the host can start a rematch");
    r = next(socks[0], "move_rejected");
    socks[0].emit("request_rematch", { lobbyId });
    expect((await r).reason).toBe("Match is still in progress");
  });

  it("leaving mid-match hands the seat to a CPU", async () => {
    const { socks, lobbyId } = await fourHumans();
    const update = next(socks[0], "game_state_update", (s) => s.players[2].type === "AI");
    socks[2].emit("leave_lobby", { lobbyId });
    const s = await update;
    expect(s.players[2].name).toMatch(/\(CPU\)$/);
  });

  it("a disconnect keeps the seat through the grace period and rejoin reclaims it", async () => {
    const { socks, lobbyId } = await fourHumans();
    const leaver = socks[3];
    // Re-derive the guest identity the server keyed this seat by.
    const auth = leaver.io.opts.auth;
    leaver.disconnect();
    await new Promise((r) => setTimeout(r, GRACE_MS / 4));
    const back = await guest(auth.name, auth.tag);
    const joined = await joinLobby(back, lobbyId);
    expect(joined.isHost).toBe(false);
    const state = await stateWhere(back);
    expect(mySeat(state)).toBe(3);
    expect(state.players[3].type).toBe("HUMAN");
    await new Promise((r) => setTimeout(r, GRACE_MS * 1.5));
    expect(socks[0].states.at(-1).players[3].type).toBe("HUMAN");
  });

  it("staying away past the grace period hands the seat to a CPU", async () => {
    const { socks } = await fourHumans();
    const update = next(socks[0], "game_state_update", (s) => s.players[1].type === "AI", GRACE_MS * 5);
    socks[1].disconnect();
    expect((await update).players[1].name).toMatch(/\(CPU\)$/);
  });

  it("a new player joining mid-match takes over a CPU seat", async () => {
    const host = await guest();
    const lobbyId = await createLobby(host);
    await startMatch(host, lobbyId);
    const late = await guest("LATE", "0042", "3");
    const joined = await joinLobby(late, lobbyId);
    expect(joined.isHost).toBe(false);
    const s = await stateWhere(late, (st) => mySeat(st) > 0);
    expect(s.players[mySeat(s)]).toMatchObject({ type: "HUMAN", name: "LATE #0042", avatar: { variant: "3", custom: null } });
    // The rest of the table sees the new face too, not a stock CPU one.
    const seen = await stateWhere(host, (st) => st.players[mySeat(s)].type === "HUMAN");
    expect(seen.players[mySeat(s)].avatar).toEqual({ variant: "3", custom: null });
  });
});

describe("a whole match over sockets", () => {
  it("one human against three CPUs plays to game over, then rematches", async () => {
    const host = await guest("FULL");
    const lobbyId = await createLobby(host);

    // Simple bot: lead the lowest card, otherwise pass.
    let lastMoveKey = null;
    const autoplay = (s) => {
      if (s.gameState !== "PLAYING" || s.currentPlayerIndex !== 0) return;
      const key = `${s.roundNumber}:${s.moveHistory.length}`;
      if (key === lastMoveKey) return;
      lastMoveKey = key;
      if (s.currentPlay) host.emit("request_move", { lobbyId, action: "pass" });
      else host.emit("request_move", { lobbyId, action: "play", data: { cards: [lowest(s.players[0].hand).id] } });
    };
    host.on("game_state_update", autoplay);
    const rejections = [];
    host.on("move_rejected", ({ reason }) => rejections.push(reason));

    const over = next(host, "game_state_update", (s) => s.gameState === "GAME_OVER", 25000);
    host.emit("check_game_status", { lobbyId });
    const final = await over;
    expect(final.players.filter((p) => !p.isEliminated)).toHaveLength(1);
    expect(final.matchWins.reduce((a, b) => a + b, 0)).toBe(1);
    expect(final.roundNumber).toBeGreaterThan(1);
    expect(rejections).toEqual([]);

    host.off("game_state_update", autoplay);
    const rematch = next(host, "game_state_update", (s) => s.matchNumber === 2);
    host.emit("request_rematch", { lobbyId });
    const second = await rematch;
    expect(second).toMatchObject({ gameState: "PLAYING", roundNumber: 1 });
    expect(second.matchWins).toEqual(final.matchWins);
    expect(second.players.every((p) => p.score === 0)).toBe(true);
  }, 30000);
});
