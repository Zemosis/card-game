// MUUSHIG CONTROLS — the bar under your hand: a status line, the sort toggle,
// and the buttons for the current phase (GO IN / FOLD, SWAP, TAKE TRUMP,
// THROW). The page decides which buttons show; the primary one also fires on
// SPACE.

import React, { useEffect } from "react";

const TONES = {
  green: { backgroundColor: "#9bd14f", borderColor: "#6a9a30", color: "#1a3a0e" },
  gold: { backgroundColor: "#f4c430", borderColor: "#c89820", color: "#1a1024" },
  rose: { backgroundColor: "#7a1530", borderColor: "#3a0a18", color: "#ead8b1" },
  dusk: { backgroundColor: "#463a78", borderColor: "#2a234d", color: "#ead8b1" },
};

/**
 * buttons: [{ label, onClick, disabled, tone, primary }]
 * warning: shown in rose instead of the message (e.g. "this debuffs your K♦")
 * children: extra controls shown before the buttons (the draw's depth picker)
 */
const MuushigControls = ({ message = "", warning = null, buttons = [], sortMode = "rank", onSortModeChange, children }) => {
  const primary = buttons.find((b) => b.primary && !b.disabled);

  useEffect(() => {
    if (!primary) return;
    const onKey = (e) => {
      if (e.code !== "Space" || e.target.closest?.("input, textarea")) return;
      e.preventDefault();
      primary.onClick();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [primary]);

  return (
    <div className="flex items-center justify-between gap-3 mt-1 px-2">
      <div className="flex-1 min-w-0 flex items-center gap-3 px-3 py-2" style={{ backgroundColor: "#0a0712", border: "3px solid #1f1a3d", minHeight: 46 }}>
        <div className="font-pixel-body text-[20px] leading-none" style={{ color: warning ? "#e85a7a" : "rgba(200,184,144,0.85)" }}>
          {warning || message}
        </div>
      </div>

      {/* Sort toggle — works any time, not just on your turn */}
      <div
        className="flex items-stretch gap-1 p-1"
        role="group"
        aria-label="Sort hand"
        style={{ backgroundColor: "#0a0712", border: "3px solid #1f1a3d" }}
      >
        <span className="font-pixel-display text-[10px] text-bone/60 self-center px-2">SORT</span>
        {[
          ["rank", "RANK"],
          ["suit", "SUIT"],
        ].map(([mode, label]) => {
          const on = sortMode === mode;
          return (
            <button
              key={mode}
              onClick={() => onSortModeChange?.(mode)}
              aria-pressed={on}
              className="pixel-btn font-pixel-display text-[10px] px-3 py-2"
              style={{
                backgroundColor: on ? "#9bd14f" : "#1f1a3d",
                borderColor: on ? "#6a9a30" : "#0a0712",
                color: on ? "#1a3a0e" : "#ead8b1",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {children}

      {buttons.map((b) => (
        <button
          key={b.label}
          onClick={b.onClick}
          disabled={b.disabled}
          className={`pixel-btn font-pixel-display text-sm px-6 py-3 whitespace-nowrap ${b.primary && !b.disabled ? "pulse-gold" : ""}`}
          style={TONES[b.tone] || TONES.green}
        >
          {b.label}
          {b.primary && !b.disabled && <span className="text-[8px] ml-1">(SPACE)</span>}
        </button>
      ))}
    </div>
  );
};

export default MuushigControls;
