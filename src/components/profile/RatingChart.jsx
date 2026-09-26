// RATING CHART — rating after each of the player's recent matches.
//
// One series, so no legend: the panel title names it. Square markers and a
// 2px line keep it in the pixel language; the crosshair + tooltip answers
// "what happened in that match" on hover or keyboard focus.

import React, { useEffect, useRef, useState } from "react";

const H = 220;
const PAD = { top: 16, right: 16, bottom: 30, left: 52 };
const LINE = "#f4c430";
const GRID = "#1f1a3d";
const AXIS_TEXT = "#c8b890";

const PLACE = ["1st", "2nd", "3rd", "4th"];

function niceTicks(min, max, count = 4) {
  const span = Math.max(max - min, 10);
  const step = Math.pow(10, Math.floor(Math.log10(span / count)));
  const err = span / count / step;
  const nice = step * (err >= 5 ? 10 : err >= 2 ? 5 : err >= 1.5 ? 2 : 1);
  const lo = Math.floor(min / nice) * nice;
  const hi = Math.ceil(max / nice) * nice;
  const ticks = [];
  for (let v = lo; v <= hi + 1e-9; v += nice) ticks.push(v);
  return ticks;
}

export default function RatingChart({ history }) {
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Rated matches only; guest-only tables leave rating_after null.
  const points = history.filter((m) => m.rating_after != null);
  if (points.length < 2) {
    return (
      <div className="flex items-center justify-center font-pixel-body text-[22px] text-bone/80" style={{ height: H }}>
        {points.length === 0
          ? "Play a match with another signed-in player to start your rating line."
          : "One more rated match and your rating line appears here."}
      </div>
    );
  }

  const values = points.map((p) => p.rating_after);
  const ticks = niceTicks(Math.min(...values), Math.max(...values));
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const innerW = width - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i) => PAD.left + (i / (points.length - 1)) * innerW;
  const y = (v) => PAD.top + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;

  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.rating_after)}`).join(" ");

  function onMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = Math.round(((px - PAD.left) / innerW) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  }

  function onKey(e) {
    if (e.key === "ArrowRight") setHover((h) => Math.min(points.length - 1, (h ?? -1) + 1));
    if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? points.length) - 1));
  }

  const hp = hover != null ? points[hover] : null;
  const last = points[points.length - 1];

  return (
    <div ref={wrapRef} className="relative">
      <svg
        width={width}
        height={H}
        role="img"
        aria-label={`Rating over the last ${points.length} rated matches, now ${last.rating_after}`}
        tabIndex={0}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        onFocus={() => setHover(points.length - 1)}
        onBlur={() => setHover(null)}
        onKeyDown={onKey}
        className="block outline-none focus-visible:outline-2 focus-visible:outline-gold"
        shapeRendering="crispEdges"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
            <text
              x={PAD.left - 10}
              y={y(t)}
              textAnchor="end"
              dominantBaseline="middle"
              fill={AXIS_TEXT}
              style={{ fontFamily: "VT323, monospace", fontSize: 18 }}
            >
              {t}
            </text>
          </g>
        ))}
        <text
          x={PAD.left}
          y={H - 8}
          fill={AXIS_TEXT}
          style={{ fontFamily: "VT323, monospace", fontSize: 18 }}
        >
          Older
        </text>
        <text
          x={width - PAD.right}
          y={H - 8}
          textAnchor="end"
          fill={AXIS_TEXT}
          style={{ fontFamily: "VT323, monospace", fontSize: 18 }}
        >
          Latest
        </text>

        {hp && (
          <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke="#6b5a9a" strokeWidth={2} />
        )}
        <path d={path} fill="none" stroke={LINE} strokeWidth={2} shapeRendering="auto" />
        {points.map((p, i) => {
          const big = i === hover || i === points.length - 1;
          const s = big ? 10 : 6;
          return (
            <rect
              key={i}
              x={x(i) - s / 2}
              y={y(p.rating_after) - s / 2}
              width={s}
              height={s}
              fill={p.is_winner ? LINE : "#14102a"}
              stroke={LINE}
              strokeWidth={2}
            />
          );
        })}
      </svg>

      {hp && (
        <div
          className="absolute pointer-events-none font-pixel-body text-[20px] leading-tight px-3 py-2"
          style={{
            // Beside the point, never on it: right of it unless that would
            // run off the chart.
            left: x(hover) + 196 > width ? x(hover) - 196 : x(hover) + 16,
            top: PAD.top,
            width: 180,
            backgroundColor: "#0a0712",
            color: "#ead8b1",
            boxShadow: "0 0 0 3px #463a78",
          }}
        >
          <div className="font-pixel-display text-[10px] text-gold mb-1">
            {hp.final_position ? `${PLACE[hp.final_position - 1] || hp.final_position} place` : "Left early"}
          </div>
          <div>Rating {hp.rating_after}</div>
          <div className="text-bone">
            {hp.rating_delta > 0 ? "+" : ""}
            {hp.rating_delta ?? 0} this match
          </div>
          <div className="text-bone/70">{new Date(hp.finished_at).toLocaleDateString()}</div>
        </div>
      )}
    </div>
  );
}
