import { describe, it, expect, vi, beforeEach } from "vitest";

const { api, getToken } = vi.hoisted(() => ({ api: vi.fn(), getToken: vi.fn() }));
vi.mock("../../src/lib/api", () => ({ api, getToken }));

const { reportSoloMatch } = await import("../../src/lib/soloMatches");

const report = (matchId) => ({ matchId, gameType: "thirteen" });

beforeEach(() => {
  api.mockReset().mockResolvedValue({ recorded: true, place: 1 });
  getToken.mockReset().mockReturnValue("token");
});

describe("reportSoloMatch", () => {
  it("sends a finished solo match once, however often it is called", async () => {
    await reportSoloMatch(report("M-1"));
    await reportSoloMatch(report("M-1"));
    expect(api).toHaveBeenCalledTimes(1);
    expect(api).toHaveBeenCalledWith("/matches", { method: "POST", body: report("M-1") });
  });

  it("sends nothing for a guest", async () => {
    getToken.mockReturnValue(null);
    await reportSoloMatch(report("M-2"));
    expect(api).not.toHaveBeenCalled();
  });

  it("can try again after a failed send", async () => {
    api.mockRejectedValueOnce(new Error("Cannot reach the game server"));
    await reportSoloMatch(report("M-3"));
    await reportSoloMatch(report("M-3"));
    expect(api).toHaveBeenCalledTimes(2);
  });
});
