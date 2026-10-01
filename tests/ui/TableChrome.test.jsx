import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TableHeader, TableSidebar } from "../../src/components/TableChrome";
import { useUnread } from "../../src/hooks/useUnread";
import OpponentSection from "../../src/components/thirteen/OpponentSection";

const chat = (id, isMe = false) => ({ id: `c${id}`, type: "CHAT", sender: "BOB #1234", text: "hi", isMe });
const sys = (id) => ({ id: `s${id}`, type: "SYSTEM", text: "played" });

// A compact table: header button, slide-out panel, unread count.
function CompactTable({ messages }) {
  const [open, setOpen] = useState(false);
  const unread = useUnread(messages, open);
  return (
    <>
      <TableHeader compact narrow title="THIRTEEN" round={2} onExit={() => {}} onPanel={() => setOpen(true)} unread={unread} />
      <TableSidebar compact open={open} onClose={() => setOpen(false)}>
        <p>SCOREBOARD</p>
      </TableSidebar>
    </>
  );
}

const panelButton = () => screen.getByRole("button", { name: /scoreboard and chat/i });

describe("TableHeader", () => {
  it("wide: centres match, game and round", () => {
    render(<TableHeader title="MUUSHIG" match={3} round={2} onExit={() => {}} onRules={() => {}} rulesTone={{}} />);
    expect(screen.getByText("NOW PLAYING")).toBeInTheDocument();
    expect(screen.getByText("MATCH")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /scoreboard and chat/i })).toBeNull();
  });

  it("compact and narrow: one tight row, icon buttons keep their names", async () => {
    const user = userEvent.setup();
    const onExit = vi.fn();
    const onRules = vi.fn();
    render(<TableHeader compact narrow title="THIRTEEN" round={4} onExit={onExit} onRules={onRules} rulesTone={{}} onPanel={() => {}} />);
    expect(screen.queryByText("NOW PLAYING")).toBeNull();
    expect(screen.getByText("R4")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Exit" }));
    await user.click(screen.getByRole("button", { name: "Rules" }));
    expect([onExit, onRules].map((f) => f.mock.calls.length)).toEqual([1, 1]);
  });
});

describe("compact sidebar", () => {
  it("is shut until the header button opens it, and closes on CLOSE or Escape", async () => {
    const user = userEvent.setup();
    render(<CompactTable messages={[]} />);
    expect(screen.queryByRole("complementary", { name: "Scoreboard and chat" })).toBeNull();
    await user.click(panelButton());
    expect(screen.getByRole("complementary", { name: "Scoreboard and chat" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: /close/i }));
    expect(screen.queryByRole("complementary", { name: "Scoreboard and chat" })).toBeNull();
    await user.click(panelButton());
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("complementary", { name: "Scoreboard and chat" })).toBeNull();
  });

  it("counts others' chat that arrives while shut; opening clears it", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<CompactTable messages={[chat(1)]} />);
    expect(panelButton()).toHaveAccessibleName("Scoreboard and chat");
    // Your own lines and the move log don't count.
    rerender(<CompactTable messages={[chat(1), chat(2), chat(3, true), sys(4), chat(5)]} />);
    expect(panelButton()).toHaveAccessibleName("Scoreboard and chat, 2 unread");
    await user.click(panelButton());
    await user.click(screen.getByRole("button", { name: /close/i }));
    expect(panelButton()).toHaveAccessibleName("Scoreboard and chat");
  });

  it("wide: a plain column, always shown", () => {
    render(
      <TableSidebar open={false} onClose={() => {}}>
        <p>SCOREBOARD</p>
      </TableSidebar>,
    );
    expect(screen.getByText("SCOREBOARD")).toBeVisible();
    expect(screen.queryByRole("button", { name: /close/i })).toBeNull();
  });
});

describe("OpponentSection small layouts", () => {
  const player = { id: 1, name: "ANN #0001", hand: Array.from({ length: 7 }, () => ({ hidden: true })), isEliminated: false };

  it.each(["strip", "row"])("%s: a plate with the count, no fan", (layout) => {
    const { container } = render(<OpponentSection player={player} position="left" layout={layout} isActive />);
    expect(screen.getByText("ANN")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("TURN")).toBeInTheDocument();
    // The deal lands on the plate itself.
    const plate = container.querySelector("[data-plate]");
    expect(plate.querySelector("[data-deal-seat]")).not.toBeNull();
  });
});
