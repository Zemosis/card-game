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
