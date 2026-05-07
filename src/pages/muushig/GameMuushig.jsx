// GAME MUUSHIG - Pixel Retro Round Table (5 players)

import React from "react";
import { useNavigate } from "react-router-dom";
import { PixelCard, PixelAvatar, CardFan } from "../../components/PixelCard";

// Placeholder game state for UI preview
const SEATS = [
  { seat: 0, x: 0, y: 290, name: "YOU", variant: "me", cards: 5, wins: 1, score: 12, isMe: true, active: false, dealer: false },
  { seat: 1, x: -310, y: 95, name: "StarryEye", variant: 2, cards: 5, wins: 0, score: 20, isMe: false, active: false, dealer: false },
  { seat: 2, x: -330, y: -155, name: "GrandmaJ", variant: 3, cards: 5, wins: 3, score: 4, isMe: false, active: true, dealer: false, leader: true },
  { seat: 3, x: 330, y: -155, name: "glitch_19", variant: 4, cards: 5, wins: 0, score: 15, isMe: false, active: false, dealer: false },
  { seat: 4, x: 310, y: 95, name: "YakRider", variant: 1, cards: 5, wins: 2, score: 8, isMe: false, active: false, dealer: true },
];

const PILE = [
  { rank: "A", suit: "♠", who: "YakRider (trump)", isTrump: true },
  { rank: "6", suit: "♠", who: "YakRider" },
  { rank: "9", suit: "♠", who: "glitch_19" },
  { rank: "K", suit: "♠", who: "GrandmaJ" },
];

const MUUSHIG_HAND = [
  { rank: "J", suit: "♣" },
  { rank: "8", suit: "♦" },
  { rank: "9", suit: "♥" },
  { rank: "10", suit: "♠" },
  { rank: "Q", suit: "♣" },
];

const MUUSHIG_LOG = [
  { id: "1", type: "SYSTEM", text: "Round 4 begins. YakRider deals.", timestamp: "14:31" },
  { id: "2", type: "SYSTEM", text: "Trump suit revealed: ♠", timestamp: "14:31" },
  { id: "3", type: "SYSTEM", text: "GrandmaJ leads K♠.", timestamp: "14:31" },
  { id: "4", type: "CHAT", sender: "StarryEye", text: "rude opener", timestamp: "14:31", isMe: false },
  { id: "5", type: "SYSTEM", text: "YakRider plays 6♠.", timestamp: "14:32" },
  { id: "6", type: "SYSTEM", text: "glitch_19 plays 9♠.", timestamp: "14:32" },
  { id: "7", type: "CHAT", sender: "YOU", text: "gotta burn the J", timestamp: "14:32", isMe: true },
];

const TABLE_SIZE = 380;

