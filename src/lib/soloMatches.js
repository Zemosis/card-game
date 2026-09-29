// Sends a finished solo game to the server for the player's stats. Signed-in
// players only (guests have no stats). Each match is sent once, however often
// the game page asks (StrictMode, re-renders); a failed send may be retried.

import { api, getToken } from "./api";

const sent = new Set();

export async function reportSoloMatch(report) {
  if (!report || !getToken() || sent.has(report.matchId)) return;
  sent.add(report.matchId);
  try {
    await api("/matches", { method: "POST", body: report });
  } catch (err) {
    sent.delete(report.matchId);
    console.warn("[stats] solo match not recorded:", err.message);
  }
}
