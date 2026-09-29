// PLACEMENT BARS — how often the player finished in each place, 1st to
// `places` (4 at a Thirteen table, 5 at Muushig's).
//
// Magnitude of one measure across ordered categories, so one hue for every
// bar; the count and share are printed beside each bar in text colors, which
// doubles as the table view.

import React, { useState } from "react";
import { ordinal } from "./ordinal";

const BAR = "#f4c430";

/** placements: [{ place, times }] (places never reached may be missing). */
export default function PlacementBars({ placements, places = 4 }) {
  const [hover, setHover] = useState(null);
  const counts = Array.from({ length: places }, (_, i) => placements.find((p) => p.place === i + 1)?.times || 0);
  const total = counts.reduce((a, b) => a + b, 0);
  const max = Math.max(...counts, 1);

  return (
    <ul className="flex flex-col gap-3" aria-label="Finishing places">
      {counts.map((n, i) => {
        const pct = total ? Math.round((n / total) * 100) : 0;
        return (
          <li
            key={i}
            className="grid items-center gap-3"
            style={{ gridTemplateColumns: "44px minmax(0,1fr) 92px" }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="font-pixel-display text-[11px] text-parchment">{ordinal(i + 1)}</span>
            <div style={{ height: 20, backgroundColor: "#0a0712", boxShadow: "0 0 0 2px #1f1a3d" }}>
              <div
                style={{
                  width: `${(n / max) * 100}%`,
                  minWidth: n ? 4 : 0,
                  height: "100%",
                  backgroundColor: BAR,
                  opacity: hover == null || hover === i ? 1 : 0.55,
                  boxShadow: "inset 0 4px 0 rgba(255,255,255,0.3)",
                }}
              />
            </div>
            <span className="font-pixel-body text-[20px] text-bone text-right tabular-nums">
              {n} <span className="text-bone/60">({pct}%)</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
