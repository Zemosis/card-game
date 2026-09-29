import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import GameThirteen from "../../src/pages/thirteen/GameThirteen";

// The game page before the deal: it asks the server where things stand and
// shows the waiting table until the first game_state_update.
const { handlers, fakeSocket } = vi.hoisted(() => {
  const handlers = {};
  return {
    handlers,
    fakeSocket: {
      id: "sock-1",
      connected: true,
      on: (ev, fn) => (handlers[ev] ||= new Set()).add(fn),
      off: (ev, fn) => handlers[ev]?.delete(fn),
      emit: vi.fn(),
    },
  };
});
const serverSends = (ev, data) => act(() => handlers[ev]?.forEach((fn) => fn(data)));

vi.mock("../../src/utils/socket", () => ({ socket: fakeSocket, connectSocket: () => Promise.resolve() }));
vi.mock("../../src/hooks/useServerStats", () => ({ useServerStats: () => ({ connected: true, ping: 5 }) }));
vi.mock("../../src/hooks/useAuth", () => ({
  useAuth: () => ({ identity: { name: "HOSTY", tag: "0001", avatar: "1", customAvatar: null } }),
}));

const table = {
  lobbyId: "PUB-ABC123",
  name: "Test Table",
  isPrivate: false,
  status: "waiting",
  code: "ABC123",
  mySeat: 0,
  isHost: true,
  seats: [{ kind: "human", name: "HOSTY #0001", avatar: { variant: "1", custom: null }, isHost: true, connected: true }, null, null, null],
};

const renderGame = () =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/game-13", state: { lobbyId: "PUB-ABC123", isHost: true, playerName: "HOSTY #0001" } }]}>
      <Routes>
        <Route path="/game-13" element={<GameThirteen />} />
        <Route path="/" element={<div>MENU</div>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  fakeSocket.emit.mockClear();
  for (const k of Object.keys(handlers)) delete handlers[k];
});

describe("GameThirteen before the deal", () => {
  it("asks for the table, shows it, and sends the host's commands", async () => {
    const user = userEvent.setup();
    renderGame();
    await act(async () => {});
    expect(fakeSocket.emit).toHaveBeenCalledWith("check_game_status", { lobbyId: "PUB-ABC123" });

    serverSends("table_update", table);
    expect(screen.getByText("WAITING FOR PLAYERS")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add CPU to seat 2" }));
    expect(fakeSocket.emit).toHaveBeenCalledWith("add_cpu", { lobbyId: "PUB-ABC123", seat: 1 });

    serverSends("table_update", { ...table, seats: [table.seats[0], { kind: "cpu", name: "CPU 1" }, null, null] });
    await user.click(screen.getByRole("button", { name: "Remove CPU 1" }));
    expect(fakeSocket.emit).toHaveBeenCalledWith("remove_cpu", { lobbyId: "PUB-ABC123", seat: 1 });

    await user.click(screen.getByRole("button", { name: /start game/i }));
    expect(fakeSocket.emit).toHaveBeenCalledWith("start_game", { lobbyId: "PUB-ABC123" });
  });

  it("shows a rejected command on the waiting table", async () => {
    renderGame();
    await act(async () => {});
    serverSends("table_update", table);
    serverSends("move_rejected", { reason: "That seat isn't empty" });
    expect(screen.getByRole("alert")).toHaveTextContent("That seat isn't empty");
  });
});
