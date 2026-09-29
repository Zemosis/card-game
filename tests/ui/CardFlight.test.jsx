import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "@testing-library/react";
import gsap from "gsap";
import CardFlight from "../../src/components/muushig/CardFlight";

// Muushig's CPUs wait for a card flight to end before their next move, so a
// flight that stalls stalls the game.
const setHidden = (hidden) => {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event("visibilitychange"));
};

afterEach(() => setHidden(false));

// A fold: two cards from an opponent's fan to the dead pile, then a swap leg back.
const legs = [
  { count: 2, from: "seat", to: "dead" },
  { count: 2, from: "draw", to: "seat" },
];
const flight = (cb) => <CardFlight legs={legs} seat="topLeft" cardWidth={60} {...cb} />;

describe("CardFlight", () => {
  it("skips to the end, firing every landing, when the tab is hidden mid-flight", () => {
    const onLeg = vi.fn();
    const onLand = vi.fn();
    const onDone = vi.fn();
    render(flight({ onLeg, onLand, onDone }));
    expect(onDone).not.toHaveBeenCalled();
    setHidden(true);
    expect(onLand).toHaveBeenCalledTimes(4);
    expect(onLeg).toHaveBeenCalledWith(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("still ends on time when animation frames stop but the page counts as visible", async () => {
    // A window covered by another one (GNOME/Wayland): no frames, not hidden.
    const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 0);
    gsap.ticker.sleep(); // re-wakes on the next tween, picking up the dead rAF
    try {
      const onLand = vi.fn();
      const onDone = vi.fn();
      render(flight({ onLand, onDone }));
      await new Promise((r) => setTimeout(r, 2500));
      expect(onLand).toHaveBeenCalledTimes(4);
      expect(onDone).toHaveBeenCalledTimes(1);
    } finally {
      raf.mockRestore();
      gsap.ticker.sleep();
      gsap.ticker.wake();
    }
  }, 6000);

  it("does nothing more once unmounted", async () => {
    const onDone = vi.fn();
    const { unmount } = render(flight({ onDone }));
    unmount();
    setHidden(true);
    await new Promise((r) => setTimeout(r, 2000));
    expect(onDone).not.toHaveBeenCalled();
  }, 5000);
});
