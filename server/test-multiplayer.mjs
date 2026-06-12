// End-to-end multiplayer smoke test: two guest clients against a running
// server on :3001. Run with: node test-multiplayer.mjs
// (uses socket.io-client from the frontend's node_modules)

import { io } from "../node_modules/socket.io-client/build/esm/index.js";

const URL = "http://localhost:3001";
let failures = 0;
const check = (cond, label) => {
  if (cond) console.log(`  ok: ${label}`);
  else {
    failures++;
    console.error(`  FAIL: ${label}`);
  }
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const once = (sock, event, timeout = 8000) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeout);
    sock.once(event, (data) => {
      clearTimeout(t);
      resolve(data);
    });
  });

const host = io(URL, { auth: { name: "ALICE", tag: "AAAA" } });
const guest = io(URL, { auth: { name: "BOB", tag: "BBBB" } });

try {
  // Host creates a lobby
  host.emit("create_lobby", { lobbyName: "Test Table", isPrivate: false });
  const joined = await once(host, "lobby_joined");
  check(joined.isHost === true, "host receives lobby_joined with isHost");
  const lobbyId = joined.lobbyId;

  // Host enters the game page -> server starts the match
  host.emit("check_game_status", { lobbyId });
  const state1 = await once(host, "game_state_update");
  check(state1.players.length === 4, "game starts with 4 seats");
  check(state1.players[0].name === "ALICE #AAAA", "host occupies seat 0");
  check(
    state1.players[0].hand.length === 13 && state1.players[0].hand.every((c) => c.id),
    "host sees own 13 cards",
  );
  check(
    state1.players.slice(1).every((p) => p.hand.every((c) => c.hidden === true)),
    "other hands are redacted for host",
  );
  check(
    state1.players.filter((p) => p.type === "AI").length === 3,
    "empty seats filled with CPUs",
  );

  // Guest joins mid-game and takes over a CPU seat
  guest.emit("join_lobby", { lobbyId });
  await once(guest, "lobby_joined");
  const state2 = await once(guest, "game_state_update");
  const bobSeat = state2.players.findIndex((p) => p.name === "BOB #BBBB");
  check(bobSeat === 1, "guest takes over CPU seat 1");
  check(
    state2.players[bobSeat].hand.every((c) => c.id),
    "guest sees own cards",
  );
  check(
    state2.players[0].hand.every((c) => c.hidden === true),
    "host's hand is redacted for guest",
  );

  // Out-of-turn / illegal moves are rejected
  const notMyTurn = state2.currentPlayerIndex !== bobSeat;
  guest.emit("request_move", {
    lobbyId,
    action: notMyTurn ? "play" : "pass", // pass while leading is also illegal
    data: { cards: [state2.players[bobSeat].hand[0].id] },
  });
  const rejection = await once(guest, "move_rejected");
  check(!!rejection.reason, `illegal move rejected ("${rejection.reason}")`);

  // CPUs play on their own: within ~10s the move history should grow
  const before = state2.moveHistory.length;
  let latest = state2;
  host.on("game_state_update", (s) => (latest = s));
  await wait(10000);
  check(
    latest.moveHistory.length > before,
    `game advances on its own (${latest.moveHistory.length - before} moves in 10s)`,
  );

  // Chat relays with server-side identity
  guest.emit("send_chat", { lobbyId, message: "hello!" });
  const chat = await once(host, "receive_chat");
  check(chat.sender === "BOB #BBBB" && chat.text === "hello!", "chat relays with verified sender");

  // Leaving hands the seat to a CPU
  guest.emit("leave_lobby", { lobbyId });
  await wait(500);
  check(
    latest.players[bobSeat].type === "AI",
    "leaver's seat converted to CPU",
  );
} catch (err) {
  failures++;
  console.error(`  FAIL: ${err.message}`);
}

host.close();
guest.close();
console.log(failures === 0 ? "\nALL E2E CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
