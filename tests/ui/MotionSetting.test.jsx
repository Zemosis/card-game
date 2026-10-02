import { describe, it, expect, afterAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SettingsModal from "../../src/components/SettingsModal";
import { reducedMotion, setReducedMotion } from "../../src/utils/motion";

// setup.js turns reduced motion on for every UI test; put it back after.
afterAll(() => setReducedMotion(true));

describe("animation setting", () => {
  it("ignores the OS reduce-motion preference: only the in-game choice counts", () => {
    // setup.js's matchMedia stub says the OS asks for reduced motion.
    expect(window.matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(true);
    setReducedMotion(false);
    expect(reducedMotion()).toBe(false);
  });

  it("toggles between full and reduced in Settings, remembered and mirrored on <html>", async () => {
    setReducedMotion(false);
    render(<SettingsModal onClose={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: /ANIMATIONS: FULL/ }));
    expect(reducedMotion()).toBe(true);
    expect(localStorage.getItem("khuzur_motion")).toBe("reduced");
    expect(document.documentElement.dataset.motion).toBe("reduced");

    await userEvent.click(screen.getByRole("button", { name: /ANIMATIONS: REDUCED/ }));
    expect(reducedMotion()).toBe(false);
    expect(localStorage.getItem("khuzur_motion")).toBe("full");
    expect(document.documentElement.dataset.motion).toBe("full");
  });
});
