# Thirteen Waiting Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new Thirteen table waits for players instead of dealing immediately; the host sees shadow seats, can invite by code or link, add/remove CPUs, and presses START.

**Architecture:** The server keeps a 4-slot `seats` array on every lobby while it is waiting and sends each member a per-recipient `table_update`. Three host-only socket events (`add_cpu`, `remove_cpu`, `start_game`) change seats or start the match; `check_game_status` no longer starts anything. On the client, `GameThirteen` renders a new `WaitingTable` component until the first `game_state_update`, a new `/join/:code` page turns invite links into a join, and the lobby list shows WAITING / PLAYING.

**Tech Stack:** Node + Express + Socket.IO server (`server/index.js`), React 19 + react-router 7 + Tailwind client, Vitest (projects `server`, `ui`) with Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-29-thirteen-waiting-table-design.md`

## Global Constraints

- Tables have exactly 4 seats (`SEATS = 4`); a table is full only at 4 humans.
- A joining human takes the first empty seat, else the first CPU seat (CPUs are placeholders).
- CPU names are `CPU n`, the lowest `n` not already used at the table.
- Host-only commands reject with `move_rejected { reason }`, like `request_rematch`.
- `table_update` never contains player keys or user ids.
- The shareable code is the lobby id without its `PUB-` prefix; invite links are `{origin}/join/{code}`.
- Waiting tables get the same `DISCONNECT_GRACE_MS` grace as live matches.
- Out of scope: kicking, choosing seats, CPU difficulty for online tables, Muushig.
- Commits: conventional, one line, no `Co-Authored-By` trailer (user preference).

## Review Focus

1. **Double START** — the host double-clicks START, or two `start_game` events arrive: the second must be rejected ("The game has already started"), never build a second game. Pinned in Task 2.
2. **Garbage seat numbers** — `add_cpu` / `remove_cpu` with `seat` as a string, negative, ≥ 4, or pointing at the wrong kind of slot must be rejected and leave seats unchanged. Pinned in Task 2.
3. **Host refreshes while waiting** — a host alone who refreshes must get the same table back, still host, not a destroyed table. Pinned in Task 3.
4. **Host leaves** — the next seated human must become host *and be told so* (their `table_update` flips `isHost` to true, so the START button appears for them). Pinned in Task 3.
5. **Hand-typed invite links** — `/join/abc123` (lowercase) or `/join/PUB-ABC123` must still join. Pinned in Task 5 (client uppercases; server already accepts both prefix forms).

---

## Before starting

The working tree has uncommitted main-menu changes that also touch `server/index.js` and `server/tests/socket.test.js`. Commit them first so each task below commits only its own work:

```bash
git add docs/STYLEGUIDE.md server/index.js server/tests/socket.test.js src/hooks/useServerStats.js src/pages/MainMenu.jsx src/components/RulebookPicker.jsx tests/ui/MainMenu.test.jsx
git commit -m "feat: rename menu to Khuzur, live lobby counts and rulebook picker"
```

Run all tests with `npx vitest run`; a single project with `npx vitest run --project server` (or `ui`); a single file by adding its path; a single test with `-t "<name>"`.

---

### Task 1: Server — tables wait, `table_update`, `start_game`

**Files:**
- Modify: `server/index.js` (lobby docs comment ~44-61, helpers after `makeLobbyId` ~108, `startGame` ~265-292, `create_lobby` ~363-389, `join_lobby` ~391-461, `check_game_status` ~463-478; new `start_game` handler)
- Test: `server/tests/socket.test.js`

**Interfaces:**
- Produces (server, module-private): `SEATS = 4`; `shareCode(id) -> string`; `nextCpuName(seats) -> "CPU n"`; `takeSeat(lobby, member) -> boolean`; `tableViewFor(lobby, member) -> TableView`; `broadcastTable(lobby)`; `sendTableTo(lobby, socket)`; `hostCommand(socket, lobbyId) -> lobby | null`; `lobby.seats: Array<{kind:"human",key}|{kind:"cpu",name}|null>` (length 4).
- Produces (protocol): event `table_update` with payload
  `{ lobbyId, name, isPrivate, status: "waiting", code, mySeat, isHost, seats: [ {kind:"human", name, avatar, isHost, connected} | {kind:"cpu", name} | null ] }`;
  client event `start_game { lobbyId }`.
- Produces (test helpers): `sock.tables` (every `table_update` received), `tableWhere(sock, match, timeout)`.

- [ ] **Step 1: Add table recording + helpers to the test file**

In `server/tests/socket.test.js`, inside `guest()` right after `sock.on("game_state_update", ...)`, add:

```js
  sock.tables = [];
  sock.on("table_update", (t) => sock.tables.push(t));
