// GAME LOBBY — the one lobby screen every game mode shares.
//
// A game passes a config (see pages/thirteen/LobbySelection.jsx) naming its
// title, accent, route and socket events; everything else — layout, identity
// card, hosting, joining, practice and the table list — lives here so new
// games get the same screen for free.
//
// Layout: a fixed-width left column of four panels and a table list filling
// the rest. The three action panels share one row height (1fr each) and one
// internal structure — a header and two control rows — so the column reads as
// a symmetric stack at any viewport height. Control heights scale with the
// viewport (--ctl) so the whole screen fits without scrolling from 1366x657
// laptops up to 1080p.

import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { socket, connectSocket } from "../../utils/socket";
import { PixelAvatar } from "../PixelCard";
import PixelIcon from "../PixelIcon";
import { useAuth } from "../../hooks/useAuth";
import { Panel, Btn, HeaderBtn, TopBar } from "../PixelUI";
import { INK, TONES, inputStyle } from "../pixelTokens";
import SettingsModal from "../SettingsModal";
import LoginModal from "../auth/LoginModal";

const CODE_LENGTH = 6;
const EXP_PER_LEVEL = 100;

const DIFFICULTIES = [
  { id: "EASY", label: "Easy", color: "#9bd14f", deep: "#6a9a30", skulls: 1 },
  { id: "MEDIUM", label: "Medium", color: "#f4c430", deep: "#c89820", skulls: 2 },
  { id: "HARD", label: "Hard", color: "#e85a7a", deep: "#a83a5a", skulls: 3 },
];

// ------------------------------------------------------------ adventurer ----

function AdventurerCard({ game, onSignIn }) {
  const navigate = useNavigate();
  const { identity, isGuest } = useAuth();
  const expIntoLevel = identity.exp % EXP_PER_LEVEL;
  const pct = (expIntoLevel / EXP_PER_LEVEL) * 100;

  // The one action lives in the header so the body stays a single tight row.
  const action = isGuest ? (
    <HeaderBtn onClick={onSignIn} bg="#9bd14f">
      Sign in
    </HeaderBtn>
  ) : (
    <HeaderBtn onClick={() => navigate("/profile")} bg="#ead8b1" title="Edit profile and see your stats">
      <PixelIcon name="pencil" size={12} />
      Edit
    </HeaderBtn>
  );

  return (
    <Panel title="Adventurer" icon="user" deep={game.accent.deep} right={action}>
      <div className="flex items-center gap-3" style={{ padding: "var(--pad) 12px" }}>
        <div style={{ boxShadow: `0 0 0 3px ${INK}` }}>
          <PixelAvatar variant={identity.avatar} size={52} customAvatarData={identity.customAvatar} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="font-pixel-display text-[15px] text-parchment truncate">
              {identity.name}
            </span>
            <span className="font-pixel-body text-[22px] text-bone leading-none">#{identity.tag}</span>
            {isGuest && (
              <span className="ml-auto font-pixel-display text-[9px] uppercase text-bone/60">Guest</span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-2">
            <span
              className="font-pixel-display text-[10px] px-1.5 py-1 leading-none shrink-0"
              style={{ backgroundColor: game.accent.main, color: INK, boxShadow: `0 0 0 2px ${INK}` }}
            >
              LV {identity.level}
            </span>
            <div
              className="flex-1 relative"
              style={{ height: 12, backgroundColor: INK, boxShadow: "0 0 0 2px #2a234d" }}
              role="progressbar"
              aria-label="Experience toward next level"
              aria-valuenow={expIntoLevel}
              aria-valuemin={0}
              aria-valuemax={EXP_PER_LEVEL}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  backgroundColor: game.accent.main,
                  boxShadow: "inset 0 3px 0 rgba(255,255,255,0.35)",
                }}
              />
            </div>
            <span className="font-pixel-body text-[20px] text-bone leading-none shrink-0">
              {expIntoLevel}/{EXP_PER_LEVEL} XP
            </span>
          </div>
        </div>
      </div>
    </Panel>
  );
}

// --------------------------------------------------------- action panels ----

/** Body of an action panel: two control rows, vertically centred. */
function ActionBody({ children }) {
  return (
    <div className="flex-1 flex flex-col justify-center gap-2.5 min-h-0" style={{ padding: "var(--pad)" }}>
      {children}
    </div>
  );
}

function HostPanel({ game, onCreate }) {
  const [name, setName] = useState(game.defaultTableName);
  return (
    <Panel title="Host a table" icon="crown" deep="#2a8a8c">
      <ActionBody>
        <label className="sr-only" htmlFor="table-name">
          Table name
        </label>
        <input
          id="table-name"
          value={name}
          maxLength={24}
          onChange={(e) => setName(e.target.value)}
          placeholder="Table name"
          className="w-full font-pixel-body text-[22px] px-3 text-parchment placeholder:text-mist"
          style={inputStyle}
        />
        <div className="grid grid-cols-2 gap-2.5">
          <Btn tone={TONES.cyan} onClick={() => onCreate(name, false)} title="Anyone can join from the list">
            <PixelIcon name="globe" size={14} />
            Public
          </Btn>
          <Btn tone={TONES.rose} onClick={() => onCreate(name, true)} title="Only people with the code can join">
            <PixelIcon name="lock" size={14} />
            Private
          </Btn>
        </div>
      </ActionBody>
    </Panel>
  );
}

