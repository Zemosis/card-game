// MAIN MENU - Pixel Retro Landing Page

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  PixelCard,
  PixelButton,
} from "../components/PixelCard";
import { useAuth } from "../hooks/useAuth";
import LoginModal from "../components/auth/LoginModal";
import AvatarPickerDropdown from "../components/auth/AvatarPickerDropdown";

const MainMenu = () => {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const { identity, isGuest, signOut, updateProfile } = useAuth();

  return (
    <div className="relative w-full h-screen starfield font-pixel-body text-parchment overflow-hidden flex flex-col">
      {/* Distant pixel mountains silhouette */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "20%",
          background: "linear-gradient(180deg, transparent 0%, #0a0712 100%)",
          pointerEvents: "none",
        }}
      />
      <Mountains />

      {/* TOP BAR */}
      <div className="relative flex items-center justify-between px-8 py-3">
        <div className="flex items-center gap-3">
          <div
            style={{
              width: 36,
              height: 36,
              background:
                "linear-gradient(180deg, #f4c430 0%, #c89820 50%, #6b3a1f 100%)",
              border: "3px solid #0a0712",
              boxShadow: "2px 2px 0 #0a0712, inset 0 0 0 1px #ffe066",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 16,
              color: "#1a1024",
              textShadow: "1px 1px 0 rgba(255,224,102,0.5)",
            }}
          >
            ♠
          </div>
          <div className="font-pixel-display text-[14px] tracking-wider text-glow-gold">
            CARD-LORE
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 px-3 py-2"
            style={{
              backgroundColor: "#1f1a3d",
              border: "3px solid #0a0712",
              boxShadow: "inset 0 2px 0 0 rgba(255,255,255,0.06)",
            }}
          >
            <AvatarPickerDropdown
              currentVariant={identity.avatar}
              size={24}
              disabled={isGuest}
              onSelect={(v) => updateProfile({ avatar: v })}
              customAvatarData={identity.customAvatar}
              onNavigatePaint={() => navigate("/avatar-paint")}
            />
            <div>
              <div className="font-pixel-display text-[8px] text-bone uppercase">
                {isGuest ? "Guest" : "Player"}
              </div>
              <div className="font-pixel-body text-xs text-parchment leading-none">
                {identity.name} #{identity.tag}
              </div>
            </div>
          </div>
          {isGuest ? (
            <PixelButton color="gold" size="md" onClick={() => setShowLogin(true)}>
              <span>☻</span>
              <span className="ml-2">Sign In</span>
            </PixelButton>
          ) : (
            <PixelButton color="dusk" size="md" onClick={signOut}>
              <span>◄</span>
              <span className="ml-2">Sign Out</span>
            </PixelButton>
          )}
          <button
            className="pixel-btn font-pixel-display text-xs px-4 py-2.5 uppercase relative"
            style={{
              backgroundColor: "#463a78",
              borderColor: "#2a234d",
              color: "#ead8b1",
            }}
            title="Coming soon — spend coins on card skins"
          >
            <span style={{ marginRight: 6 }}>◉</span>
            Shop
            <span
              className="font-pixel-display"
              style={{
                position: "absolute",
                top: -8,
                right: -8,
                fontSize: 7,
                padding: "2px 4px",
                backgroundColor: "#e85a7a",
                color: "#ead8b1",
                border: "2px solid #0a0712",
                letterSpacing: "0.05em",
              }}
            >
              SOON
            </span>
          </button>
          <button
            className="pixel-btn font-pixel-display"
            style={{
              backgroundColor: "#463a78",
              borderColor: "#2a234d",
              color: "#ead8b1",
              width: 44,
              height: 44,
              padding: 0,
              fontSize: 16,
            }}
          >
            ⚙
          </button>
        </div>
      </div>

      {/* HERO */}
      <div className="relative flex flex-col items-center pt-4 pb-2">
        <div className="font-pixel-body text-bone text-sm tracking-[0.4em] uppercase mb-1">
          ▰ Khuzur Card Hall ▰
        </div>
        <h1
          className="font-pixel-display text-[36px] leading-tight mb-1"
          style={{
            color: "#fff7d8",
            textShadow:
              "2px 2px 0 #1a1024, 0 0 18px rgba(255,247,216,0.55), 0 0 32px rgba(244,196,48,0.35)",
          }}
        >
          CHOOSE YOUR GAME
        </h1>
        <div className="font-pixel-body text-xl text-parchment/70">
          The dungeon-master deals tonight. Pick a table, summon your wits.
        </div>
      </div>

      {/* GAME CARDS */}
      <div className="relative flex-1 flex items-start justify-center gap-10 px-8 pt-2 min-h-0">
        <GameTile
          id="13"
          title="THIRTEEN"
          subtitle={'"13" — Tien Len'}
          tag="4 PLAYERS"
          desc="Climb to victory by playing combinations. Eliminate opponents and rule the table."
          accent="gold"
          cards={[
            { rank: "A", suit: "♠" },
            { rank: "K", suit: "♥" },
            { rank: "Q", suit: "♦" },
            { rank: "J", suit: "♣" },
            { rank: "10", suit: "♠" },
          ]}
          difficulty={2}
          plays={1247}
          hovered={hovered === "13"}
          onMouseEnter={() => setHovered("13")}
          onMouseLeave={() => setHovered(null)}
          onClick={() => navigate("/lobby-13")}
        />
        <GameTile
          id="muushig"
          title="MUUSHIG"
          subtitle="Mongolian Trickster"
          tag="5 PLAYERS"
          desc="Traditional Mongolian trick-taking. Avoid the cat — pass the burden — bleed the deck dry."
          accent="rose"
          cards={[
            { rank: "2", suit: "♣" },
            { rank: "3", suit: "♦" },
            { rank: "4", suit: "♥" },
            { rank: "5", suit: "♠" },
            { rank: "6", suit: "♣" },
          ]}
          difficulty={3}
          plays={418}
          hovered={hovered === "muushig"}
          onMouseEnter={() => setHovered("muushig")}
          onMouseLeave={() => setHovered(null)}
          onClick={() => navigate("/lobby-muushig")}
        />
        <GameTile
          id="locked"
          title="???"
          subtitle="??? — Locked"
          tag="COMING"
          desc="A new game stirs in the deck. Reach Rank V to unlock the third table of cards."
          accent="dusk"
          locked
          difficulty={0}
          hovered={hovered === "locked"}
          onMouseEnter={() => setHovered("locked")}
          onMouseLeave={() => setHovered(null)}
        />
      </div>

      {/* FOOTER */}
      <div className="relative">
        <div className="checker-strip h-2" />
        <div className="flex items-center justify-between px-8 py-2 bg-void">
          <div className="font-pixel-body text-bone/60 text-sm">
            <span className="text-glow-cyan">▼</span> v1.0.0 — patch{" "}
            <span className="text-parchment">"CUTE RAY"</span>
          </div>
          <div className="flex items-center gap-4 font-pixel-body text-bone/70 text-sm">
            <span>247 ONLINE</span>
            <span className="text-mist">|</span>
            <span>32 TABLES OPEN</span>
            <span className="text-mist">|</span>
            <span className="text-glow-gold">PING 24MS</span>
          </div>
        </div>
      </div>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </div>
  );
};

