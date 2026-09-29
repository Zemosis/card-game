// Reports a finished game against CPUs for the player's stats (see
// lib/soloMatches.js), once per match. Each page visit gets its own random id;
// a rematch is a new match, told apart by its match number, with its own start.

import { useEffect, useRef } from "react";
import { reportSoloMatch } from "../lib/soloMatches";

/**
 * prefix: the match id's prefix; matchNumber: the page's current match;
 * finished: that match is over; build({ matchId, startedAt, finishedAt })
 * returns the report; enabled: false for games the server already records.
 */
export function useSoloMatchReport({ prefix, matchNumber, finished, build, enabled = true }) {
  const ids = useRef({ key: null, starts: {} });

  useEffect(() => {
    ids.current.starts[matchNumber] ??= new Date().toISOString();
  }, [matchNumber]);

  useEffect(() => {
    if (!enabled || !finished) return;
    ids.current.key ??= `${prefix}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    reportSoloMatch(
      build({
        matchId: `${ids.current.key}-${matchNumber}`,
        startedAt: ids.current.starts[matchNumber],
        finishedAt: new Date().toISOString(),
      }),
    );
    // Once per match ending; `build` reads the latest state when it runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, finished, matchNumber]);
}