const GameMuushig = () => {
  const navigate = useNavigate();
  const trumpCard = PILE[0];
  const topCard = PILE[PILE.length - 1];

  return (
    <div className="relative w-full h-full font-pixel-body text-parchment overflow-hidden flex flex-col" style={{ position: "fixed", inset: 0 }}>
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, #1d3e30 0%, #0e2418 65%, #0a0712 100%)" }} />
      <div className="absolute inset-0 dither-shadow opacity-30 pointer-events-none" />

      {/* HEADER */}
      <div className="relative flex items-center justify-between px-5 py-3 z-10" style={{ backgroundColor: "rgba(10,7,18,0.85)", borderBottom: "4px solid #0a0712" }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="pixel-btn font-pixel-display text-[10px] px-3 py-2" style={{ backgroundColor: "#7a1530", borderColor: "#3a0a18", color: "#ead8b1" }}>◄ EXIT</button>
          <button className="pixel-btn font-pixel-display" style={{ backgroundColor: "#463a78", borderColor: "#2a234d", color: "#ead8b1", width: 36, height: 36, padding: 0, fontSize: 12 }}>⚙</button>
          <div className="font-pixel-display text-[10px] text-bone/60 ml-2">
            LOBBY <span className="text-glow-cyan">#JADE12</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-center px-3 py-1" style={{ backgroundColor: "#0a0712", border: "3px solid #1a3a2c" }}>
            <div className="font-pixel-display text-[8px] text-bone/60 tracking-wider">ROUND</div>
            <div className="font-pixel-display text-sm text-glow-gold">4</div>
          </div>
          <div className="flex flex-col items-center">
            <div className="font-pixel-display text-[8px] text-bone/60 tracking-wider">PLAYING</div>
            <div className="font-pixel-display text-base" style={{ color: "#9bd14f", textShadow: "2px 2px 0 #000, 0 0 8px rgba(155,209,79,0.4)" }}>MUUSHIG</div>
          </div>
          <div className="flex flex-col items-center px-3 py-1" style={{ backgroundColor: "#0a0712", border: "3px solid #1a3a2c" }}>
            <div className="font-pixel-display text-[8px] text-bone/60 tracking-wider">TRUMP</div>
            <div className="font-pixel-display text-sm" style={{ color: "#f4c430" }}>{trumpCard.suit} SPADES</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-pixel-body text-sm">
            <span style={{ color: "#9bd14f" }}>●●●</span>
            <span className="text-bone/70">22ms</span>
          </div>
          <button className="pixel-btn font-pixel-display" style={{ backgroundColor: "#1f1a3d", borderColor: "#0a0712", color: "#ead8b1", width: 36, height: 36, padding: 0, fontSize: 12 }}>♪</button>
        </div>
      </div>

      {/* GAME REGION */}
      <div className="relative flex-1 grid min-h-0" style={{ gridTemplateColumns: "1fr 320px" }}>
        <div className="relative flex flex-col min-h-0">
          {/* ROUND TABLE STAGE */}
          <div className="flex-1 relative flex items-center justify-center min-h-0">
            {/* Round table felt */}
            <div style={{
              position: "relative", width: TABLE_SIZE, height: TABLE_SIZE, borderRadius: "50%",
              background: "radial-gradient(circle at 50% 45%, #2c6650 0%, #1a4030 45%, #0e2418 80%, #061810 100%)",
              border: "6px solid #6b3a1f",
              boxShadow: "0 0 0 4px #0a0712, 0 0 0 12px #2a1810, 0 0 0 16px #0a0712, inset 0 0 0 8px #1a3a2c, inset 0 0 80px rgba(0,0,0,0.6), 0 0 60px rgba(155,209,79,0.10)",
            }}>
              <div style={{ position: "absolute", inset: 16, borderRadius: "50%", border: "2px dashed rgba(155,209,79,0.18)" }} />

              {/* CENTER: Trash + Pile + Trump */}
              <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", display: "flex", alignItems: "center", gap: 28 }}>
                {/* Trash pile */}
                <div style={{ textAlign: "center", width: 70 }}>
                  <div className="font-pixel-display text-[7px] text-bone/60 mb-1 tracking-widest">TRASH</div>
                  <div style={{ position: "relative", width: 50, height: 64, margin: "0 auto" }}>
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} style={{ position: "absolute", left: i * 1.5 - 2, top: i * 1.5, width: 46, height: 60, background: "repeating-linear-gradient(45deg, #2a1a4d 0 3px, #1a0e3a 3px 6px)", border: "2px solid #0a0712", transform: `rotate(${(i - 1.5) * 4}deg)`, boxShadow: "inset 0 0 0 1px #6a4ab0" }} />
                    ))}
                  </div>
                  <div className="font-pixel-display text-[7px] mt-1" style={{ color: "#7a6abf" }}>×17</div>
                </div>

                {/* THE PILE */}
                <div style={{ textAlign: "center" }}>
                  <div className="font-pixel-display text-[7px] mb-1 tracking-widest" style={{ color: "#f4c430" }}>ON TOP</div>
                  <div style={{ position: "relative", width: 70, height: 96, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {PILE.length > 1 && Array.from({ length: Math.min(PILE.length - 1, 3) }).map((_, i) => (
                      <div key={i} style={{ position: "absolute", left: 4 + i * 2, top: 4 + i * 2, width: 56, height: 80, background: "#0a0712", border: "2px solid #1f1a3d", opacity: 0.5 }} />
                    ))}
                    <div style={{ position: "relative", filter: "drop-shadow(0 0 12px rgba(244,196,48,0.5)) drop-shadow(2px 2px 0 #000)", animation: "float 2.4s ease-in-out infinite" }}>
                      <PixelCard rank={topCard.rank} suit={topCard.suit} size="medium" />
                    </div>
                  </div>
                  <div className="font-pixel-display text-[8px] mt-1" style={{ color: "#ead8b1" }}>{topCard.who.toUpperCase()}</div>
                  <div className="font-pixel-body text-xs text-bone/60 mt-0.5">pile · {PILE.length} cards</div>
                </div>

                {/* Trump indicator */}
                <div style={{ textAlign: "center", width: 70 }}>
                  <div className="font-pixel-display text-[7px] mb-1 tracking-widest" style={{ color: "#f4c430" }}>TRUMP</div>
                  <div style={{ padding: 3, border: "3px solid #f4c430", background: "rgba(244,196,48,0.12)", boxShadow: "0 0 10px rgba(244,196,48,0.4), 0 0 0 2px #0a0712", display: "inline-block" }}>
                    <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 22, color: "#f4c430", padding: "8px 12px", textShadow: "2px 2px 0 #000" }}>{trumpCard.suit}</div>
                  </div>
                  <div className="font-pixel-display text-[7px] mt-1" style={{ color: "#bbb" }}>BURIED</div>
                </div>
              </div>

              <div style={{ position: "absolute", left: "50%", bottom: 18, transform: "translateX(-50%)", textAlign: "center" }}>
                <div className="font-pixel-display text-[8px] text-bone/60 tracking-widest">ROUND PILE · WINNER TAKES ALL</div>
              </div>
            </div>

            {/* Opponent seats */}
            {SEATS.filter((s) => !s.isMe).map((seat) => (
              <div key={seat.seat} style={{ position: "absolute", left: "50%", top: "50%", transform: `translate(-50%, -50%) translate(${seat.x}px, ${seat.y}px)`, width: 200, pointerEvents: "none" }}>
                <SeatPanel seat={seat} />
              </div>
            ))}
          </div>

          {/* MY HAND */}
          <MyHand hand={MUUSHIG_HAND} me={SEATS[0]} trumpSuit={trumpCard.suit} />
        </div>

        {/* SIDEBAR */}
        <Sidebar5 seats={SEATS} messages={MUUSHIG_LOG} />
      </div>
    </div>
  );
};

