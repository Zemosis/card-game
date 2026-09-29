import { describe, it, expect, vi, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import DealAnimation from "../../src/components/thirteen/DealAnimation";

const setHidden = (hidden) => {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event("visibilitychange"));
};

afterEach(() => setHidden(false));

describe("DealAnimation", () => {
  it("finishes on its own and reports completion exactly once", async () => {
    const onComplete = vi.fn();
    const onDealProgress = vi.fn();
    render(<DealAnimation onComplete={onComplete} onDealProgress={onDealProgress} />);
    await waitFor(() => expect(onComplete).toHaveBeenCalled(), { timeout: 8000 });
    await new Promise((r) => setTimeout(r, 200));
    expect(onComplete).toHaveBeenCalledTimes(1);
  }, 10000);

  it("skips straight to the end when the tab is hidden mid-deal", () => {
    const onComplete = vi.fn();
    render(<DealAnimation onComplete={onComplete} />);
    expect(onComplete).not.toHaveBeenCalled();
    setHidden(true);
    expect(onComplete).toHaveBeenCalledTimes(1);
    setHidden(false);
    setHidden(true);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("skips immediately if the round starts while the tab is already hidden", () => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    const onComplete = vi.fn();
    render(<DealAnimation onComplete={onComplete} />);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("stops listening once unmounted", () => {
    const onComplete = vi.fn();
    const { unmount } = render(<DealAnimation onComplete={onComplete} />);
    unmount();
    setHidden(true);
    expect(onComplete).not.toHaveBeenCalled();
  });
});
