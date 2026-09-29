// PLACEMENT GRAPH — the player's finishing place across their recent matches,
// oldest on the left. 1st sits at the top, so a line climbing is good form.
//
// One series, so no legend: the section title names it. Square markers (filled
// for a win) and a 2px line keep it in the pixel language; the crosshair +
// tooltip says which match it was, on hover or keyboard focus.

import React, { useEffect, useRef, useState } from "react";
import { ordinal } from "./ordinal";

const H = 200;
const PAD = { top: 16, right: 16, bottom: 30, left: 48 };
const LINE = "#f4c430";
const GRID = "#1f1a3d";
const AXIS_TEXT = "#c8b890";
const GAME_NAMES = { thirteen: "Thirteen", muushig: "Muushig" };

/** matches: newest first, as the stats API sends them. */
export default function PlacementGraph({ matches }) {
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

  // Placed matches only (a walkout has no place), oldest first.
  const points = matches.filter((m) => m.place != null).reverse();
  if (!points.length) {
    return (
      <div ref={wrapRef} className="flex items-center justify-center font-pixel-body text-[22px] text-bone/80" style={{ height: H }}>
        Finish a match and your placings show here.
      </div>
    );
  }

  const places = Math.max(4, ...points.map((p) => p.of || p.place));
  const innerW = width - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i) => PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (place) => PAD.top + ((place - 1) / (places - 1)) * innerH;
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.place)}`).join(" ");

  function onMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = points.length === 1 ? 0 : Math.round(((e.clientX - rect.left - PAD.left) / innerW) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  }
  function onKey(e) {
    if (e.key === "ArrowRight") setHover((h) => Math.min(points.length - 1, (h ?? -1) + 1));
    if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? points.length) - 1));
  }

  const hp = hover != null ? points[hover] : null;
  const axis = { fontFamily: "VT323, monospace", fontSize: 18 };

  return (
    <div ref={wrapRef} className="relative">
      <svg
        width={width}
        height={H}
        role="img"
        aria-label={`Finishing place over your last ${points.length} matches, most recent ${ordinal(points.at(-1).place)}`}
        tabIndex={0}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        onFocus={() => setHover(points.length - 1)}
        onBlur={() => setHover(null)}
        onKeyDown={onKey}
        className="block outline-none focus-visible:outline-2 focus-visible:outline-gold"
        shapeRendering="crispEdges"
      >
        {Array.from({ length: places }, (_, i) => i + 1).map((place) => (
          <g key={place}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(place)} y2={y(place)} stroke={GRID} strokeWidth={1} />
            <text x={PAD.left - 10} y={y(place)} textAnchor="end" dominantBaseline="middle" fill={AXIS_TEXT} style={axis}>
              {ordinal(place)}
            </text>
          </g>
        ))}
        <text x={PAD.left} y={H - 8} fill={AXIS_TEXT} style={axis}>
          Older
        </text>
        <text x={width - PAD.right} y={H - 8} textAnchor="end" fill={AXIS_TEXT} style={axis}>
          Latest
        </text>

        {hp && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke="#6b5a9a" strokeWidth={2} />}
        {points.length > 1 && <path d={path} fill="none" stroke={LINE} strokeWidth={2} shapeRendering="auto" />}
        {points.map((p, i) => {
          const s = i === hover || i === points.length - 1 ? 10 : 8;
          return (
            <rect
              key={p.id}
              x={x(i) - s / 2}
              y={y(p.place) - s / 2}
              width={s}
              height={s}
              fill={p.won ? LINE : "#14102a"}
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
            // Beside the point, never on it: right of it unless that would run off.
            left: x(hover) + 196 > width ? x(hover) - 196 : x(hover) + 16,
            top: PAD.top,
            width: 180,
            backgroundColor: "#0a0712",
            color: "#ead8b1",
            boxShadow: "0 0 0 3px #463a78",
          }}
        >
          <div className="font-pixel-display text-[10px] text-gold mb-1">
            {ordinal(hp.place)} of {hp.of}
          </div>
          <div>{GAME_NAMES[hp.game] || hp.game}</div>
          <div className="text-bone">{hp.solo ? "vs CPU" : "Online"}</div>
          <div className="text-bone/70">{new Date(hp.finishedAt).toLocaleDateString()}</div>
        </div>
      )}
    </div>
  );
}
