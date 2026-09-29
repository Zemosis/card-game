// With no DATABASE_URL the server must still run: persistence is a no-op and
// the account routes answer 503 instead of crashing.

import { describe, it, expect, beforeAll, vi } from "vitest";
import express from "express";
import request from "supertest";

let persistence;
let db;
let app;

beforeAll(async () => {
  process.env.DATABASE_URL = "";
  delete process.env.JWT_SECRET;
  vi.spyOn(console, "warn").mockImplementation(() => {});
  db = await import("../../db/index.js");
  persistence = await import("../../persistence.js");
  const { authRouter } = await import("../../auth.js");
  app = express().use("/api/auth", authRouter);
});

describe("without a database", () => {
  it("has no pool and migrate() does nothing", async () => {
    expect(db.pool).toBeNull();
    await expect(db.migrate()).resolves.toBeUndefined();
  });

  it("recording functions are safe no-ops", async () => {
    await expect(persistence.createSession({ lobbyId: "X" })).resolves.toBeNull();
    await expect(persistence.closeOrphanedSessions()).resolves.toBeUndefined();
    await expect(persistence.finishSession({ sessionId: "abc", roster: [] })).resolves.toBeUndefined();
  });

  it("account routes answer 503", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "a@b.co", password: "secret1" });
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/not available/);
  });
});

describe("computeRatingDeltas (pure Elo)", () => {
  const entry = (playerKey, rating, position) => ({ playerKey, rating, position });

  it("nobody moves with fewer than two rated players", () => {
    expect(persistence.computeRatingDeltas([]).size).toBe(0);
    expect(persistence.computeRatingDeltas([entry("a", 1000, 1)]).size).toBe(0);
  });

  it("an even field: the winner gains what the loser drops", () => {
    const d = persistence.computeRatingDeltas([entry("a", 1000, 1), entry("b", 1000, 2)]);
    expect(d.get("a")).toBe(16);
    expect(d.get("b")).toBe(-16);
  });

  it("four players: places 1..4 go from most gained to most lost, summing to ~0", () => {
    const d = persistence.computeRatingDeltas(["a", "b", "c", "d"].map((k, i) => entry(k, 1000, i + 1)));
    const v = ["a", "b", "c", "d"].map((k) => d.get(k));
    expect(v[0]).toBeGreaterThan(v[1]);
    expect(v[1]).toBeGreaterThan(v[2]);
    expect(v[2]).toBeGreaterThan(v[3]);
    expect(Math.abs(v.reduce((a, b) => a + b, 0))).toBeLessThanOrEqual(2);
  });

  it("beating a stronger player earns more than beating a weaker one", () => {
    const upset = persistence.computeRatingDeltas([entry("a", 1000, 1), entry("b", 1400, 2)]).get("a");
    const expected = persistence.computeRatingDeltas([entry("a", 1400, 1), entry("b", 1000, 2)]).get("a");
    expect(upset).toBeGreaterThan(expected);
  });

  it("a tie on position splits the points", () => {
    const d = persistence.computeRatingDeltas([entry("a", 1000, 1), entry("b", 1000, 1)]);
    expect(d.get("a")).toBe(0);
  });
});
