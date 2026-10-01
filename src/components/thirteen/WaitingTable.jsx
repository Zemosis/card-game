// WAITING TABLE — an online table before the deal (Thirteen's 4 seats or
// Muushig's 5). Seats sit where they will during the match (you at the
// bottom); empty ones are shadow spots the host can fill with CPUs. The felt
// holds the invite panel and the START button. The game page shows this until
// the server's first game state.

import React, { useState } from "react";
import { PixelAvatar } from "../PixelCard";
import PixelIcon from "../PixelIcon";
import GameChat from "./GameChat";
import { seatAvatar } from "../../utils/avatarConstants";
import { positionOf } from "../../utils/seatPosition";

const SIDE_SEAT_W = 224;

const shortName = (name = "") => name.split(" #")[0];

function SeatSlot({ seat, index, isHost, onAddCpu, onRemoveCpu, face }) {
  const base = "relative flex flex-col items-center justify-center gap-2 px-3 py-3 text-center";
  const size = { width: 184, minHeight: 124 };

  if (!seat) {
    return (
      <div
        className={base}
        style={{ ...size, border: "4px dashed #2a234d", backgroundColor: "rgba(20,16,42,0.45)" }}
      >
        <PixelIcon name="user" size={24} color="#2a234d" />
        <div className="font-pixel-display text-[10px] text-bone/40">EMPTY SEAT</div>
        {isHost && (
          <button
            onClick={() => onAddCpu(index)}
            aria-label={`Add CPU to seat ${index + 1}`}
            className="pixel-btn font-pixel-display text-[9px] px-2 py-1.5"
            style={{ backgroundColor: "#463a78", borderColor: "#2a234d", color: "#ead8b1" }}
          >
            + ADD CPU
          </button>
        )}
      </div>
    );
  }

  const isCpu = seat.kind === "cpu";
  const avatar = face || (isCpu ? { variant: (index % 5) + 1, customAvatarData: null } : seatAvatar(seat, index));
  return (
    <div
      className={base}
      style={{
        ...size,
        backgroundColor: "#14102a",
        border: "4px solid #0a0712",
        boxShadow: "0 0 0 4px #0a0712, inset 0 4px 0 rgba(255,255,255,0.04)",
        opacity: !isCpu && !seat.connected ? 0.55 : 1,
      }}
    >
      {seat.isHost && (
        <span
          className="absolute -top-3 left-2 font-pixel-display text-[9px] px-1.5 py-1 flex items-center gap-1"
          style={{ backgroundColor: "#f4c430", color: "#1a1024", boxShadow: "0 0 0 2px #0a0712" }}
        >
          <PixelIcon name="crown" size={9} /> HOST
        </span>
      )}
      {isCpu && isHost && (
        <button
          onClick={() => onRemoveCpu(index)}
          aria-label={`Remove ${seat.name}`}
          className="absolute -top-3 right-2 pixel-hbtn px-1 py-0.5"
          style={{ backgroundColor: "#7a1530", color: "#ead8b1", boxShadow: "0 0 0 2px #0a0712" }}
        >
          <PixelIcon name="close" size={10} />
        </button>
      )}
      <PixelAvatar variant={avatar.variant} customAvatarData={avatar.customAvatarData} size={44} />
      <div className="font-pixel-display text-[10px] text-parchment truncate max-w-full">
        {isCpu ? seat.name : shortName(seat.name)}
      </div>
      {!isCpu && !seat.connected && (
        <div className="font-pixel-body text-[16px] text-rose blink">reconnecting…</div>
      )}
    </div>
  );
}

function InvitePanel({ table, seatedCount, hostName, onStart, errorMessage }) {
  const [copied, setCopied] = useState(null);
  // One START per press: a double-click would be rejected after the game has
  // already begun. A rejection (e.g. no longer host) re-arms the button.
  const [starting, setStarting] = useState(false);
  const [seenError, setSeenError] = useState(errorMessage);
  if (errorMessage !== seenError) {
    setSeenError(errorMessage);
    if (errorMessage) setStarting(false);
  }
  const copy = async (what, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
    }
  };
  const link = `${window.location.origin}/join/${table.code}`;

  return (
    <div
      className="flex flex-col items-center gap-4 p-6 text-center"
      style={{ backgroundColor: "rgba(10,7,18,0.8)", border: "4px solid #0a0712", boxShadow: "0 0 0 4px #463a78", maxWidth: 520 }}
    >
      <div className="font-pixel-display text-[14px] text-glow-gold">WAITING FOR PLAYERS</div>
      <div className="font-pixel-body text-[22px] text-bone/80">
        {seatedCount}/{table.seats.length} seated
      </div>

      <div className="flex flex-col items-center gap-1">
        <div className="font-pixel-display text-[9px] text-bone/60 flex items-center gap-2">
          <PixelIcon name={table.isPrivate ? "lock" : "globe"} size={10} />
          {table.isPrivate ? "PRIVATE TABLE CODE" : "TABLE CODE"}
        </div>
        <div className="font-pixel-display text-[22px] tracking-[0.3em] text-glow-cyan">{table.code}</div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => copy("code", table.code)}
          className="pixel-btn font-pixel-display text-[10px] px-3 py-2"
          style={{ backgroundColor: "#463a78", borderColor: "#2a234d", color: "#ead8b1" }}
        >
          COPY CODE
        </button>
        <button
          onClick={() => copy("link", link)}
          className="pixel-btn font-pixel-display text-[10px] px-3 py-2"
          style={{ backgroundColor: "#5fd4d6", borderColor: "#2a8a8c", color: "#0a2a2c" }}
        >
          COPY INVITE LINK
        </button>
      </div>
      <div className="font-pixel-body text-[18px] text-glow-cyan h-5" aria-live="polite">
        {copied === "code" ? "Code copied!" : copied === "link" ? "Invite link copied!" : ""}
      </div>

      {table.isHost ? (
        <>
          <button
            onClick={() => {
              setStarting(true);
              onStart();
            }}
            disabled={starting}
            className="pixel-btn font-pixel-display text-[14px] px-8 py-4 flex items-center gap-3"
            style={{ backgroundColor: "#f4c430", borderColor: "#c89820", color: "#1a1024" }}
          >
            <PixelIcon name="play" size={14} /> START GAME
          </button>
          <div className="font-pixel-body text-[18px] text-bone/60">Empty seats are filled with CPUs when you start.</div>
        </>
      ) : (
        <div className="font-pixel-display text-[10px] text-bone/70 blink">Waiting for {hostName} to start</div>
      )}
    </div>
  );
}

