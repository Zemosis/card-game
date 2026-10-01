// MUUSHIG TALLIES — how an online match is recorded per seat, read from the
// engine's event log. Mirrors the browser's solo report
// (src/utils/soloReport.js muushigSoloReport), so online and solo matches add
// up the same way on a profile (tests/unit/muushig-stats.test.js checks it).

import { rankSolo } from "../solo.js";

/** One seat's tallies over a match: rounds played/won, piles eaten, rounds in/out, sweeps. */
export function muushigSeatStats(events, seat) {
  const stats = { rounds_played: 0, rounds_won: 0, eaten: 0, gone_in: 0, folded: 0, sweeps: 0 };
  for (const end of events.filter((e) => e.type === "roundEnd")) {
    const mine = end.results.find((r) => r.seat === seat);
    if (!mine) continue;
    stats.rounds_played += 1;
    if (mine.folded) {
      stats.folded += 1;
      continue;
    }
    stats.gone_in += 1;
    stats.eaten += mine.eaten;
    if (end.roundWinner === seat) stats.sweeps += 1;
    const most = Math.max(...end.results.map((r) => r.eaten));
    if (mine.eaten > 0 && mine.eaten === most) stats.rounds_won += 1;
  }
  return stats;
}

/** Final place per seat ({ seat: place }): lowest score, ties to more piles eaten in the last round. */
export function muushigPlaces(state) {
  const last = state.roundResults?.results || [];
  const places = rankSolo(
    "muushig",
    state.players.map((p, seat) => ({ score: p.score, lastEaten: last.find((r) => r.seat === seat)?.eaten ?? 0 })),
  );
  return Object.fromEntries(places.map((place, seat) => [seat, place]));
}