function SeatPanel({ seat }) {
  return (
    <div style={{ pointerEvents: "auto" }}>
      <div className="relative w-full" style={{
        backgroundColor: "#0e2418",
        border: `4px solid ${seat.active ? "#f4c430" : seat.dealer ? "#5fd4d6" : "#0a0712"}`,
        boxShadow: seat.active
          ? "0 0 0 4px #0a0712, 0 0 16px rgba(244,196,48,0.5), inset 0 4px 0 rgba(255,255,255,0.06)"
          : seat.dealer
            ? "0 0 0 4px #0a0712, 0 0 12px rgba(95,212,214,0.35), inset 0 4px 0 rgba(255,255,255,0.04)"
            : "0 0 0 4px #0a0712, inset 0 4px 0 rgba(255,255,255,0.04)",
        animation: seat.active ? "pulse-glow 1.6s ease-in-out infinite" : "none",
        padding: "8px 10px",
      }}>
        <div className="flex items-center gap-2.5">
          <PixelAvatar variant={seat.variant} size={36} active={seat.active} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <div className="font-pixel-display text-[10px] text-parchment truncate">{seat.name}</div>
              {seat.active && <span className="font-pixel-display text-[7px] px-1 blink" style={{ backgroundColor: "#f4c430", color: "#1a1024" }}>TURN</span>}
              {seat.dealer && <span className="font-pixel-display text-[7px] px-1" style={{ backgroundColor: "#5fd4d6", color: "#0a3a3a" }}>DEAL</span>}
              {seat.leader && <span className="font-pixel-display text-[7px] px-1" style={{ backgroundColor: "#9bd14f", color: "#1a3a0e" }}>LEAD</span>}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-pixel-body text-xs text-bone/70">{seat.cards}c</span>
              <span className="font-pixel-body text-xs" style={{ color: "#f4c430" }}>● {seat.score}pt</span>
            </div>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div className="font-pixel-display text-[8px] text-bone/60">EATEN</div>
          <PipRow won={seat.wins} total={5} />
        </div>
      </div>
    </div>
  );
}

function PipRow({ won, total }) {
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: 14, height: 14,
          backgroundColor: i < won ? "#f4c430" : "#0a0712",
          border: i < won ? "2px solid #c89820" : "2px solid #1f1a3d",
          boxShadow: i < won ? "inset 0 1px 0 rgba(255,255,255,0.3)" : "none",
        }} />
      ))}
    </div>
  );
}