```

After the `stateWhere` helper, add:

```js
/** Like stateWhere(), for the waiting table's `table_update`. */
const tableWhere = (sock, match = () => true, timeout) => {
  const seen = [...sock.tables].reverse().find(match);
  return seen ? Promise.resolve(seen) : next(sock, "table_update", match, timeout);
};
```

Change `startMatch` to press START instead of relying on the page load:

```js
/** Host presses START; resolves with each socket's first dealt state. */
const startMatch = async (host, lobbyId, others = []) => {
  const firsts = [host, ...others].map((s) => next(s, "game_state_update"));
  host.emit("start_game", { lobbyId });
  return Promise.all(firsts);
};
```

In the "a whole match over sockets" test, replace `host.emit("check_game_status", { lobbyId });` with `host.emit("start_game", { lobbyId });`.

- [ ] **Step 2: Replace the instant-start test with waiting-table tests**

In `describe("lobbies")`, delete the test `"only the host's check_game_status starts the match"` and add a new block after the `lobbies` describe:

```js
describe("the waiting table", () => {
  it("a new table waits: the host is seated alone and nothing is dealt", async () => {
    const host = await guest("WAITER", "0101");
    const lobbyId = await createLobby(host, { lobbyName: "Patience" });
    host.emit("check_game_status", { lobbyId });
    const t = await tableWhere(host);
    expect(t).toMatchObject({
      lobbyId,
      name: "Patience",
      isPrivate: false,
      status: "waiting",
      code: lobbyId.replace("PUB-", ""),
      mySeat: 0,
      isHost: true,
    });
    expect(t.seats).toHaveLength(4);
    expect(t.seats[0]).toMatchObject({ kind: "human", name: "WAITER #0101", isHost: true, connected: true });
    expect(t.seats.slice(1)).toEqual([null, null, null]);
    expect(JSON.stringify(t)).not.toMatch(/guest:/);
    await new Promise((r) => setTimeout(r, 150));
    expect(host.states).toHaveLength(0);
  });

  it("a joiner is seated and everyone sees them; the joiner is not host", async () => {
    const host = await guest();
    const lobbyId = await createLobby(host);
    const b = await guest("BEE", "0202");
    await joinLobby(b, lobbyId);
    const mine = await tableWhere(b, (t) => t.mySeat === 1);
    expect(mine.isHost).toBe(false);
    const seen = await tableWhere(host, (t) => t.seats[1]?.name === "BEE #0202");
    expect(seen.seats[1]).toMatchObject({ kind: "human", isHost: false, connected: true });
  });

  it("only the host can start; start fills empty seats with CPUs and deals", async () => {
    const host = await guest();
    const lobbyId = await createLobby(host);
    const b = await guest();
    await joinLobby(b, lobbyId);

    const r = next(b, "move_rejected");
    b.emit("start_game", { lobbyId });
    expect((await r).reason).toBe("Only the host can do that");

    const [hs, bs] = await startMatch(host, lobbyId, [b]);
    expect(hs.gameState).toBe("PLAYING");
    expect(mySeat(hs)).toBe(0);
    expect(mySeat(bs)).toBe(1);
    expect(hs.players.map((p) => p.type)).toEqual(["HUMAN", "HUMAN", "AI", "AI"]);
    expect(hs.players.slice(2).map((p) => p.name)).toEqual(["CPU 1", "CPU 2"]);
  });

  it("start_game twice is rejected and does not re-deal", async () => {
    const host = await guest();
    const lobbyId = await createLobby(host);
    const [first] = await startMatch(host, lobbyId);
    const r = next(host, "move_rejected");
    host.emit("start_game", { lobbyId });
    expect((await r).reason).toBe("The game has already started");
    // The host never plays, so their 13 cards only change if a new game dealt.
    await new Promise((r2) => setTimeout(r2, 100));
    const ids = (st) => st.players[0].hand.map((c) => c.id).sort();
    expect(ids(host.states.at(-1))).toEqual(ids(first));
  });

  it("check_game_status on a playing table sends the game state", async () => {
    const host = await guest();
    const lobbyId = await createLobby(host);
    await startMatch(host, lobbyId);
    const again = next(host, "game_state_update");
    host.emit("check_game_status", { lobbyId });
    expect((await again).gameState).toBeDefined();
  });
});
```

- [ ] **Step 3: Run the server tests to see them fail**

Run: `npx vitest run --project server server/tests/socket.test.js`
Expected: FAIL — the new "waiting table" tests time out waiting for `table_update`, and every test using `startMatch` times out because `start_game` has no handler yet.

- [ ] **Step 4: Add the seat helpers to `server/index.js`**

In the lobby docs comment at the top, add a `seats` line under `members`:

```js
 *   seats: Array(4) of { kind: "human", key } | { kind: "cpu", name } | null,
 *     // who sits where while the table waits; frozen into the game at start