export default function WaitingTable({
  table,
  messages,
  onSendMessage,
  onExit,
  onAddCpu,
  onRemoveCpu,
  onStart,
  errorMessage,
  myFace,
  title = "THIRTEEN",
  titleClass = "text-glow-gold",
  titleColor,
}) {
  const five = table.seats.length === 5;
  const at = {};
  table.seats.forEach((seat, i) => {
    at[positionOf(i, table.mySeat, table.seats.length)] = { seat, index: i };
  });
  const slot = (pos) => (
    <SeatSlot
      seat={at[pos].seat}
      index={at[pos].index}
      isHost={table.isHost}
      onAddCpu={onAddCpu}
      onRemoveCpu={onRemoveCpu}
      face={pos === "bottom" ? myFace : undefined}
    />
  );
  const seatedCount = table.seats.filter(Boolean).length;
  const hostName = shortName(table.seats.find((s) => s?.isHost)?.name || "the host");

  return (
    <div className="relative w-full h-full font-pixel-body text-parchment overflow-hidden flex flex-col" style={{ position: "fixed", inset: 0 }}>
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, #2e0f1d 0%, #14102a 60%, #0a0712 100%)" }} />

      <div
        className="relative flex items-center justify-between px-5 py-3 z-10"
        style={{ backgroundColor: "rgba(10,7,18,0.85)", borderBottom: "4px solid #0a0712" }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onExit}
            className="pixel-btn font-pixel-display text-[10px] px-3 py-2"
            style={{ backgroundColor: "#7a1530", borderColor: "#3a0a18", color: "#ead8b1" }}
          >
            <span className="flex items-center gap-2"><PixelIcon name="back" size={12} />EXIT</span>
          </button>
          <div className="font-pixel-display text-[10px] text-bone/60 ml-2">
            {table.name.toUpperCase()} <span className="text-glow-cyan">#{table.code}</span>
          </div>
        </div>
        <div className={`font-pixel-display text-base ${titleClass}`} style={{ color: titleColor }}>
          {title}
        </div>
        <div style={{ width: 120 }} />
      </div>

      <div className="relative flex-1 grid min-h-0" style={{ gridTemplateColumns: "minmax(0, 1fr) 300px" }}>
        <div className="relative flex flex-col items-center justify-between min-h-0 px-4 py-4">
          {five ? (
            <div className="flex justify-center gap-10">
              {slot("topLeft")}
              {slot("topRight")}
            </div>
          ) : (
            slot("top")
          )}
          <div
            className="grid items-center gap-4 w-full mx-auto"
            style={{ gridTemplateColumns: `${SIDE_SEAT_W}px minmax(0,1fr) ${SIDE_SEAT_W}px`, maxWidth: SIDE_SEAT_W * 2 + 820 + 32 }}
          >
            <div className="flex justify-center">{slot(five ? "bottomLeft" : "left")}</div>
            <div className="flex flex-col items-center gap-3">
              <InvitePanel table={table} seatedCount={seatedCount} hostName={hostName} onStart={onStart} errorMessage={errorMessage} />
              {errorMessage && (
                <div role="alert" className="font-pixel-body text-[20px] px-3 py-1" style={{ backgroundColor: "#7a1530", color: "#ead8b1" }}>
                  {errorMessage}
                </div>
              )}
            </div>
            <div className="flex justify-center">{slot(five ? "bottomRight" : "right")}</div>
          </div>
          {slot("bottom")}
        </div>

        <div className="flex flex-col min-h-0 border-l-4" style={{ borderColor: "#0a0712", background: "#0e0a1f" }}>
          <GameChat messages={messages} onSendMessage={onSendMessage} />
        </div>
      </div>
    </div>
  );
}