function JoinPanel({ onJoin }) {
  const [code, setCode] = useState("");
  const inputRef = useRef(null);
  const chars = code.padEnd(CODE_LENGTH, " ").split("");
  const ready = code.length === CODE_LENGTH;

  function submit(e) {
    e.preventDefault();
    if (ready) onJoin(code);
  }

  return (
    <Panel title="Join with a code" icon="key" deep="#a83a5a">
      <form onSubmit={submit} className="contents">
        <ActionBody>
          {/* The boxes are a picture of the real input laid over them. */}
          <div className="relative" onClick={() => inputRef.current?.focus()}>
            <div className="grid grid-cols-6 gap-2" aria-hidden>
              {chars.map((ch, i) => {
                const filled = ch.trim();
                const active = i === code.length;
                return (
                  <div
                    key={i}
                    className="flex items-center justify-center font-pixel-display text-[18px]"
                    style={{
                      ...inputStyle,
                      borderColor: filled ? "#e85a7a" : active ? "#6b5a9a" : "#2a234d",
                      color: filled ? "#ead8b1" : "#463a78",
                    }}
                  >
                    {filled || ""}
                  </div>
                );
              })}
            </div>
            <input
              ref={inputRef}
              aria-label="Table code"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, CODE_LENGTH))
              }
              autoComplete="off"
              spellCheck={false}
              className="absolute inset-0 w-full h-full opacity-0 cursor-text"
            />
          </div>
          <Btn tone={TONES.rose} type="submit" disabled={!ready} className="w-full">
            <PixelIcon name="play" size={14} />
            Join table
          </Btn>
        </ActionBody>
      </form>
    </Panel>
  );
}

function PracticePanel({ onStart }) {
  return (
    <Panel title="Practice vs CPU" icon="skull" deep="#6a9a30">
      <ActionBody>
        {/* Exactly two control rows tall, like the other panels; shrinks if cramped. */}
        <div className="grid grid-cols-3 gap-2.5 min-h-0" style={{ height: "calc(var(--ctl) * 2 + 10px)" }}>
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              onClick={() => onStart(d.id)}
              className="pixel-btn flex flex-col items-center justify-center gap-2"
              style={{ backgroundColor: INK, borderColor: d.deep, color: d.color }}
              title={`Start a ${d.label.toLowerCase()} game against the computer`}
            >
              <span className="font-pixel-display text-[12px] uppercase">{d.label}</span>
              <span className="flex gap-1">
                {[1, 2, 3].map((n) => (
                  <PixelIcon key={n} name="skull" size={12} color={n <= d.skulls ? d.color : "#2a234d"} />
                ))}
              </span>
            </button>
          ))}
        </div>
      </ActionBody>
    </Panel>
  );
}

// ------------------------------------------------------------- tables ----

function SeatPips({ current, max, color }) {
  return (
    <div className="flex items-center gap-1" aria-label={`${current} of ${max} seats taken`}>
      {Array.from({ length: max }).map((_, j) => (
        <div
          key={j}
          style={{
            width: 10,
            height: 14,
            backgroundColor: j < current ? color : "#2a234d",
            boxShadow: `0 0 0 1px ${INK}`,
          }}
        />
      ))}
      <span className="ml-1.5 font-pixel-body text-[20px] text-bone">
        {current}/{max}
      </span>
    </div>
  );
}

