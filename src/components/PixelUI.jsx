// PIXEL UI — the shared building blocks of the lobby and profile screens:
// panels with a colored header bar, solid pixel buttons, and the top bar.

import React from "react";
import { useNavigate } from "react-router-dom";
import PixelIcon from "./PixelIcon";
import { useServerStats } from "../hooks/useServerStats";
import { INK, TONES } from "./pixelTokens";

export function Panel({ title, icon, deep, children, className = "", right }) {
  return (
    <section
      className={`flex flex-col min-h-0 ${className}`}
      style={{
        backgroundColor: "#14102a",
        border: `4px solid ${deep}`,
        boxShadow: `0 0 0 4px ${INK}, inset 0 4px 0 rgba(255,255,255,0.05)`,
      }}
    >
      <header
        className="flex items-center gap-2.5 px-3 shrink-0"
        style={{
          height: "var(--hdr)",
          backgroundColor: deep,
          borderBottom: `4px solid ${INK}`,
          color: INK,
        }}
      >
        {icon && <PixelIcon name={icon} size={16} />}
        <h2 className="font-pixel-display text-[12px] uppercase leading-none">{title}</h2>
        {right && <div className="ml-auto">{right}</div>}
      </header>
      {children}
    </section>
  );
}

/** Solid pixel button. `tone` = { bg, deep, ink }. */
export function Btn({ tone, onClick, disabled, children, className = "", style, type = "button", title }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`pixel-btn font-pixel-display text-[12px] uppercase flex items-center justify-center gap-2 ${className}`}
      style={{
        height: "var(--ctl)",
        backgroundColor: tone.bg,
        borderColor: tone.deep,
        color: tone.ink,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/** Small button that sits inside a panel's header bar. */
export function HeaderBtn({ onClick, bg, children, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center gap-2 font-pixel-display text-[10px] uppercase px-2 py-1.5 leading-none"
      style={{ color: INK, backgroundColor: bg, boxShadow: `0 0 0 2px ${INK}` }}
    >
      {children}
    </button>
  );
}

/**
 * Top bar: a back button, the screen title in its accent color, server status
 * and settings. `onBack` defaults to the main menu.
 */
export function TopBar({ title, accent, backLabel = "Menu", onBack, onSettings }) {
  const navigate = useNavigate();
  const { connected, online } = useServerStats();

  return (
    <div
      className="flex items-center gap-4 px-4 sm:px-6 shrink-0"
      style={{ height: 60, background: "#14102a", borderBottom: `4px solid ${INK}` }}
    >
      <Btn tone={TONES.dusk} onClick={onBack || (() => navigate("/"))} className="px-3" style={{ height: 40 }}>
        <PixelIcon name="back" size={14} />
        {backLabel}
      </Btn>

      <h1
        className="font-pixel-display text-[16px] sm:text-[18px] uppercase tracking-wider"
        style={{ color: accent, textShadow: `3px 3px 0 ${INK}` }}
      >
        {title}
      </h1>

      <div className="ml-auto flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-2 font-pixel-body text-[20px] text-bone">
          <span
            className="inline-block"
            style={{
              width: 10,
              height: 10,
              backgroundColor: connected ? "#5fd4d6" : "#e85a7a",
              boxShadow: `0 0 0 2px ${INK}`,
            }}
          />
          {connected ? (online != null ? `${online} online` : "Connected") : "Server offline"}
        </div>
        <Btn
          tone={TONES.dusk}
          onClick={onSettings}
          title="Settings"
          style={{ height: 40, width: 40, padding: 0 }}
        >
          <PixelIcon name="gear" size={16} />
        </Btn>
      </div>
    </div>
  );
}

/**
 * Three-step signal meter drawn as pixel bars, for ping and connection state.
 * `level` is 0-3; unlit bars stay visible in a dim tone.
 */
export function SignalBars({ level, color }) {
  return (
    <span className="inline-flex items-end gap-0.5" aria-hidden>
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          style={{ width: 4, height: 4 + n * 3, backgroundColor: n <= level ? color : "#2a234d" }}
        />
      ))}
    </span>
  );
}