```

Directly after `makeLobbyId`, add:

```js
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
```

- [ ] **Step 5: Build the game from `lobby.seats`**

Replace the body of `startGame` up to (not including) `lobby.game = new ThirteenGame({`:

```js
function startGame(lobby) {
  // Empty seats become CPUs; seat i is engine player i.
  lobby.seats = lobby.seats.map((s) => s ?? { kind: "cpu", name: null });
  for (const s of lobby.seats) if (s.kind === "cpu" && !s.name) s.name = nextCpuName(lobby.seats);
  const seats = lobby.seats.map((s) => {
    if (s.kind === "cpu") return { type: "AI", name: s.name, socketId: null };
    const m = lobby.members.get(s.key);
    return { type: "HUMAN", name: m.displayName, socketId: m.socketId, avatar: m.avatar };
  });
```

(The rest of `startGame` — `new ThirteenGame(...)`, `beginSession`, the log line, `broadcastLobbyList()` — stays as it is.)

- [ ] **Step 6: Seat the host on create and joiners on join**

In `create_lobby`, add `seats: Array(SEATS).fill(null),` to the lobby object (after `game: null,`), and replace

```js
    addMember(lobby, socket);
```

with

```js
    takeSeat(lobby, addMember(lobby, socket));
```

and after `socket.emit("lobby_joined", { lobbyId, isHost: true, mySocketId: socket.id });` add:

```js
    sendTableTo(lobby, socket);
```

In `join_lobby`'s rejoin branch, after `sendStateTo(lobby, socket);` (before `return;`) add:

```js
      broadcastTable(lobby); // shows them connected again
```

In `join_lobby`'s new-member path, right after `console.log(`${socket.data.displayName} joined ${lobbyId}`);` add:

```js
    if (!lobby.game) takeSeat(lobby, member);
```

and after the final `sendStateTo(lobby, socket);` add:

```js
    broadcastTable(lobby);
```

(The existing "Lobby is full" check on `lobby.members.size >= lobby.maxPlayers` already means "4 humans", because members are the humans.)

- [ ] **Step 7: `check_game_status` stops starting games; add `start_game`**

Replace the whole `check_game_status` handler with:

```js
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
```

- [ ] **Step 8: Run the server tests**

Run: `npx vitest run --project server server/tests/socket.test.js`
Expected: PASS (all tests, including the pre-existing running-match tests now started via `start_game`).

- [ ] **Step 9: Commit**

```bash
git add server/index.js server/tests/socket.test.js
git commit -m "feat(server): thirteen tables wait for the host to start"
```

---

### Task 2: Server — host adds and removes CPUs; joiners bump CPUs

**Files:**
- Modify: `server/index.js` (new `add_cpu` / `remove_cpu` handlers next to `start_game`)
- Test: `server/tests/socket.test.js`

**Interfaces:**
- Consumes: `hostCommand(lobbyId)`, `nextCpuName(seats)`, `broadcastTable(lobby)`, `SEATS`, `tableWhere`, `startMatch` from Task 1.
- Produces (protocol): client events `add_cpu { lobbyId, seat }` and `remove_cpu { lobbyId, seat }` (seat is an integer 0-3).

- [ ] **Step 1: Write the failing tests**

Append inside `describe("the waiting table", ...)`:

```js
  it("the host adds and removes CPUs; everyone sees it", async () => {
    const host = await guest();
    const lobbyId = await createLobby(host);
    const b = await guest();
    await joinLobby(b, lobbyId);

    // Waits that follow an action use next(), never tableWhere(): an older
    // recorded update could already satisfy the predicate.
    const bothAdded = next(b, "table_update", (t) => t.seats[2] && t.seats[3]);
    host.emit("add_cpu", { lobbyId, seat: 2 });
    host.emit("add_cpu", { lobbyId, seat: 3 });
    const both = await bothAdded;
    expect(both.seats[2]).toEqual({ kind: "cpu", name: "CPU 1" });
    expect(both.seats[3]).toEqual({ kind: "cpu", name: "CPU 2" });

    const removedP = next(b, "table_update", (t) => t.seats[2] === null);
    host.emit("remove_cpu", { lobbyId, seat: 2 });
    expect((await removedP).seats[3].name).toBe("CPU 2");

    // The freed name is reused.
    const readded = next(b, "table_update", (t) => t.seats[2] !== null);
    host.emit("add_cpu", { lobbyId, seat: 2 });
    expect((await readded).seats[2].name).toBe("CPU 1");
  });

  it("rejects CPU commands from non-hosts and for bad seats", async () => {
    const host = await guest();
    const lobbyId = await createLobby(host);
    const b = await guest();
    await joinLobby(b, lobbyId);

    let r = next(b, "move_rejected");
    b.emit("add_cpu", { lobbyId, seat: 2 });
    expect((await r).reason).toBe("Only the host can do that");

    for (const seat of [0, 1, -1, 4, "2", null]) {
      r = next(host, "move_rejected");
      host.emit("add_cpu", { lobbyId, seat });
      expect((await r).reason).toBe("That seat isn't empty");
    }
    for (const seat of [0, 2, 9]) {
      r = next(host, "move_rejected");
      host.emit("remove_cpu", { lobbyId, seat });
      expect((await r).reason).toBe("There's no CPU in that seat");
    }
    const now = next(host, "table_update");
    host.emit("check_game_status", { lobbyId });
    expect((await now).seats.slice(2)).toEqual([null, null]);
  });

  it("CPU commands are rejected once the game has started", async () => {
    const host = await guest();
    const lobbyId = await createLobby(host);
    await startMatch(host, lobbyId);
    const r = next(host, "move_rejected");
    host.emit("add_cpu", { lobbyId, seat: 1 });
    expect((await r).reason).toBe("The game has already started");
  });

  it("a joiner bumps a CPU when no seat is empty; a fifth human is turned away", async () => {
    const host = await guest();
    const lobbyId = await createLobby(host);
    const allCpus = next(host, "table_update", (t) => t.seats.every(Boolean));
    for (const seat of [1, 2, 3]) host.emit("add_cpu", { lobbyId, seat });
    await allCpus;

    const b = await guest("BUMP", "0303");
    await joinLobby(b, lobbyId);
    const t = await tableWhere(b, (x) => x.mySeat != null);
    expect(t.mySeat).toBe(1);
    expect(t.seats.map((s) => s.kind)).toEqual(["human", "human", "cpu", "cpu"]);

    for (let i = 0; i < 2; i++) await joinLobby(await guest(), lobbyId);
    const late = await guest();
    const full = next(late, "error_message");
    late.emit("join_lobby", { lobbyId });
    expect(await full).toBe("Lobby is full");
  });
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run --project server server/tests/socket.test.js -t "CPU|bumps"`
Expected: FAIL — timeouts, since `add_cpu` / `remove_cpu` have no handlers.

- [ ] **Step 3: Add the handlers**

In `server/index.js`, after the `start_game` handler:

```js
  const isSeat = (seat) => Number.isInteger(seat) && seat >= 0 && seat < SEATS;

  socket.on("add_cpu", ({ lobbyId, seat } = {}) => {
    const lobby = hostCommand(lobbyId);
    if (!lobby) return;
    if (!isSeat(seat) || lobby.seats[seat] !== null) {
      socket.emit("move_rejected", { reason: "That seat isn't empty" });
      return;
    }
    lobby.seats[seat] = { kind: "cpu", name: nextCpuName(lobby.seats) };
    broadcastTable(lobby);
  });

  socket.on("remove_cpu", ({ lobbyId, seat } = {}) => {
    const lobby = hostCommand(lobbyId);
    if (!lobby) return;
    if (!isSeat(seat) || lobby.seats[seat]?.kind !== "cpu") {
      socket.emit("move_rejected", { reason: "There's no CPU in that seat" });
      return;
    }
    lobby.seats[seat] = null;
    broadcastTable(lobby);
  });
```

- [ ] **Step 4: Run the server tests**

Run: `npx vitest run --project server server/tests/socket.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/index.js server/tests/socket.test.js
git commit -m "feat(server): host adds and removes cpus at a waiting table"
```

---

### Task 3: Server — leaving, host hand-off and refresh grace while waiting

**Files:**
- Modify: `server/index.js` (`removeMember` ~294-317, `disconnect` handler ~532-551)
- Test: `server/tests/socket.test.js`

**Interfaces:**
- Consumes: `lobby.seats`, `broadcastTable(lobby)` from Task 1; `GRACE_MS` in the test file.
- Produces: no new names. Behaviour: leaving a waiting table empties the seat; host passes to the first seated human by seat order; a disconnect keeps the seat for `DISCONNECT_GRACE_MS`.

- [ ] **Step 1: Write the failing tests**

Append inside `describe("the waiting table", ...)`:

```js
  it("a non-host leaving frees their seat (empty, not a CPU)", async () => {
    const host = await guest();
    const lobbyId = await createLobby(host);
    const b = await guest();
    await joinLobby(b, lobbyId);
    await tableWhere(host, (t) => t.seats[1]);
    const freed = next(host, "table_update", (x) => x.seats[1] === null);
    b.emit("leave_lobby", { lobbyId });
    const t = await freed;
    expect(t.seats).toEqual([expect.objectContaining({ kind: "human" }), null, null, null]);
  });

  it("the host leaving passes host to the next seated human, who is told", async () => {
    const host = await guest();
    const lobbyId = await createLobby(host);
    const cpuIn = next(host, "table_update", (t) => t.seats[1]);
    host.emit("add_cpu", { lobbyId, seat: 1 });
    await cpuIn;
    const b = await guest("NEXT", "0404");
    await joinLobby(b, lobbyId);
    expect((await tableWhere(b, (t) => t.mySeat != null)).mySeat).toBe(2);

    host.emit("leave_lobby", { lobbyId });
    const t = await tableWhere(b, (x) => x.isHost);
    expect(t.seats[0]).toBeNull();
    expect(t.seats[2]).toMatchObject({ name: "NEXT #0404", isHost: true });

    const started = next(b, "game_state_update");
    b.emit("start_game", { lobbyId });
    expect((await started).gameState).toBe("PLAYING");
  });

  it("the last human leaving closes the table even with CPUs seated", async () => {
    const host = await guest();
    const lobbyId = await createLobby(host, { lobbyName: "Ghost Town" });
    const cpuIn = next(host, "table_update", (t) => t.seats[1]);
    host.emit("add_cpu", { lobbyId, seat: 1 });
    await cpuIn;
    host.emit("leave_lobby", { lobbyId });
    const c = await guest();
    const err = next(c, "error_message");
    c.emit("join_lobby", { lobbyId });
    expect(await err).toBe("Lobby not found");
  });

  it("a host who refreshes inside the grace period gets the same table back", async () => {
    const host = await guest("REFRESH", "0505");
    const lobbyId = await createLobby(host);
    const cpuIn = next(host, "table_update", (t) => t.seats[3]);
    host.emit("add_cpu", { lobbyId, seat: 3 });
    await cpuIn;
    const watcher = await guest();
    await joinLobby(watcher, lobbyId);

    host.disconnect();
    const away = await tableWhere(watcher, (t) => t.seats[0] && !t.seats[0].connected);
    expect(away.seats[0]).toMatchObject({ name: "REFRESH #0505", isHost: true, connected: false });

    const back = await guest("REFRESH", "0505");
    const joined = await joinLobby(back, lobbyId);
    expect(joined.isHost).toBe(true);
    const t = await tableWhere(back, (x) => x.seats[0]?.connected);
    expect(t).toMatchObject({ mySeat: 0, isHost: true });
    expect(t.seats[3]).toEqual({ kind: "cpu", name: "CPU 1" });
  });

  it("staying away past the grace period frees the seat", async () => {
    const host = await guest();
    const lobbyId = await createLobby(host);
    const b = await guest();
    await joinLobby(b, lobbyId);
    await tableWhere(host, (t) => t.seats[1]);
    const freed = next(host, "table_update", (x) => x.seats[1] === null, GRACE_MS * 5);
    b.disconnect();
    expect((await freed).seats[1]).toBeNull();
  });
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run --project server server/tests/socket.test.js -t "leaving|leaving passes|last human|refreshes|grace period frees"`
Expected: FAIL — seats are not freed on leave (no `table_update` with `seats[1] === null`), the refresh test fails because the disconnect currently removes the host at once and destroys the table.

- [ ] **Step 3: Free the seat and hand off host in `removeMember`**

In `removeMember`, after `lobby.members.delete(member.key);` add:

```js
  // Waiting table: the seat simply empties (CPUs only fill in at START).
  if (!lobby.game && member.seatIndex != null && lobby.seats[member.seatIndex]?.key === member.key) {
    lobby.seats[member.seatIndex] = null;
  }
```

Replace

```js
  if (lobby.members.size === 0) {
    destroyLobby(lobby);
  } else if (lobby.hostKey === member.key) {
    lobby.hostKey = lobby.members.keys().next().value;
  }
  broadcastLobbyList();
```

with

```js
  if (lobby.members.size === 0) {
    destroyLobby(lobby);
  } else {
    if (lobby.hostKey === member.key) {
      // Waiting: next human by seat order. Playing: first remaining member.
      const seated = !lobby.game && lobby.seats.find((s) => s?.kind === "human");
      lobby.hostKey = seated ? seated.key : lobby.members.keys().next().value;
    }
    broadcastTable(lobby);
  }
  broadcastLobbyList();
```

- [ ] **Step 4: Give waiting tables the disconnect grace**

In the `disconnect` handler, replace

```js
    if (lobby.game) {
      // Grace period: a refresh/rejoin within 60s keeps the seat.
      member.disconnectTimer = setTimeout(() => {
        member.disconnectTimer = null;
        if (!member.connected) removeMember(lobby, member);
      }, DISCONNECT_GRACE_MS);
    } else {
      removeMember(lobby, member);
    }
```

with

```js
    // Grace period, waiting or playing: a refresh/rejoin within it keeps the seat.
    member.disconnectTimer = setTimeout(() => {
      member.disconnectTimer = null;
      if (!member.connected) removeMember(lobby, member);
    }, DISCONNECT_GRACE_MS);
    broadcastTable(lobby); // the waiting table shows them as reconnecting
```

- [ ] **Step 5: Run the whole server project**

Run: `npx vitest run --project server`
Expected: PASS (socket suite plus the db suites, which skip without `TEST_DATABASE_URL`).

- [ ] **Step 6: Commit**

```bash
git add server/index.js server/tests/socket.test.js
git commit -m "feat(server): hand off host and keep seats through refresh while waiting"
```

---

### Task 4: Client — `WaitingTable` component

**Files:**
- Create: `src/components/thirteen/WaitingTable.jsx`
- Test: `tests/ui/WaitingTable.test.jsx`

**Interfaces:**
- Consumes: the `table_update` payload shape from Task 1 (`TableView`).
- Produces: `export default function WaitingTable({ table, messages, onSendMessage, onExit, onAddCpu, onRemoveCpu, onStart, errorMessage, myFace })`
  - `onAddCpu(seat: number)`, `onRemoveCpu(seat: number)`, `onStart()`, `onExit()`, `onSendMessage(text)`
  - `myFace`: `{ variant, customAvatarData }` for the viewer's own plate (optional).
  - Also exports `positionOf(seat, mySeat) -> "bottom" | "left" | "top" | "right"`.

- [ ] **Step 1: Write the failing tests**

Create `tests/ui/WaitingTable.test.jsx`:

```jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WaitingTable, { positionOf } from "../../src/components/thirteen/WaitingTable";

const human = (name, extra = {}) => ({ kind: "human", name, avatar: { variant: "2", custom: null }, isHost: false, connected: true, ...extra });

const table = (over = {}) => ({
  lobbyId: "PUB-ABC123",
  name: "Khuzur's Hideout",
  isPrivate: false,
  status: "waiting",
  code: "ABC123",
  mySeat: 0,
  isHost: true,
  seats: [human("HOSTY #0001", { isHost: true }), { kind: "cpu", name: "CPU 1" }, null, human("PAL #0002", { connected: false })],
  ...over,
});

const props = (over = {}) => ({
  table: table(),
  messages: [],
  onSendMessage: vi.fn(),
  onExit: vi.fn(),
  onAddCpu: vi.fn(),
  onRemoveCpu: vi.fn(),
  onStart: vi.fn(),
  ...over,
});

describe("positionOf", () => {
  it("puts my seat at the bottom and the rest clockwise like the live table", () => {
    expect([0, 1, 2, 3].map((s) => positionOf(s, 0))).toEqual(["bottom", "left", "top", "right"]);
    expect([0, 1, 2, 3].map((s) => positionOf(s, 2))).toEqual(["top", "right", "bottom", "left"]);
  });
});

describe("WaitingTable", () => {
  it("shows every seat: humans, CPUs, an empty shadow seat and a reconnecting player", () => {
    render(<WaitingTable {...props()} />);
    expect(screen.getByText("HOSTY")).toBeInTheDocument();
    expect(screen.getByText("CPU 1")).toBeInTheDocument();
    expect(screen.getByText("EMPTY SEAT")).toBeInTheDocument();
    expect(screen.getByText("PAL")).toBeInTheDocument();
    expect(screen.getByText(/reconnecting/i)).toBeInTheDocument();
    expect(screen.getByText(/3\/4 seated/)).toBeInTheDocument();
  });

  it("gives the host add, remove and start controls", async () => {
    const user = userEvent.setup();
    const p = props();
    render(<WaitingTable {...p} />);
    await user.click(screen.getByRole("button", { name: "Add CPU to seat 3" }));
    expect(p.onAddCpu).toHaveBeenCalledWith(2);
    await user.click(screen.getByRole("button", { name: "Remove CPU 1" }));
    expect(p.onRemoveCpu).toHaveBeenCalledWith(1);
    await user.click(screen.getByRole("button", { name: /start game/i }));
    expect(p.onStart).toHaveBeenCalled();
  });

  it("copies the code and the invite link", async () => {
    // userEvent.setup() installs a clipboard stub on navigator; spy on it.
    const user = userEvent.setup();
    const write = vi.spyOn(navigator.clipboard, "writeText");
    render(<WaitingTable {...props()} />);
    await user.click(screen.getByRole("button", { name: /copy code/i }));
    expect(write).toHaveBeenLastCalledWith("ABC123");
    await user.click(screen.getByRole("button", { name: /copy invite link/i }));
    expect(write).toHaveBeenLastCalledWith(`${window.location.origin}/join/ABC123`);
    expect(await screen.findByText(/copied/i)).toBeInTheDocument();
  });

  it("a non-host waits for the host and gets no host controls", () => {
    render(
      <WaitingTable
        {...props({
          table: table({ mySeat: 3, isHost: false, seats: [human("HOSTY #0001", { isHost: true }), null, null, human("ME #0003")] }),
        })}
      />,
    );
    expect(screen.getByText("Waiting for HOSTY to start")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start game/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add cpu/i })).not.toBeInTheDocument();
    expect(screen.getAllByText("EMPTY SEAT")).toHaveLength(2);
  });

  it("shows a rejected command's reason", () => {
    render(<WaitingTable {...props({ errorMessage: "That seat isn't empty" })} />);
    expect(screen.getByRole("alert")).toHaveTextContent("That seat isn't empty");
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run --project ui tests/ui/WaitingTable.test.jsx`
Expected: FAIL — `Failed to resolve import "../../src/components/thirteen/WaitingTable"`.

- [ ] **Step 3: Implement the component**

Create `src/components/thirteen/WaitingTable.jsx`:

```jsx
// WAITING TABLE — a Thirteen table before the deal. Seats sit where they will
// during the match (you at the bottom); empty ones are shadow spots the host
// can fill with CPUs. The felt holds the invite panel and the START button.
// GameThirteen shows this until the server's first game_state_update.

import React, { useState } from "react";
import { PixelAvatar } from "../PixelCard";
import PixelIcon from "../PixelIcon";
import GameChat from "./GameChat";
import { seatAvatar } from "../../utils/avatarConstants";

const POSITIONS = ["bottom", "left", "top", "right"];
const SIDE_SEAT_W = 224;

/** Where seat `seat` sits for a viewer in `mySeat` (same rotation as the live table). */
export const positionOf = (seat, mySeat) => POSITIONS[(seat - (mySeat ?? 0) + 4) % 4];

const shortName = (name = "") => name.split(" #")[0];

function SeatSlot({ seat, index, isHost, onAddCpu, onRemoveCpu, face }) {
  const base = "relative flex flex-col items-center justify-center gap-2 px-3 py-3 text-center";
  const size = { width: 184, minHeight: 124 };

  if (!seat) {
    return (
      <div
        className={base}
        style={{ ...size, border: "4px dashed #2a234d", backgroundColor: "rgba(20,16,42,0.45)" }}
      >
        <PixelIcon name="user" size={24} color="#2a234d" />
        <div className="font-pixel-display text-[10px] text-bone/40">EMPTY SEAT</div>
        {isHost && (
          <button
            onClick={() => onAddCpu(index)}
            aria-label={`Add CPU to seat ${index + 1}`}
            className="pixel-btn font-pixel-display text-[9px] px-2 py-1.5"
            style={{ backgroundColor: "#463a78", borderColor: "#2a234d", color: "#ead8b1" }}
          >
            + ADD CPU
          </button>
        )}
      </div>
    );
  }

  const isCpu = seat.kind === "cpu";
  const avatar = face || (isCpu ? { variant: (index % 5) + 1, customAvatarData: null } : seatAvatar(seat, index));
  return (
    <div
      className={base}
      style={{
        ...size,
        backgroundColor: "#14102a",
        border: "4px solid #0a0712",
        boxShadow: "0 0 0 4px #0a0712, inset 0 4px 0 rgba(255,255,255,0.04)",
        opacity: !isCpu && !seat.connected ? 0.55 : 1,
      }}
    >
      {seat.isHost && (
        <span
          className="absolute -top-3 left-2 font-pixel-display text-[9px] px-1.5 py-1 flex items-center gap-1"
          style={{ backgroundColor: "#f4c430", color: "#1a1024", boxShadow: "0 0 0 2px #0a0712" }}
        >
          <PixelIcon name="crown" size={9} /> HOST
        </span>
      )}
      {isCpu && isHost && (
        <button
          onClick={() => onRemoveCpu(index)}
          aria-label={`Remove ${seat.name}`}
          className="absolute -top-3 right-2 pixel-hbtn px-1 py-0.5"
          style={{ backgroundColor: "#7a1530", color: "#ead8b1", boxShadow: "0 0 0 2px #0a0712" }}
        >
          <PixelIcon name="close" size={10} />
        </button>
      )}
      <PixelAvatar variant={avatar.variant} customAvatarData={avatar.customAvatarData} size={44} />
      <div className="font-pixel-display text-[10px] text-parchment truncate max-w-full">
        {isCpu ? seat.name : shortName(seat.name)}
      </div>
      {!isCpu && !seat.connected && (
        <div className="font-pixel-body text-[16px] text-rose blink">reconnecting…</div>
      )}
    </div>
  );
}

function InvitePanel({ table, seatedCount, hostName, onStart }) {
  const [copied, setCopied] = useState(null);
  const copy = async (what, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
    }
  };
  const link = `${window.location.origin}/join/${table.code}`;

  return (
    <div
      className="flex flex-col items-center gap-4 p-6 text-center"
      style={{ backgroundColor: "rgba(10,7,18,0.8)", border: "4px solid #0a0712", boxShadow: "0 0 0 4px #463a78", maxWidth: 520 }}
    >
      <div className="font-pixel-display text-[14px] text-glow-gold">WAITING FOR PLAYERS</div>
      <div className="font-pixel-body text-[22px] text-bone/80">{seatedCount}/4 seated</div>

      <div className="flex flex-col items-center gap-1">
        <div className="font-pixel-display text-[9px] text-bone/60 flex items-center gap-2">
          <PixelIcon name={table.isPrivate ? "lock" : "globe"} size={10} />
          {table.isPrivate ? "PRIVATE TABLE CODE" : "TABLE CODE"}
        </div>
        <div className="font-pixel-display text-[22px] tracking-[0.3em] text-glow-cyan">{table.code}</div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => copy("code", table.code)}
          className="pixel-btn font-pixel-display text-[10px] px-3 py-2"
          style={{ backgroundColor: "#463a78", borderColor: "#2a234d", color: "#ead8b1" }}
        >
          COPY CODE
        </button>
        <button
          onClick={() => copy("link", link)}
          className="pixel-btn font-pixel-display text-[10px] px-3 py-2"
          style={{ backgroundColor: "#5fd4d6", borderColor: "#2a8a8c", color: "#0a2a2c" }}
        >
          COPY INVITE LINK
        </button>
      </div>
      <div className="font-pixel-body text-[18px] text-glow-cyan h-5" aria-live="polite">
        {copied === "code" ? "Code copied!" : copied === "link" ? "Invite link copied!" : ""}
      </div>

      {table.isHost ? (
        <>
          <button
            onClick={onStart}
            className="pixel-btn font-pixel-display text-[14px] px-8 py-4 flex items-center gap-3"
            style={{ backgroundColor: "#f4c430", borderColor: "#c89820", color: "#1a1024" }}
          >
            <PixelIcon name="play" size={14} /> START GAME
          </button>
          <div className="font-pixel-body text-[18px] text-bone/60">Empty seats are filled with CPUs when you start.</div>
        </>
      ) : (
        <div className="font-pixel-display text-[10px] text-bone/70 blink">Waiting for {hostName} to start</div>
      )}
    </div>
  );
}

export default function WaitingTable({ table, messages, onSendMessage, onExit, onAddCpu, onRemoveCpu, onStart, errorMessage, myFace }) {
  const at = {};
  table.seats.forEach((seat, i) => {
    at[positionOf(i, table.mySeat)] = { seat, index: i };
  });
  const slot = (pos) => (
    <SeatSlot
      seat={at[pos].seat}
      index={at[pos].index}
      isHost={table.isHost}
      onAddCpu={onAddCpu}
      onRemoveCpu={onRemoveCpu}
      face={pos === "bottom" ? myFace : undefined}
    />
  );
  const seatedCount = table.seats.filter(Boolean).length;
  const hostName = shortName(table.seats.find((s) => s?.isHost)?.name || "the host");

  return (
    <div className="relative w-full h-full font-pixel-body text-parchment overflow-hidden flex flex-col" style={{ position: "fixed", inset: 0 }}>
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, #2e0f1d 0%, #14102a 60%, #0a0712 100%)" }} />

      <div
        className="relative flex items-center justify-between px-5 py-3 z-10"
        style={{ backgroundColor: "rgba(10,7,18,0.85)", borderBottom: "4px solid #0a0712" }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onExit}
            className="pixel-btn font-pixel-display text-[10px] px-3 py-2"
            style={{ backgroundColor: "#7a1530", borderColor: "#3a0a18", color: "#ead8b1" }}
          >
            <span className="flex items-center gap-2"><PixelIcon name="back" size={12} />EXIT</span>
          </button>
          <div className="font-pixel-display text-[10px] text-bone/60 ml-2">
            {table.name.toUpperCase()} <span className="text-glow-cyan">#{table.code}</span>
          </div>
        </div>
        <div className="font-pixel-display text-base text-glow-gold">THIRTEEN</div>
        <div style={{ width: 120 }} />
      </div>

      <div className="relative flex-1 grid min-h-0" style={{ gridTemplateColumns: "minmax(0, 1fr) 300px" }}>
        <div className="relative flex flex-col items-center justify-between min-h-0 px-4 py-4">
          {slot("top")}
          <div
            className="grid items-center gap-4 w-full mx-auto"
            style={{ gridTemplateColumns: `${SIDE_SEAT_W}px minmax(0,1fr) ${SIDE_SEAT_W}px`, maxWidth: SIDE_SEAT_W * 2 + 820 + 32 }}
          >
            <div className="flex justify-center">{slot("left")}</div>
            <div className="flex flex-col items-center gap-3">
              <InvitePanel table={table} seatedCount={seatedCount} hostName={hostName} onStart={onStart} />
              {errorMessage && (
                <div role="alert" className="font-pixel-body text-[20px] px-3 py-1" style={{ backgroundColor: "#7a1530", color: "#ead8b1" }}>
                  {errorMessage}
                </div>
              )}
            </div>
            <div className="flex justify-center">{slot("right")}</div>
          </div>
          {slot("bottom")}
        </div>

        <div className="flex flex-col min-h-0 border-l-4" style={{ borderColor: "#0a0712", background: "#0e0a1f" }}>
          <GameChat messages={messages} onSendMessage={onSendMessage} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run --project ui tests/ui/WaitingTable.test.jsx`
Expected: PASS

- [ ] **Step 5: Lint and commit**

Run: `npx eslint src/components/thirteen/WaitingTable.jsx tests/ui/WaitingTable.test.jsx`
Expected: no errors.

```bash
git add src/components/thirteen/WaitingTable.jsx tests/ui/WaitingTable.test.jsx
git commit -m "feat(thirteen): waiting table with shadow seats and invite panel"
```

---

### Task 5: Client — wire the waiting table into `GameThirteen`; `/join/:code` page

**Files:**
- Modify: `src/pages/thirteen/GameThirteen.jsx` (imports ~1-35, state ~41-99, socket effect ~139-220, render ~489-497)
- Create: `src/pages/JoinTable.jsx`
- Modify: `src/App.jsx` (lazy import + route)
- Test: `tests/ui/JoinTable.test.jsx`

**Interfaces:**
- Consumes: `WaitingTable` props from Task 4; events `table_update`, `add_cpu`, `remove_cpu`, `start_game` from Tasks 1-2; `connectSocket(identity)` and `socket` from `src/utils/socket.js`; `useAuth()` returning `{ identity: { name, tag, avatar, customAvatar } }`.
- Produces: route `/join/:code`; `export default function JoinTable()`.

- [ ] **Step 1: Write the failing JoinTable test**

Create `tests/ui/JoinTable.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import JoinTable from "../../src/pages/JoinTable";

// vi.mock factories are hoisted above imports, so the fake lives in vi.hoisted.
const { handlers, fakeSocket } = vi.hoisted(() => {
  const handlers = {};
  return {
    handlers,
    fakeSocket: {
      connected: true,
      on: (ev, fn) => (handlers[ev] ||= new Set()).add(fn),
      off: (ev, fn) => handlers[ev]?.delete(fn),
      emit: vi.fn(),
    },
  };
});
const serverSends = (ev, data) => act(() => handlers[ev]?.forEach((fn) => fn(data)));

vi.mock("../../src/utils/socket", () => ({ socket: fakeSocket, connectSocket: () => Promise.resolve() }));
vi.mock("../../src/hooks/useAuth", () => ({
  useAuth: () => ({ identity: { name: "FRIEND", tag: "0007", avatar: "2" } }),
}));

function GamePage() {
  const { state } = useLocation();
  return <div>GAME PAGE {state.lobbyId} {state.playerName}</div>;
}

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/join/:code" element={<JoinTable />} />
        <Route path="/game-13" element={<GamePage />} />
        <Route path="/lobby-13" element={<div>THIRTEEN LOBBY</div>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  fakeSocket.emit.mockClear();
  for (const k of Object.keys(handlers)) delete handlers[k];
});

describe("JoinTable", () => {
  it("joins the code from the link, uppercased, then opens the table", async () => {
    renderAt("/join/abc123");
    await act(async () => {});
    expect(fakeSocket.emit).toHaveBeenCalledWith("join_lobby", { lobbyId: "ABC123", playerName: "FRIEND #0007" });
    expect(screen.getByText(/joining table ABC123/i)).toBeInTheDocument();
    serverSends("lobby_joined", { lobbyId: "PUB-ABC123", isHost: false, mySocketId: "s1" });
    expect(screen.getByText("GAME PAGE PUB-ABC123 FRIEND #0007")).toBeInTheDocument();
  });

  it("accepts a code that still carries the PUB- prefix", async () => {
    renderAt("/join/PUB-ABC123");
    await act(async () => {});
    expect(fakeSocket.emit).toHaveBeenCalledWith("join_lobby", { lobbyId: "PUB-ABC123", playerName: "FRIEND #0007" });
  });

  it("shows the server's reason when the table can't be joined", async () => {
    renderAt("/join/NOPE42");
    await act(async () => {});
    serverSends("error_message", "Lobby not found");
    expect(screen.getByText("CAN'T JOIN THIS TABLE")).toBeInTheDocument();
    expect(screen.getByText("Lobby not found")).toBeInTheDocument();
    act(() => screen.getByRole("button", { name: /thirteen lobby/i }).click());
    expect(screen.getByText("THIRTEEN LOBBY")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run --project ui tests/ui/JoinTable.test.jsx`
Expected: FAIL — cannot resolve `../../src/pages/JoinTable`.

- [ ] **Step 3: Create the JoinTable page**

Create `src/pages/JoinTable.jsx`:

```jsx
// JOIN TABLE — where invite links land (/join/:code). Joins the table with the
// visitor's identity, then opens it exactly as the lobby's JOIN button would.

import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { socket, connectSocket } from "../utils/socket";
import { useAuth } from "../hooks/useAuth";

export default function JoinTable() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const { identity } = useAuth();
  const [error, setError] = useState("");
  const lobbyId = code.trim().toUpperCase();
  const playerName = `${identity.name} #${identity.tag}`;

  useEffect(() => {
    const join = () => socket.emit("join_lobby", { lobbyId, playerName });
    const onJoined = (data) => navigate("/game-13", { replace: true, state: { ...data, playerName } });
    const onError = (msg) => setError(String(msg || "Lobby not found"));

    socket.on("connect", join);
    socket.on("lobby_joined", onJoined);
    socket.on("error_message", onError);
    connectSocket(identity).then(() => {
      if (socket.connected) join();
    });
    return () => {
      socket.off("connect", join);
      socket.off("lobby_joined", onJoined);
      socket.off("error_message", onError);
    };
    // Join once per code; identity changes reconnect through connectSocket elsewhere.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobbyId]);

  return (
    <div className="flex flex-col items-center justify-center gap-5 h-screen starfield font-pixel-body text-parchment text-center px-4">
      {error ? (
        <>
          <div className="font-pixel-display text-[14px]" style={{ color: "#e85a7a" }}>CAN'T JOIN THIS TABLE</div>
          <div className="font-pixel-body text-[22px] text-bone/80">{error}</div>
          <button
            onClick={() => navigate("/lobby-13")}
            className="pixel-btn font-pixel-display text-[10px] px-4 py-3"
            style={{ backgroundColor: "#463a78", borderColor: "#2a234d", color: "#ead8b1" }}
          >
            GO TO THIRTEEN LOBBY
          </button>
        </>
      ) : (
        <div className="font-pixel-display text-[14px] text-glow-gold blink">JOINING TABLE {lobbyId}...</div>
      )}
    </div>
  );
}
```

In `src/App.jsx`, add after the `Profile` lazy import:

```jsx
const JoinTable = lazy(() => import("./pages/JoinTable"));
```

and after `<Route path="/profile" element={<Profile />} />`:

```jsx
              <Route path="/join/:code" element={<JoinTable />} />
```

- [ ] **Step 4: Run the JoinTable tests**

Run: `npx vitest run --project ui tests/ui/JoinTable.test.jsx`
Expected: PASS

- [ ] **Step 5: Wire `WaitingTable` into `GameThirteen`**

In `src/pages/thirteen/GameThirteen.jsx`:

Add to the imports (after `import RulesModal ...`):

```jsx
import WaitingTable from "../../components/thirteen/WaitingTable";
```

Add a state next to `const [gameState, setGameState] = useState(null);`:

```jsx
  // The waiting table before the deal (server `table_update`); null once dealt.
  const [table, setTable] = useState(null);
```

Inside the socket effect, next to the other handlers (after `handleMoveRejected`), register and clean up `table_update`:

```jsx
    socket.on("table_update", setTable);
```

in the cleanup:

```jsx
      socket.off("table_update", setTable);
```

Add host commands after `handlePass`:

```jsx
  // --- WAITING TABLE (host) ---
  const handleAddCpu = (seat) => socket.emit("add_cpu", { lobbyId, seat });
  const handleRemoveCpu = (seat) => socket.emit("remove_cpu", { lobbyId, seat });
  const handleStart = () => socket.emit("start_game", { lobbyId });
```

In the render section, directly before `if (!gameState)` (the LOADING GAME return), add:

```jsx
  if (!gameState && table)
    return (
      <WaitingTable
        table={table}
        messages={messages}
        onSendMessage={handleSendMessage}
        onExit={handleExit}
        onAddCpu={handleAddCpu}
        onRemoveCpu={handleRemoveCpu}
        onStart={handleStart}
        errorMessage={errorMessage}
        myFace={{ variant: identity.avatar, customAvatarData: identity.customAvatar }}
      />
    );
```

The page never clears `errorMessage` on its own, so add an effect after the `table` state declarations that clears it after 4 seconds while the table is still waiting (the live game's error display is left as it is):

```jsx
  // A rejected waiting-table command shows for 4s, then clears.
  useEffect(() => {
    if (!errorMessage || gameState) return;
    const t = setTimeout(() => setErrorMessage(""), 4000);
    return () => clearTimeout(t);
  }, [errorMessage, gameState]);
```

Place it after the existing `useEffect(() => { gameStateRef.current = gameState; }, [gameState]);` so both state variables are declared above it. `handleSendMessage` already emits `send_chat`, which the server relays to waiting members too.

- [ ] **Step 6: Run the whole UI project and lint**

Run: `npx vitest run --project ui`
Expected: PASS

Run: `npx eslint src/pages/JoinTable.jsx src/pages/thirteen/GameThirteen.jsx src/App.jsx tests/ui/JoinTable.test.jsx`
Expected: no new errors (GameThirteen's existing exhaustive-deps warnings may remain).

- [ ] **Step 7: Commit**

```bash
git add src/pages/JoinTable.jsx src/App.jsx src/pages/thirteen/GameThirteen.jsx tests/ui/JoinTable.test.jsx
git commit -m "feat(thirteen): show the waiting table and join tables by invite link"
```

---

### Task 6: Client — WAITING / PLAYING tag in Open Tables

**Files:**
- Modify: `src/components/lobby/GameLobby.jsx` (`TablesPanel` row, ~306-310)
- Test: `tests/ui/GameLobby.test.jsx`

**Interfaces:**
- Consumes: `publicLobbyList()` rows `{ id, name, host, current, max, inProgress }` (unchanged server shape).
- Produces: nothing new for other tasks.

- [ ] **Step 1: Write the failing test**

Create `tests/ui/GameLobby.test.jsx`:

```jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import LobbySelection from "../../src/pages/thirteen/LobbySelection";

const { handlers, fakeSocket } = vi.hoisted(() => {
  const handlers = {};
  return {
    handlers,
    fakeSocket: {
      connected: true,
      on: (ev, fn) => (handlers[ev] ||= new Set()).add(fn),
      off: (ev, fn) => handlers[ev]?.delete(fn),
      emit: vi.fn(),
      timeout: () => ({ emit: () => {} }),
    },
  };
});

vi.mock("../../src/utils/socket", () => ({ socket: fakeSocket, connectSocket: () => Promise.resolve() }));
vi.mock("../../src/hooks/useAuth", () => ({
  useAuth: () => ({ identity: { name: "LOOKER", tag: "0009", avatar: "1" }, isGuest: true, updateProfile: async () => {} }),
}));
vi.mock("../../src/hooks/useServerStats", () => ({ useServerStats: () => ({ connected: true, online: 2 }) }));

describe("GameLobby open tables", () => {
  it("tags each table WAITING or PLAYING", () => {
    render(
      <MemoryRouter>
        <LobbySelection />
      </MemoryRouter>,
    );
    act(() =>
      handlers.public_lobbies_update.forEach((fn) =>
        fn([
          { id: "PUB-AAA111", name: "Early Birds", host: "A #1", current: 1, max: 4, inProgress: false },
          { id: "PUB-BBB222", name: "Mid Match", host: "B #2", current: 2, max: 4, inProgress: true },
        ]),
      ),
    );
    expect(screen.getByText("Early Birds").closest("[data-table]")).toHaveTextContent("WAITING");
    expect(screen.getByText("Mid Match").closest("[data-table]")).toHaveTextContent("PLAYING");
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run --project ui tests/ui/GameLobby.test.jsx`
Expected: FAIL — `closest("[data-table]")` returns null (no such attribute yet). If the render itself fails on another hook, add the missing mock in the same style before continuing.

- [ ] **Step 3: Add the tag**

In `TablesPanel`'s row `<div key={lobby.id} ...>`, add `data-table={lobby.id}` to that div. Then replace

```jsx
                <div className="min-w-0">
                  <div className="font-pixel-display text-[12px] text-parchment truncate">{lobby.name}</div>
```

with

```jsx
                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-pixel-display text-[12px] text-parchment truncate">{lobby.name}</span>
                    <span
                      className="font-pixel-display text-[8px] px-1.5 py-1 shrink-0"
                      style={
                        lobby.inProgress
                          ? { backgroundColor: "#7a1530", color: "#ead8b1" }
                          : { backgroundColor: "#2a8a8c", color: "#0a2a2c" }
                      }
                    >
                      {lobby.inProgress ? "PLAYING" : "WAITING"}
                    </span>
                  </div>
```

(the closing `</div>` of `min-w-0` and the id line below it stay as they are).

- [ ] **Step 4: Run the test**

Run: `npx vitest run --project ui tests/ui/GameLobby.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/lobby/GameLobby.jsx tests/ui/GameLobby.test.jsx
git commit -m "feat(lobby): tag open tables as waiting or playing"
```

---

### Task 7: Docs and live check

**Files:**
- Modify: `docs/ARCHITECTURE.md` (§ lobby notes ~128-131, disconnects ~151-152, socket protocol ~156-163)

**Interfaces:**
- Consumes: everything above.
- Produces: documentation only.

- [ ] **Step 1: Update the architecture doc**

In `docs/ARCHITECTURE.md`, after the paragraph starting "**Game state lives in RAM on the Node server**", add:

```markdown
**Waiting tables** — a new lobby does not deal. It holds `seats` (4 slots: a
human by player key, a CPU, or empty) and sends each member a `table_update`
shaped for them (their seat, whether they are host, no player keys). The host
adds/removes CPUs and presses START (`start_game`), which fills empty seats with
CPUs and builds the `ThirteenGame` in seat order. A joiner takes an empty seat,
else replaces a CPU; the table is full at 4 humans. If the host leaves, the next
seated human becomes host.
```

Replace the **Disconnects** paragraph with:

```markdown
**Disconnects** — a dropped player keeps their seat for 60 seconds
(`DISCONNECT_GRACE_MS`), whether the table is waiting or playing. After that a
waiting seat empties, and a playing seat goes to a CPU so the match can finish.
```

Replace the two protocol lines with:

```markdown
Client emits: `create_lobby`, `join_lobby`, `leave_lobby`, `get_public_lobbies`,
`check_game_status`, `add_cpu`, `remove_cpu`, `start_game`, `request_move`,
`request_rematch`, `send_chat`, `ping_check`, `get_stats`.

Server emits: `lobby_joined`, `table_update`, `game_state_update`,
`move_rejected`, `public_lobbies_update`, `receive_chat`, `error_message`.

Invite links are `/join/{code}`, handled by `src/pages/JoinTable.jsx`.
```

- [ ] **Step 2: Full test run**

Run: `npx vitest run`
Expected: all projects PASS.

- [ ] **Step 3: Live check on the dev server**

The dev server runs under nodemon and reloads on save; Vite serves http://localhost:5173.
1. Normal window: Thirteen → type a name → PUBLIC. Expect the waiting table: you at the bottom, three EMPTY SEAT shadows with + ADD CPU, the code and copy buttons, START GAME.
2. Click + ADD CPU on one seat, then its ✕. Expect CPU 1 to appear then disappear.
3. COPY INVITE LINK; open it in a private window. Expect "JOINING TABLE …" then the waiting table as a non-host ("Waiting for … to start"), and the first window shows the friend in a seat.
4. In Open Tables (a third window, or the private window's lobby before joining), the table shows WAITING.
5. Host presses START GAME. Both windows deal; the empty seats are CPUs.
6. Repeat with PRIVATE: the table does not appear in Open Tables; the invite link still works.

- [ ] **Step 4: Commit**

```bash
git add docs/ARCHITECTURE.md
git commit -m "docs: waiting tables, invites and new socket events"
```