function TablesPanel({ game, lobbies, onJoin, onRefresh }) {
  const cols = "minmax(0,2fr) minmax(0,1.3fr) 120px 110px";
  return (
    <Panel
      title="Open tables"
      icon="cards"
      deep="#463a78"
      className="h-full"
      right={
        <HeaderBtn onClick={onRefresh} bg="#8a7ac0">
          <PixelIcon name="refresh" size={12} />
          Refresh
        </HeaderBtn>
      }
    >
      <div
        className="grid items-center px-4 shrink-0 font-pixel-display text-[10px] uppercase text-bone/70"
        style={{ gridTemplateColumns: cols, height: 36, backgroundColor: INK }}
      >
        <div>Table</div>
        <div>Host</div>
        <div>Seats</div>
        <div />
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {lobbies.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 p-6 text-center">
            <PixelIcon name="cards" size={48} color="#2a234d" />
            <p className="font-pixel-display text-[12px] text-parchment uppercase">No open tables</p>
            <p className="font-pixel-body text-[22px] text-bone/80 max-w-sm leading-tight">
              Host a public table and it appears here for everyone playing {game.title}.
            </p>
          </div>
        ) : (
          lobbies.map((lobby, i) => {
            const full = lobby.current >= lobby.max;
            return (
              <div
                key={lobby.id}
                className="grid items-center px-4 gap-3"
                style={{
                  gridTemplateColumns: cols,
                  minHeight: 60,
                  backgroundColor: i % 2 ? "#181432" : "transparent",
                  borderBottom: "2px solid #1f1a3d",
                }}
              >
                <div className="min-w-0">
                  <div className="font-pixel-display text-[12px] text-parchment truncate">{lobby.name}</div>
                  <div className="font-pixel-body text-[18px] text-bone/60 leading-none mt-1">{lobby.id}</div>
                </div>
                <div className="font-pixel-body text-[22px] text-bone truncate">{lobby.host}</div>
                <SeatPips current={lobby.current} max={lobby.max} color={game.accent.main} />
                <div className="flex justify-end">
                  <Btn
                    tone={full ? TONES.dusk : TONES.poison}
                    disabled={full}
                    onClick={() => onJoin(lobby.id)}
                    className="px-4"
                    style={{ height: 40 }}
                  >
                    {full ? "Full" : "Join"}
                  </Btn>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------ the screen ----

export default function GameLobby({ game }) {
  const navigate = useNavigate();
  const { identity } = useAuth();
  const [lobbies, setLobbies] = useState([]);
  const [error, setError] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  const playerName = `${identity.name} #${identity.tag}`;
  const ev = game.events;

  useEffect(() => {
    connectSocket({ name: identity.name, tag: identity.tag });
  }, [identity.name, identity.tag]);

  useEffect(() => {
    let errorTimer;
    const refresh = () => socket.emit(ev.list);
    const onJoined = (data) => navigate(game.route, { state: { ...data, playerName } });
    const onError = (msg) => {
      setError(msg);
      clearTimeout(errorTimer);
      errorTimer = setTimeout(() => setError(""), 4000);
    };

    refresh();
    socket.on("connect", refresh);
    socket.on(ev.listUpdate, setLobbies);
    socket.on(ev.joined, onJoined);
    socket.on("error_message", onError);
    if (ev.listTrigger) socket.on(ev.listTrigger, refresh);
    return () => {
      if (ev.listTrigger) socket.off(ev.listTrigger, refresh);
      clearTimeout(errorTimer);
      socket.off("connect", refresh);
      socket.off(ev.listUpdate, setLobbies);
      socket.off(ev.joined, onJoined);
      socket.off("error_message", onError);
    };
  }, [ev, game.route, navigate, playerName]);

  function createTable(name, isPrivate) {
    socket.emit(ev.create, {
      lobbyName: name.trim() || `${identity.name}'s table`,
      playerName,
      isPrivate,
    });
  }

  function joinTable(lobbyId) {
    socket.emit(ev.join, { lobbyId, playerName });
  }

  function startPractice(difficulty) {
    navigate(game.route, {
      state: {
        lobbyId: `SOLO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        isHost: true,
        playerName,
        mySocketId: socket.id || `solo-${Date.now()}`,
        myPlayerIndex: 0,
        aiDifficulty: difficulty,
      },
    });
  }

  return (
    <div
      className="relative w-full h-screen starfield font-pixel-body text-parchment flex flex-col overflow-hidden"
    >
      <TopBar title={game.title} accent={game.accent.main} onSettings={() => setShowSettings(true)} />

      {error && (
        <div
          role="alert"
          className="absolute left-1/2 -translate-x-1/2 z-20 font-pixel-body text-[22px] px-4 py-2"
          style={{ top: 72, backgroundColor: "#7a1530", color: "#ead8b1", boxShadow: `0 0 0 4px ${INK}` }}
        >
          {error}
        </div>
      )}

      <main
        className="flex-1 min-h-0 w-full max-w-[1480px] mx-auto grid grid-cols-1 lg:grid-cols-[400px_minmax(0,1fr)] overflow-y-auto lg:overflow-hidden"
        style={{ padding: "var(--gap)", gap: "var(--gap)" }}
      >
        <div className="grid min-h-0 lg:grid-rows-[auto_repeat(3,minmax(0,1fr))]" style={{ gap: "var(--gap)" }}>
          <AdventurerCard game={game} onSignIn={() => setShowLogin(true)} />
          <HostPanel game={game} onCreate={createTable} />
          <JoinPanel onJoin={joinTable} />
          <PracticePanel onStart={startPractice} />
        </div>
        <div className="min-h-[420px] lg:min-h-0">
          <TablesPanel
            game={game}
            lobbies={lobbies}
            onJoin={joinTable}
            onRefresh={() => socket.emit(ev.list)}
          />
        </div>
      </main>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </div>
  );
}
