import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import MainMenu from "../../src/pages/MainMenu";

let stats;

vi.mock("../../src/utils/socket", () => ({ socket: {}, connectSocket: () => {} }));
vi.mock("../../src/hooks/useServerStats", () => ({ useServerStats: () => stats }));
vi.mock("../../src/hooks/useAuth", () => ({
  useAuth: () => ({
    identity: { name: "TESTER", tag: "0001", avatar: 0 },
    isGuest: true,
    needsProfileSetup: false,
    signOut: () => {},
    updateProfile: async () => {},
  }),
}));

const renderMenu = () =>
  render(
    <MemoryRouter>
      <MainMenu />
    </MemoryRouter>,
  );

beforeEach(() => {
  stats = { connected: true, online: 3, tables: 2, ping: 12, lobbies: { thirteen: 2, muushig: 0 } };
});

describe("MainMenu", () => {
  it("is branded Khuzur, with a Card Hall kicker and no per-game kickers", () => {
    renderMenu();
    expect(screen.getByText("KHUZUR")).toBeInTheDocument();
    expect(screen.getByText("Card Hall")).toBeInTheDocument();
    expect(screen.queryByText(/CARD-LORE/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tien Len/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Mongolian Trickster/)).not.toBeInTheDocument();
  });

  it("shows live open-lobby counts instead of play counts", () => {
    renderMenu();
    expect(screen.getByText("2 lobbies open")).toBeInTheDocument();
    expect(screen.getByText("0 lobbies open")).toBeInTheDocument();
    expect(screen.queryByText(/plays/)).not.toBeInTheDocument();
  });

  it("uses the singular for one lobby and a dash when offline", () => {
    stats = { ...stats, lobbies: { thirteen: 1, muushig: 0 } };
    const { unmount } = renderMenu();
    expect(screen.getByText("1 lobby open")).toBeInTheDocument();
    unmount();

    stats = { connected: false, online: null, tables: null, ping: null };
    renderMenu();
    expect(screen.queryByText(/lobb(y|ies) open/)).not.toBeInTheDocument();
  });

  it("opens your profile from your name on the player badge", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<MainMenu />} />
          <Route path="/profile" element={<div>PROFILE PAGE</div>} />
        </Routes>
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: /view profile/i }));
    expect(screen.getByText("PROFILE PAGE")).toBeInTheDocument();
  });

  it("opens either game's rulebook from the Rules picker", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: /rules/i }));
    const menu = screen.getByRole("menu", { name: /rulebook/i });
    await user.click(within(menu).getByRole("menuitem", { name: /thirteen/i }));
    expect(screen.getByRole("dialog", { name: "HOW TO PLAY THIRTEEN" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /close/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /rules/i }));
    await user.click(screen.getByRole("menuitem", { name: /muushig/i }));
    expect(screen.getByRole("dialog", { name: "HOW TO PLAY MUUSHIG" })).toBeInTheDocument();
  });
});
