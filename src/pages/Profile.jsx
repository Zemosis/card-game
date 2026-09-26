// PROFILE — edit your identity on the left, read your record on the right.
//
// Reached from the Adventurer card's Edit button in any game lobby. Guests
// get a sign-in prompt instead: they have no saved profile or stats.

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PixelAvatar } from "../components/PixelCard";
import PixelIcon from "../components/PixelIcon";
import { Panel, Btn, TopBar } from "../components/PixelUI";
import { INK, TONES, inputStyle } from "../components/pixelTokens";
import RatingChart from "../components/profile/RatingChart";
import PlacementBars from "../components/profile/PlacementBars";
import SettingsModal from "../components/SettingsModal";
import LoginModal from "../components/auth/LoginModal";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";
import { connectSocket } from "../utils/socket";

const ACCENT = "#f4c430";
const EXP_PER_LEVEL = 100;
const PRESETS = ["1", "2", "3", "4", "5"];
const GAME_NAMES = { thirteen: "Thirteen", muushig: "Muushig" };
const PLACE = ["1st", "2nd", "3rd", "4th"];

const num = (v) => (v == null ? null : Number(v));

function formatDuration(seconds) {
  const s = num(seconds) || 0;
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

// ------------------------------------------------------------ edit side ----

function EditProfile() {
  const navigate = useNavigate();
  const { identity, profile, updateProfile, signOut } = useAuth();
  const [name, setName] = useState(identity.name);
  const [tag, setTag] = useState(identity.tag);
  const [avatar, setAvatar] = useState(String(profile?.avatar || identity.avatar));
  const [status, setStatus] = useState({ kind: "idle", text: "" });

  const dirty =
    name !== identity.name || tag !== identity.tag || avatar !== String(profile?.avatar || identity.avatar);
  const valid = name.length >= 1 && tag.length === 4;
  const expIntoLevel = identity.exp % EXP_PER_LEVEL;

  async function save(e) {
    e.preventDefault();
    if (!valid) return;
    setStatus({ kind: "busy", text: "" });
    try {
      await updateProfile({ username: name, tag, avatar });
      setStatus({ kind: "ok", text: "Profile saved" });
    } catch (err) {
      setStatus({ kind: "error", text: err.message || "Couldn't save your profile" });
    }
  }

  const options = [...PRESETS, ...(identity.customAvatar ? ["custom"] : [])];

  return (
    <Panel title="Edit profile" icon="pencil" deep="#c89820" className="min-h-0">
      <form onSubmit={save} className="flex-1 flex flex-col gap-5 p-4 overflow-y-auto min-h-0">
        {/* Preview: exactly how other players see you. */}
        <div className="flex items-center gap-4">
          <div style={{ boxShadow: `0 0 0 4px ${INK}` }}>
            <PixelAvatar
              variant={avatar === "custom" ? "custom" : Number(avatar)}
              size={88}
              customAvatarData={identity.customAvatar}
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-pixel-display text-[18px] text-parchment">{name || "?"}</span>
              <span className="font-pixel-body text-[26px] text-bone">#{tag.padEnd(4, "_")}</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span
                className="font-pixel-display text-[10px] px-1.5 py-1 leading-none"
                style={{ backgroundColor: ACCENT, color: INK, boxShadow: `0 0 0 2px ${INK}` }}
              >
                LV {identity.level}
              </span>
              <span className="font-pixel-body text-[20px] text-bone">
                {expIntoLevel}/{EXP_PER_LEVEL} XP to level {identity.level + 1}
              </span>
            </div>
            <div className="font-pixel-body text-[20px] text-bone/70 mt-1">{identity.coins} coins</div>
          </div>
        </div>

        <fieldset>
          <legend className="font-pixel-display text-[11px] text-parchment mb-3">Avatar</legend>
          <div className="flex flex-wrap gap-2.5">
            {options.map((v) => {
              const selected = avatar === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAvatar(v)}
                  aria-pressed={selected}
                  aria-label={v === "custom" ? "Your painted avatar" : `Avatar ${v}`}
                  style={{
                    padding: 3,
                    backgroundColor: selected ? "#2a1f1a" : INK,
                    boxShadow: `0 0 0 3px ${selected ? ACCENT : "#2a234d"}`,
                  }}
                >
                  <PixelAvatar
                    variant={v === "custom" ? "custom" : Number(v)}
                    size={44}
                    customAvatarData={identity.customAvatar}
                  />
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => navigate("/avatar-paint")}
              className="flex flex-col items-center justify-center gap-1 font-pixel-display text-[9px] uppercase text-bone"
              style={{ width: 50, height: 50, backgroundColor: INK, boxShadow: "0 0 0 3px #2a234d" }}
              title="Paint your own avatar"
            >
              <PixelIcon name="pencil" size={14} />
              Paint
            </button>
          </div>
        </fieldset>

        <div className="grid gap-3" style={{ gridTemplateColumns: "minmax(0,1fr) 120px" }}>
          <label className="flex flex-col gap-2">
            <span className="font-pixel-display text-[11px] text-parchment">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
              className="font-pixel-display text-[14px] px-3 text-parchment uppercase"
              style={{ ...inputStyle, height: 48, letterSpacing: "0.12em" }}
            />
            <span className="font-pixel-body text-[18px] text-bone/70">Up to 6 letters or digits</span>
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-pixel-display text-[11px] text-parchment">Tag</span>
            <input
              value={tag}
              onChange={(e) => setTag(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4))}
              className="font-pixel-display text-[14px] px-3 text-parchment uppercase"
              style={{ ...inputStyle, height: 48, letterSpacing: "0.2em" }}
            />
            <span className="font-pixel-body text-[18px] text-bone/70">Exactly 4</span>
          </label>
        </div>

        <div className="flex flex-col gap-3 mt-auto">
          {status.text && (
            <p
              role={status.kind === "error" ? "alert" : "status"}
              className="font-pixel-body text-[22px]"
              style={{ color: status.kind === "error" ? "#e85a7a" : "#9bd14f" }}
            >
              {status.text}
            </p>
          )}
          <Btn
            tone={{ bg: ACCENT, deep: "#c89820", ink: INK }}
            type="submit"
            disabled={!dirty || !valid || status.kind === "busy"}
            className="w-full"
            style={{ height: 48 }}
          >
            {status.kind === "busy" ? "Saving..." : "Save changes"}
          </Btn>
          <Btn
            tone={TONES.dusk}
            onClick={() => {
              signOut();
              navigate("/");
            }}
            className="w-full"
            style={{ height: 44 }}
          >
            Sign out
          </Btn>
        </div>
      </form>
    </Panel>
  );
}

// ----------------------------------------------------------- stats side ----

function StatTile({ label, value, note }) {
  return (
    <div className="flex flex-col gap-2 p-3" style={{ backgroundColor: INK, boxShadow: "0 0 0 2px #2a234d" }}>
      <span className="font-pixel-body text-[20px] text-bone leading-none">{label}</span>
      <span className="font-pixel-display text-[20px] text-parchment leading-none">{value}</span>
      <span className="font-pixel-body text-[18px] text-bone/70 leading-none">{note}</span>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="flex flex-col gap-3 min-w-0">
      <h3 className="font-pixel-display text-[11px] text-parchment">{title}</h3>
      {children}
    </section>
  );
}

function StatsSheet({ data, onPlay }) {
  const s = data.stats || {};
  const games = num(s.games_played) || 0;
  const streak = num(data.streaks?.current_streak) || 0;

  if (!games) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <PixelIcon name="cards" size={56} color="#2a234d" />
        <p className="font-pixel-display text-[13px] text-parchment">No matches yet</p>
        <p className="font-pixel-body text-[24px] text-bone/80 max-w-md leading-tight">
          Finish a game while signed in and your rating, placements and match history build up here.
        </p>
        <Btn tone={TONES.poison} onClick={onPlay} className="px-5" style={{ height: 48 }}>
          <PixelIcon name="play" size={14} />
          Play Thirteen
        </Btn>
      </div>
    );
  }

  const winRate = num(s.win_rate);
  const recent = [...data.history].reverse().slice(0, 8);

  return (
    <div className="flex-1 flex flex-col gap-6 p-4 overflow-y-auto min-h-0">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatTile label="Rating" value={s.rating ?? "?"} note={`Best finish ${PLACE[s.best_position - 1] || "-"}`} />
        <StatTile label="Games" value={games} note={`${num(s.wins)} won, ${num(s.losses)} lost`} />
        <StatTile
          label="Win rate"
          value={winRate == null ? "-" : `${winRate}%`}
          note={`Avg place ${s.avg_position == null ? "-" : Number(s.avg_position).toFixed(1)}`}
        />
        <StatTile
          label="Streak"
          value={streak === 0 ? "-" : `${Math.abs(streak)} ${streak > 0 ? "W" : "L"}`}
          note={`Longest win run ${num(data.streaks?.longest_win_streak) || 0}`}
        />
      </div>

      <Section title={`Rating, last ${data.history.length} matches`}>
        <RatingChart history={data.history} />
        <p className="font-pixel-body text-[18px] text-bone/70">Filled squares are wins.</p>
      </Section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Finishing places">
          <PlacementBars placements={data.placements} />
        </Section>

        <Section title="Record">
          <dl
            className="grid font-pixel-body text-[20px]"
            style={{ gridTemplateColumns: "minmax(0,1fr) auto", rowGap: 6, columnGap: 16 }}
          >
            {data.gameTypes.map((g) => (
              <React.Fragment key={g.game_type}>
                <dt className="text-bone">{GAME_NAMES[g.game_type] || g.game_type}</dt>
                <dd className="text-parchment text-right tabular-nums">
                  {num(g.wins)}/{num(g.games_played)} won
                </dd>
              </React.Fragment>
            ))}
            <dt className="text-bone">Rounds won</dt>
            <dd className="text-parchment text-right tabular-nums">
              {num(s.rounds_won)} of {num(s.rounds_played)}
            </dd>
            <dt className="text-bone">Best score</dt>
            <dd className="text-parchment text-right tabular-nums">{s.best_score ?? "-"}</dd>
            <dt className="text-bone">Left early</dt>
            <dd className="text-parchment text-right tabular-nums">{num(s.abandons)}</dd>
            <dt className="text-bone">Time played</dt>
            <dd className="text-parchment text-right tabular-nums">{formatDuration(s.total_seconds_played)}</dd>
          </dl>
        </Section>
      </div>

      <Section title="Recent matches">
        <div className="flex flex-col">
          {recent.map((m, i) => (
            <div
              key={m.session_id}
              className="grid items-center gap-3 px-3 font-pixel-body text-[20px]"
              style={{
                gridTemplateColumns: "56px minmax(0,1fr) 90px 90px 110px",
                minHeight: 44,
                backgroundColor: i % 2 ? "#181432" : "transparent",
              }}
            >
              <span
                className="font-pixel-display text-[10px] text-center py-1"
                style={{
                  backgroundColor: m.is_winner ? ACCENT : INK,
                  color: m.is_winner ? INK : "#ead8b1",
                  boxShadow: "0 0 0 2px #2a234d",
                }}
              >
                {m.left_early ? "Quit" : PLACE[m.final_position - 1] || "-"}
              </span>
              <span className="text-parchment truncate">{GAME_NAMES[m.game_type] || m.game_type}</span>
              <span className="text-bone text-right tabular-nums">{m.final_score ?? "-"} pts</span>
              <span className="text-right tabular-nums" style={{ color: m.rating_delta > 0 ? "#9bd14f" : m.rating_delta < 0 ? "#e85a7a" : "#c8b890" }}>
                {m.rating_delta > 0 ? "+" : ""}
                {m.rating_delta ?? 0}
              </span>
              <span className="text-bone/70 text-right">{new Date(m.finished_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function StatsPanel() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/stats")
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <Panel title="Stats" icon="star" deep="#463a78" className="min-h-0 h-full">
      {error ? (
        <p role="alert" className="p-6 font-pixel-body text-[22px] text-rose">
          Couldn't load your stats: {error}
        </p>
      ) : !data ? (
        <p className="p-6 font-pixel-body text-[22px] text-bone">Loading your stats...</p>
      ) : (
        <StatsSheet data={data} onPlay={() => navigate("/lobby-13")} />
      )}
    </Panel>
  );
}

// ------------------------------------------------------------ the screen ----

export default function Profile() {
  const navigate = useNavigate();
  const { isGuest, loading, identity } = useAuth();
  const [showSettings, setShowSettings] = useState(false);

  // Keeps the top bar's server status live, as on every other screen.
  useEffect(() => {
    connectSocket({ name: identity.name, tag: identity.tag });
  }, [identity.name, identity.tag]);
  const [showLogin, setShowLogin] = useState(false);

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate("/"));

  return (
    <div className="relative w-full h-screen starfield font-pixel-body text-parchment flex flex-col overflow-hidden">
      <TopBar
        title="Profile"
        accent={ACCENT}
        backLabel="Back"
        onBack={back}
        onSettings={() => setShowSettings(true)}
      />

      {loading ? null : isGuest ? (
        <main className="flex-1 flex items-center justify-center p-4">
          <Panel title="Profile" icon="user" deep="#c89820" className="max-w-md w-full">
            <div className="flex flex-col items-center gap-4 p-6 text-center">
              <p className="font-pixel-body text-[24px] text-bone leading-tight">
                Sign in to pick your name and avatar and keep your stats between games.
              </p>
              <Btn tone={TONES.poison} onClick={() => setShowLogin(true)} className="px-6" style={{ height: 48 }}>
                Sign in
              </Btn>
            </div>
          </Panel>
        </main>
      ) : (
        <main className="flex-1 min-h-0 w-full max-w-[1480px] mx-auto p-4 grid gap-4 grid-cols-1 lg:grid-cols-[420px_minmax(0,1fr)] overflow-y-auto lg:overflow-hidden">
          <EditProfile />
          <StatsPanel />
        </main>
      )}

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </div>
  );
}
