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