function GameTile({
  title,
  subtitle,
  tag,
  desc,
  accent,
  cards = [],
  difficulty = 1,
  plays = 0,
  locked,
  hovered,
  onMouseEnter,
  onMouseLeave,
  onClick,
}) {
  const accentMap = {
    gold: {
      border: "#c89820",
      bg: "#2a1f1a",
      text: "#f4c430",
      tagBg: "#f4c430",
      tagText: "#1a1024",
    },
    rose: {
      border: "#a83a5a",
      bg: "#2a0e18",
      text: "#e85a7a",
      tagBg: "#e85a7a",
      tagText: "#3a0e1a",
    },
    dusk: {
      border: "#2a234d",
      bg: "#14102a",
      text: "#7a6abf",
      tagBg: "#463a78",
      tagText: "#ead8b1",
    },
  }[accent];

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={!locked ? onClick : undefined}
      className="cursor-pointer transition-transform"
      style={{
        width: 320,
        transform: hovered && !locked ? "translateY(-8px)" : "translateY(0)",
        transition: "transform 120ms ease",
      }}
    >
      <div
        className="relative"
        style={{
          backgroundColor: accentMap.bg,
          border: `4px solid ${accentMap.border}`,
          boxShadow:
            hovered && !locked
              ? `0 0 0 4px #0a0712, 0 12px 0 #0a0712, inset 0 4px 0 rgba(255,255,255,0.08), 0 0 28px ${accentMap.text}55`
              : "0 0 0 4px #0a0712, 0 6px 0 #0a0712, inset 0 4px 0 rgba(255,255,255,0.06)",
          transition: "box-shadow 120ms ease",
        }}
      >
        {/* Tag stripe */}
        <div
          className="flex items-center justify-between px-3 py-1.5"
          style={{
            backgroundColor: accentMap.tagBg,
            borderBottom: "4px solid #0a0712",
          }}
        >
          <span
            className="font-pixel-display text-[9px]"
            style={{ color: accentMap.tagText }}
          >
            {tag}
          </span>
          <span
            className="font-pixel-display text-[9px]"
            style={{ color: accentMap.tagText }}
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} style={{ opacity: i < difficulty ? 1 : 0.25 }}>
                ★
              </span>
            ))}
          </span>
        </div>

        {/* Card preview */}
        <div className="relative h-[110px] flex items-end justify-center pb-2 dither-light overflow-hidden">
          {locked ? (
            <div
              style={{
                fontSize: 70,
                color: "#463a78",
                fontFamily: "'Press Start 2P', monospace",
                textShadow: "4px 4px 0 #0a0712",
              }}
            >
              ?
            </div>
          ) : (
            <div className="flex" style={{ marginTop: 24 }}>
              {cards.map((c, i) => {
                const mid = (cards.length - 1) / 2;
                return (
                  <div
                    key={i}
                    style={{
                      marginLeft: i === 0 ? 0 : -24,
                      transform: hovered
                        ? `rotate(${(i - mid) * 9}deg) translateY(${Math.abs(i - mid) * 3 - 8}px)`
                        : `rotate(${(i - mid) * 6}deg) translateY(${Math.abs(i - mid) * 2}px)`,
                      transformOrigin: "bottom center",
                      zIndex: i,
                      transition: "transform 200ms ease",
                    }}
                  >
                    <PixelCard rank={c.rank} suit={c.suit} size="medium" />
                  </div>
                );
              })}
            </div>
          )}

          {hovered && !locked && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: `radial-gradient(circle at 50% 60%, ${accentMap.text}33 0%, transparent 60%)`,
                pointerEvents: "none",
              }}
            />
          )}
        </div>

        {/* Title block */}
        <div
          className="px-5 py-2"
          style={{ borderTop: "3px solid #0a0712", backgroundColor: "#0a0712" }}
        >
          <div className="font-pixel-body text-bone text-xs uppercase tracking-widest">
            {subtitle}
          </div>
          <div
            className="font-pixel-display text-2xl text-shadow-hard mb-2"
            style={{ color: accentMap.text }}
          >
            {title}
          </div>
          <div className="font-pixel-body text-base text-parchment/80 leading-snug mb-2 min-h-[40px]">
            {desc}
          </div>

          <div className="flex items-center justify-between">
            <div className="font-pixel-body text-bone/70 text-sm">
              <span style={{ color: "#5fd4d6" }}>☻</span>
              <span className="ml-1">
                {locked ? "—" : plays.toLocaleString()} plays
              </span>
            </div>
            {locked ? (
              <div
                className="font-pixel-display text-[10px] px-3 py-2"
                style={{
                  backgroundColor: "#0a0712",
                  color: "#7a6abf",
                  border: "2px solid #2a234d",
                }}
              >
                LOCKED
              </div>
            ) : (
              <PixelButton
                color={accent === "gold" ? "gold" : "rose"}
                size="md"
              >
                ► PLAY
              </PixelButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Mountains() {
  return (
    <svg
      viewBox="0 0 1280 200"
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        width: "100%",
        height: 200,
        opacity: 0.6,
        pointerEvents: "none",
      }}
    >
      <path
        d="M0,200 L0,140 L60,140 L60,120 L100,120 L100,100 L140,100 L140,80 L180,80 L180,100 L220,100 L220,120 L260,120 L260,140 L320,140 L320,110 L360,110 L360,90 L400,90 L400,70 L440,70 L440,90 L480,90 L480,120 L540,120 L540,150 L600,150 L600,130 L640,130 L640,100 L680,100 L680,80 L720,80 L720,110 L760,110 L760,130 L820,130 L820,150 L880,150 L880,120 L920,120 L920,90 L960,90 L960,110 L1000,110 L1000,140 L1060,140 L1060,160 L1120,160 L1120,130 L1160,130 L1160,110 L1200,110 L1200,140 L1240,140 L1240,160 L1280,160 L1280,200 Z"
        fill="#1a1530"
      />
      <path
        d="M0,200 L0,170 L80,170 L80,160 L160,160 L160,180 L240,180 L240,160 L320,160 L320,170 L400,170 L400,150 L480,150 L480,170 L560,170 L560,160 L640,160 L640,180 L720,180 L720,160 L800,160 L800,170 L880,170 L880,150 L960,150 L960,170 L1040,170 L1040,160 L1120,160 L1120,180 L1200,180 L1200,160 L1280,160 L1280,200 Z"
        fill="#0a0712"
      />
    </svg>
  );
}

export default MainMenu;
