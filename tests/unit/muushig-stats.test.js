import { describe, it, expect } from "vitest";
import { PHASES, collectTrick, createMatch, startNextRound } from "../../src/utils/muushig/engine.js";
import { aiAction, applyAction } from "../../src/utils/muushig/ai.js";
import { muushigSoloReport } from "../../src/utils/soloReport.js";
import { muushigSeatStats, muushigPlaces } from "../../server/game/muushigStats.js";
import { rankSolo } from "../../server/solo.js";
import { seededRandom } from "../helpers/cards.js";

// Online matches are recorded by the server from the event log; solo ones from
// the browser's report. Both must tally a seat the same way.
function playMatch(seed) {
  const rng = seededRandom(seed);
  let s = createMatch({ players: [0, 1, 2, 3, 4].map((i) => ({ name: `B${i}`, type: "AI", level: "MEDIUM" })), rng });
  while (s.phase !== PHASES.MATCH_OVER) {
    if (s.phase === PHASES.TRICK_END) s = collectTrick(s);
    else if (s.phase === PHASES.ROUND_END) s = startNextRound(s, rng);
    else s = applyAction(s, aiAction(s, rng), rng);
  }
  return s;
}

describe("muushig match tallies", () => {
  it.each([1, 2, 3, 4, 5, 6])("seed %i: every seat's stats match the solo report's", (seed) => {
    const s = playMatch(seed);
    for (let seat = 0; seat < 5; seat++) {
      expect(muushigSeatStats(s.events, seat)).toEqual(muushigSoloReport(s, { me: seat }).stats);
    }
  });

  it.each([7, 8, 9])("seed %i: places follow the match's own winner, then the solo ranking", (seed) => {
    const s = playMatch(seed);
    const places = muushigPlaces(s);
    expect(places[s.matchWinner]).toBe(1);
    const report = muushigSoloReport(s, { me: 0 });
    expect(Object.values(places)).toEqual(rankSolo("muushig", report.players));
  });
});
