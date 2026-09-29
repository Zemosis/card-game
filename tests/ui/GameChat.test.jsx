import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GameChat from "../../src/components/thirteen/GameChat";
import { cards } from "../helpers/cards.js";

const chat = (id, text, sender = "BOB #1234") => ({ id: `c${id}`, type: "CHAT", sender, text, timestamp: "12:00" });
const sys = (id, fields) => ({ id: `s${id}`, type: "SYSTEM", timestamp: "12:00", ...fields });

describe("GameChat", () => {
  it("starts on the chat tab with a prompt", () => {
    render(<GameChat onSendMessage={() => {}} />);
    expect(screen.getByRole("tab", { name: "CHAT" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Say hi to the table!")).toBeInTheDocument();
  });

  it("sends typed messages and quick replies, never blank ones", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<GameChat onSendMessage={onSend} />);
    const input = screen.getByRole("textbox", { name: "Chat message" });
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    await user.type(input, "   ");
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    await user.clear(input);
    await user.type(input, "good luck{Enter}");
    expect(onSend).toHaveBeenLastCalledWith("good luck");
    expect(input).toHaveValue("");
    await user.click(screen.getByRole("button", { name: "gg" }));
    expect(onSend).toHaveBeenLastCalledWith("gg");
    expect(onSend).toHaveBeenCalledTimes(2);
  });

  it("splits chat from the move log", async () => {
    const user = userEvent.setup();
    const messages = [
      chat(1, "hello"),
      sys(1, { kind: "round", round: 1 }),
      sys(2, { kind: "play", playerIndex: 1, name: "CPU 1", cards: cards("3♦ 3♠"), combo: "Pair" }),
      sys(3, { kind: "pass", playerIndex: 2, name: "CPU 2" }),
      sys(4, { kind: "trick", name: "CPU 1" }),
      sys(5, { kind: "roundEnd", name: "CPU 1" }),
    ];
    render(<GameChat messages={messages} onSendMessage={() => {}} />);
    const log = screen.getByRole("log");
    expect(within(log).getByText("hello")).toBeInTheDocument();
    expect(within(log).queryByText("passed")).toBeNull();

    await user.click(screen.getByRole("tab", { name: "LOG" }));
    expect(screen.getByText("2 MOVES")).toBeInTheDocument();
    expect(within(log).getByText("ROUND 1")).toBeInTheDocument();
    expect(within(log).getByText("passed")).toBeInTheDocument();
    expect(within(log).getByText(/CPU 1 TAKES THE TRICK/)).toBeInTheDocument();
    expect(within(log).getByText(/CPU 1 WINS THE ROUND/)).toBeInTheDocument();
    expect(within(log).queryByText("hello")).toBeNull();
  });

  it("counts unread chat while you read the log", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<GameChat messages={[chat(1, "a")]} onSendMessage={() => {}} />);
    await user.click(screen.getByRole("tab", { name: "LOG" }));
    rerender(<GameChat messages={[chat(1, "a"), chat(2, "b"), chat(3, "c")]} onSendMessage={() => {}} />);
    expect(screen.getByRole("tab", { name: /CHAT/ })).toHaveTextContent("2");
    await user.click(screen.getByRole("tab", { name: /CHAT/ }));
    expect(screen.getByRole("tab", { name: "CHAT" })).toBeInTheDocument();
  });

  it("sending from the log tab jumps back to chat", async () => {
    const user = userEvent.setup();
    render(<GameChat onSendMessage={() => {}} />);
    await user.click(screen.getByRole("tab", { name: "LOG" }));
    await user.click(screen.getByRole("button", { name: "wp" }));
    expect(screen.getByRole("tab", { name: "CHAT" })).toHaveAttribute("aria-selected", "true");
  });
});