function MyHand({ hand, me, trumpSuit }) {
  return (
    <div className="px-6 pb-3 pt-1 relative z-10" style={{ background: "linear-gradient(180deg, transparent 0%, rgba(10,7,18,0.6) 40%, rgba(10,7,18,0.9) 100%)" }}>
      <div className="flex items-center justify-between mb-2 px-2">
        <div className="font-pixel-body text-base text-bone/70">
          <span className="text-glow-gold">YOUR HAND</span> · {hand.length} cards · trump <span style={{ color: "#f4c430" }}>{trumpSuit}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-pixel-display text-[8px] text-bone/60">SORT</span>
          <button className="font-pixel-display text-[9px] px-2 py-1" style={{ backgroundColor: "#9bd14f", color: "#1a3a0e", border: "2px solid #0a0712" }}>SUIT</button>
          <button className="font-pixel-display text-[9px] px-2 py-1" style={{ backgroundColor: "#1f1a3d", color: "#ead8b1", border: "2px solid #0a0712" }}>RANK</button>
        </div>
      </div>

      <div className="relative flex items-end justify-center pb-2" style={{ height: 110 }}>
        {hand.map((c, i) => {
          const mid = (hand.length - 1) / 2;
          const offset = (i - mid) * 60;
          const isLegal = c.suit === trumpSuit || hand.every((x) => x.suit !== trumpSuit);
          return (
            <div key={i} style={{
              position: "absolute", left: "50%", bottom: 0,
              transform: `translateX(calc(-50% + ${offset}px)) rotate(${(i - mid) * 3}deg)`,
              transformOrigin: "bottom center", zIndex: i,
            }}>
              <PixelCard rank={c.rank} suit={c.suit} size="medium" selectable dim={!isLegal} />
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 px-2 mt-1">
        <div className="flex-1 flex items-center gap-3 px-3 py-2" style={{ backgroundColor: "#0a0712", border: "3px solid #1a3a2c" }}>
          <PixelAvatar variant="me" size={32} />
          <div className="flex-1">
            <div className="font-pixel-display text-[10px]" style={{ color: "#9bd14f" }}>{me.name} · Lv.7</div>
            <div className="font-pixel-body text-sm text-bone/70">
              Eaten: <span className="text-glow-gold">{me.wins}/5</span> · Score: <span className="text-glow-gold">{me.score}pt</span>
              <span className="text-bone/40"> (lower = better)</span>
            </div>
          </div>
          <PipRow won={me.wins} total={5} />
        </div>
        <button className="pixel-btn font-pixel-display text-sm px-6 py-3" style={{ backgroundColor: "#7a1530", borderColor: "#3a0a18", color: "#ead8b1" }}>✕ DISCARD</button>
        <button className="pixel-btn font-pixel-display text-sm px-8 py-3" style={{ backgroundColor: "#9bd14f", borderColor: "#6a9a30", color: "#1a3a0e" }}>► THROW CARD</button>
      </div>
    </div>
  );
}

function Sidebar5({ seats, messages }) {
  const [tab, setTab] = React.useState("chat");
  const ranked = [...seats].sort((a, b) => a.score - b.score);

  return (
    <div className="flex flex-col min-h-0 border-l-4" style={{ borderColor: "#0a0712", background: "#0e0a1f" }}>
      {/* SCOREBOARD */}
      <div style={{ borderBottom: "4px solid #0a0712" }}>
        <div className="px-3 py-2 font-pixel-display text-[10px] tracking-wider flex items-center justify-between" style={{ backgroundColor: "#1a1024", color: "#f4c430" }}>
          <span>✦ SCOREBOARD ✦</span>
          <span className="text-bone/60">RD 4 · TO 0</span>
        </div>
        <div className="px-3 py-2 flex flex-col gap-1.5">
          {seats.map((p) => {
            const place = ranked.findIndex((r) => r.seat === p.seat) + 1;
            const delta = p.wins > 0 ? -p.wins : +5;
            const placeColors = ["#f4c430", "#c8b890", "#c89820", "#7a1530", "#5a4a8a"];
            return (
              <div key={p.seat} className="flex items-center gap-2 px-2 py-1.5" style={{ backgroundColor: p.active ? "#2e1a3a" : "#14102a", border: p.isMe ? "2px solid #5fd4d6" : "2px solid #1f1a3d" }}>
                <div className="font-pixel-display text-[10px]" style={{ color: placeColors[place - 1], width: 20 }}>#{place}</div>
                <PixelAvatar variant={p.variant} size={24} active={p.active} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <div className="font-pixel-display text-[9px] text-parchment truncate">{p.name}</div>
                    {p.dealer && <span className="font-pixel-display text-[7px] px-1" style={{ backgroundColor: "#5fd4d6", color: "#0a3a3a" }}>D</span>}
                  </div>
                  <div className="font-pixel-body text-xs text-bone/60">{p.wins} eaten</div>
                </div>
                <div className="text-right">
                  <div className="font-pixel-display text-[10px] text-glow-gold">{p.score}pt</div>
                  <div className="font-pixel-body text-xs" style={{ color: delta < 0 ? "#9bd14f" : delta > 0 ? "#e85a7a" : "#7a6abf" }}>
                    {delta > 0 ? "+" : ""}{delta}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CHAT */}
      <div className="flex flex-col flex-1 min-h-0">
        <div className="px-3 py-2 font-pixel-display text-[10px] tracking-wider flex items-center justify-between" style={{ backgroundColor: "#1a1024", color: "#5fd4d6" }}>
          <div className="flex gap-3">
            <button onClick={() => setTab("chat")} style={{ color: tab === "chat" ? "#5fd4d6" : "#7a6abf" }}>✉ CHAT</button>
            <button onClick={() => setTab("log")} style={{ color: tab === "log" ? "#5fd4d6" : "#7a6abf" }}>☰ LOG</button>
          </div>
          <span className="text-bone/60 text-[8px]">{messages.length} MSGS</span>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-2 text-sm">
          {messages.filter((m) => tab === "log" ? m.type === "SYSTEM" : true).map((m) => (
            <ChatBubble key={m.id} m={m} />
          ))}
        </div>

        <div className="p-2 flex gap-1.5" style={{ borderTop: "3px solid #1f1a3d", backgroundColor: "#14102a" }}>
          <input placeholder="Say something..." className="flex-1 font-pixel-body text-base px-2 py-2 text-parchment" style={{ backgroundColor: "#0a0712", border: "2px solid #1f1a3d", boxShadow: "inset 0 2px 0 0 rgba(0,0,0,0.5)" }} />
          <button className="pixel-btn font-pixel-display text-[10px] px-3" style={{ backgroundColor: "#5fd4d6", borderColor: "#2a8a8c", color: "#0a3a3a" }}>►</button>
        </div>
        <div className="px-2 pb-2 flex gap-1 flex-wrap">
          {["gg", "wp", "eat", "cat?", "lol", "?"].map((q) => (
            <button key={q} className="font-pixel-body text-xs px-2 py-1" style={{ backgroundColor: "#1f1a3d", color: "#bbb", border: "2px solid #0a0712" }}>{q}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ m }) {
  if (m.type === "SYSTEM") {
    return (
      <div className="font-pixel-body text-sm text-bone/60 italic px-2">
        <span className="text-mist">› </span>{m.text} <span className="text-bone/30 text-xs">{m.timestamp}</span>
      </div>
    );
  }
  return (
    <div className={`flex gap-2 ${m.isMe ? "flex-row-reverse" : ""}`}>
      <PixelAvatar variant={m.isMe ? "me" : 2} size={20} />
      <div className="max-w-[80%]">
        <div className={`flex items-center gap-1 ${m.isMe ? "justify-end" : ""}`}>
          <span className="font-pixel-display text-[9px]" style={{ color: m.isMe ? "#5fd4d6" : "#f4c430" }}>{m.sender}</span>
          <span className="font-pixel-body text-xs text-bone/40">{m.timestamp}</span>
        </div>
        <div className="font-pixel-body text-base px-2 py-1 mt-0.5" style={{ backgroundColor: m.isMe ? "#2a8a8c" : "#1f1a3d", color: m.isMe ? "#0a3a3a" : "#ead8b1", border: "2px solid #0a0712" }}>
          {m.text}
        </div>
      </div>
    </div>
  );
}

export default GameMuushig;
