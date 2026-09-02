// End-to-end multiplayer smoke test: two guest clients against a running
// server on :3001. Run with: node test-multiplayer.mjs
// (uses socket.io-client from the frontend's node_modules)

import { io } from "../node_modules/socket.io-client/build/esm/index.js";

const URL = process.env.TEST_URL || "http://localhost:3001";
let failures = 0;
const check = (cond, label) => {
  if (cond) console.log(`  ok: ${label}`);
  else {
    failures++;
    console.error(`  FAIL: ${label}`);
  }
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const once = (sock, event, timeout = 8000, label = "") =>
  new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`timeout waiting for ${event}${label ? ` (${label})` : ""}`)),
      timeout,
    );
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
  const joined = await once(host, "lobby_joined", 8000, "host lobby create");
  check(joined.isHost === true, "host receives lobby_joined with isHost");
  const lobbyId = joined.lobbyId;

  // Host enters the game page -> server starts the match
  host.emit("check_game_status", { lobbyId });
  const state1 = await once(host, "game_state_update", 8000, "host initial state");
  check(state1.players.length === 4, "game starts with 4 seats");
  // The very first state a client sees must be the deal itself. If the initial
  // broadcast is dropped, the first state to arrive is whatever follows the
  // first AI move -- and when a human holds the opening turn, nothing arrives
  // at all.
  check(
    state1.moveHistory.length === 0,
    `host receives the initial deal before any move (moves=${state1.moveHistory.length})`,
  );
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

  // Guest joins mid-game and takes over a CPU seat.
  //
  // Both listeners are registered BEFORE the emit. The server sends
  // lobby_joined and game_state_update back to back, and socket.io dispatches
  // a whole batch synchronously -- so awaiting the first and only then
  // subscribing to the second means the state update is delivered while nobody
  // is listening, and the second await hangs until it times out.
  const guestJoined = once(guest, "lobby_joined", 8000, "guest join ack");
  const guestState = once(guest, "game_state_update", 8000, "guest initial state");
  guest.emit("join_lobby", { lobbyId });
  await guestJoined;
  const state2 = await guestState;
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

  // CPU seats must act with no input from any client.
  //
  // This used to sleep a flat 10s and assert the move count had grown. That is
  // a race: the CPUs move, the turn returns to a human, and the game then sits
  // idle *correctly* waiting for that human. If the sleep began after the CPUs
  // had already played, nothing moved and the check failed spuriously. So wait
  // on the condition instead, and drive human turns out of the way first.
  // Seed each tracker from its OWN client's view: state2 is the guest's
  // redacted state, in which the host's hand is hidden. Seeding `latest` from
  // it left playHumanTurn unable to read the host's cards until some later
  // broadcast replaced it -- and when the host holds the turn, none comes.
  let latest = state1;
  let guestLatest = state2;
  host.on("game_state_update", (s) => (latest = s));
  guest.on("game_state_update", (s) => (guestLatest = s));

  const byValue = (a, b) =>
    a.rankValue * 4 + a.suitValue - (b.rankValue * 4 + b.suitValue);

  const isHumanSeat = (seat) => seat === 0 || seat === bobSeat;

  /** Plays any legal move for whichever human is on turn. */
  const playHumanTurn = () => {
    const seat = latest.currentPlayerIndex;
    const sock = seat === 0 ? host : guest;
    if (latest.currentPlay) {
      // Passing is always legal when not leading the trick.
      sock.emit("request_move", { lobbyId, action: "pass" });
      return;
    }
    const own = seat === 0 ? latest : guestLatest;
    const hand = own.players[seat]?.hand;
    if (!hand?.length || hand.some((c) => c.hidden)) return;
    const lowest = [...hand].sort(byValue)[0];
    sock.emit("request_move", {
      lobbyId,
      action: "play",
      data: { cards: [lowest.id] },
    });
  };

  const waitUntil = async (predicate, timeout, step = 100) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (predicate()) return true;
      await wait(step);
    }
    return predicate();
  };

  // Hand the turn to a CPU, playing for humans as needed.
  const reachedCpuTurn = await waitUntil(() => {
    if (latest.gameState !== "PLAYING") return false;
    if (isHumanSeat(latest.currentPlayerIndex)) {
      playHumanTurn();
      return false;
    }
    return true;
  }, 15000, 250);
  if (!reachedCpuTurn) {
    console.error(
      `    [diag] gameState=${latest.gameState} seat=${latest.currentPlayerIndex} ` +
        `types=${latest.players.map((p) => p.type).join(",")} ` +
        `moves=${latest.moveHistory.length} currentPlay=${!!latest.currentPlay} ` +
        `hostHandHidden=${latest.players[0].hand.some((c) => c.hidden)} ` +
        `guestSeatHidden=${guestLatest.players[bobSeat].hand.some((c) => c.hidden)} ` +
        `handLens=${latest.players.map((p) => p.hand.length).join(",")}`,
    );
  }
  check(reachedCpuTurn, "a CPU seat gets the turn");

  // From here on we send nothing. Any further move is the server's own doing.
  const beforeCpu = latest.moveHistory.length;
  const cpuActed = await waitUntil(
    () => latest.moveHistory.length > beforeCpu,
    8000,
  );
  check(
    cpuActed,
    `CPU acts with no client input (${latest.moveHistory.length - beforeCpu} moves)`,
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
