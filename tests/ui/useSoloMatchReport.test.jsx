import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const { reportSoloMatch } = vi.hoisted(() => ({ reportSoloMatch: vi.fn() }));
vi.mock("../../src/lib/soloMatches", () => ({ reportSoloMatch }));

const { useSoloMatchReport } = await import("../../src/hooks/useSoloMatchReport");

beforeEach(() => reportSoloMatch.mockClear());

describe("useSoloMatchReport", () => {
  it("reports each match once, when it ends, with its own id and start time", () => {
    const build = vi.fn((times) => ({ ...times, gameType: "muushig" }));
    const { rerender } = renderHook((props) => useSoloMatchReport({ prefix: "MU", build, ...props }), {
      initialProps: { matchNumber: 1, finished: false },
    });
    expect(reportSoloMatch).not.toHaveBeenCalled();

    rerender({ matchNumber: 1, finished: true });
    rerender({ matchNumber: 1, finished: true });
    expect(reportSoloMatch).toHaveBeenCalledTimes(1);
    const first = reportSoloMatch.mock.calls[0][0];
    expect(first.matchId).toMatch(/^MU-[A-Z0-9]+-1$/);
    expect(Date.parse(first.startedAt)).toBeLessThanOrEqual(Date.parse(first.finishedAt));

    // A rematch is a new match: same page, next number, fresh start time.
    rerender({ matchNumber: 2, finished: false });
    rerender({ matchNumber: 2, finished: true });
    expect(reportSoloMatch).toHaveBeenCalledTimes(2);
    const second = reportSoloMatch.mock.calls[1][0];
    expect(second.matchId).toBe(first.matchId.replace(/-1$/, "-2"));
    expect(Date.parse(second.startedAt)).toBeGreaterThanOrEqual(Date.parse(first.startedAt));
  });

  it("does nothing while disabled (an online table)", () => {
    const { rerender } = renderHook((props) => useSoloMatchReport({ prefix: "SOLO", build: () => ({}), ...props }), {
      initialProps: { matchNumber: 1, finished: false, enabled: false },
    });
    rerender({ matchNumber: 1, finished: true, enabled: false });
    expect(reportSoloMatch).not.toHaveBeenCalled();
  });
});
