// LOBBY MUUSHIG - Pixel Retro Style

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { socket } from "../../utils/socket";
import {
  PixelButton,
  PixelPanel,
  PixelAvatar,
} from "../../components/PixelCard";

const LobbyMuushig = () => {
  const navigate = useNavigate();

  const [playerName, setPlayerName] = useState("Wanderer #4719");
  const [lobbyName, setLobbyName] = useState("Ger of the Steppe");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [publicLobbies, setPublicLobbies] = useState([]);
  const [selectedLobby, setSelectedLobby] = useState(null);

  useEffect(() => {
    socket.emit("get_public_lobbies_muushig");

    socket.on("public_lobbies_muushig_update", (lobbies) => {
      setPublicLobbies(lobbies);
    });

    socket.on("public_lobbies_muushig_update_trigger", () => {
      socket.emit("get_public_lobbies_muushig");
    });

    socket.on("lobby_joined_muushig", (data) => {
      navigate("/game-muushig", { state: { ...data, playerName } });
    });

    socket.on("error_message", (msg) => {
      setError(msg);
      setTimeout(() => setError(""), 3000);
    });

    return () => {
      socket.off("public_lobbies_muushig_update");
      socket.off("public_lobbies_muushig_update_trigger");
      socket.off("lobby_joined_muushig");
      socket.off("error_message");
    };
  }, [navigate, playerName]);

  const handleQuickStart = () => {
    if (!playerName.trim()) {
      setError("Enter a name first!");
      return;
    }
    const lobbyId = `SOLO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    navigate("/game-muushig", {
      state: {
        lobbyId,
        isHost: true,
        playerName: playerName.trim(),
        mySocketId: socket.id || `solo-${Date.now()}`,
        myPlayerIndex: 0,
      },
    });
  };

  const handleCreateLobby = (isPrivate) => {
    if (!playerName.trim()) {
      setError("Enter a name first!");
      return;
    }
    socket.emit("create_lobby_muushig", {
      lobbyName: lobbyName || `${playerName}'s Ger`,
      playerName,
      isPrivate,
    });
  };

  const handleJoinPublic = (lobbyId) => {
    if (!playerName.trim()) {
      setError("Enter a name first!");
      return;
    }
    socket.emit("join_lobby_muushig", { lobbyId, playerName });
  };

  const handleJoinPrivate = () => {
    if (joinCode.length !== 6) {
      setError("Invalid Code: Must be 6 characters");
      return;
    }
    if (!playerName.trim()) {
      setError("Enter a name first!");
      return;
    }
    socket.emit("join_lobby_muushig", { lobbyId: joinCode, playerName });
  };

  const codeChars = (joinCode + "      ").slice(0, 6).split("");

  return (
    <div className="relative w-full h-screen starfield font-pixel-body text-parchment overflow-hidden flex flex-col">
      {/* TOP BAR */}
      <div
        className="flex items-center justify-between px-6 py-3 border-b-4"
        style={{ borderColor: "#0a0712", background: "#14102a" }}
      >
        <div className="flex items-center gap-4">
          <PixelButton color="dusk" size="sm" onClick={() => navigate("/")}>
            ◄ MENU
          </PixelButton>
          <div className="flex items-center gap-2 font-pixel-display text-[10px] tracking-wider">
            <span className="text-bone/60">DECK ▸</span>
            <span style={{ color: "#9bd14f", textShadow: "2px 2px 0 #000, 0 0 8px rgba(155,209,79,0.5)" }}>MUUSHIG</span>
            <span className="text-bone/60">▸ LOBBY</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <PixelAvatar variant="me" size={32} />
          <span className="font-pixel-body text-base text-bone">
            {playerName}
          </span>
          <button
            className="pixel-btn font-pixel-display"
            style={{
              backgroundColor: "#463a78",
              borderColor: "#2a234d",
              color: "#ead8b1",
              width: 36,
              height: 36,
              padding: 0,
              fontSize: 12,
            }}
          >
            ⚙
          </button>
        </div>
      </div>

      {error && (
        <div
          className="font-pixel-display text-[10px] text-center py-2"
          style={{ backgroundColor: "#7a1530", color: "#ead8b1" }}
        >
          ⚠ {error}
        </div>
      )}

      {/* MAIN GRID */}
      <div className="flex-1 grid grid-cols-[400px_1fr] gap-3 p-3 min-h-0">
        {/* LEFT — actions */}
        <div className="flex flex-col gap-2 min-h-0">
          {/* Player Card */}
          <PixelPanel accent="gold" title="✦ ADVENTURER ✦">
            <div className="p-2 flex items-center gap-3">
              <div style={{ position: "relative" }}>
                <PixelAvatar variant="me" size={48} />
                <div
                  className="absolute -bottom-1 -right-1 font-pixel-display text-[8px] px-1.5 py-1"
                  style={{
                    backgroundColor: "#9bd14f",
                    color: "#1a3a0e",
                    border: "2px solid #0a0712",
                  }}
                >
                  Lv.7
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-pixel-display text-[10px] text-bone/60 mb-1">
                  CALLSIGN
                </div>
                <input
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="w-full font-pixel-display text-sm px-2 py-2 text-parchment uppercase"
                  style={{
                    backgroundColor: "#0a0712",
                    border: "3px solid #1f1a3d",
                    boxShadow: "inset 0 2px 0 0 rgba(0,0,0,0.5)",
                  }}
                />
                <div className="flex items-center gap-3 mt-2 font-pixel-body text-sm">
                  <span className="text-glow-gold">★ 1,247 EXP</span>
                  <span className="text-glow-cyan">◆ 28 W</span>
                </div>
              </div>
            </div>
          </PixelPanel>

          {/* Create Lobby */}
          <PixelPanel accent="cyan" title="⚔ HOST A TABLE ⚔">
            <div className="p-2 flex flex-col gap-2">
              <div>
                <div className="font-pixel-display text-[9px] text-bone/60 mb-1.5">
                  LOBBY NAME
                </div>
                <input
                  value={lobbyName}
                  onChange={(e) => setLobbyName(e.target.value)}
                  className="w-full font-pixel-body text-base px-3 py-2 text-parchment"
                  style={{
                    backgroundColor: "#0a0712",
                    border: "3px solid #1f1a3d",
                    boxShadow: "inset 0 2px 0 0 rgba(0,0,0,0.5)",
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <PixelButton
                  color="cyan"
                  size="md"
                  onClick={() => handleCreateLobby(false)}
                >
                  ◆ PUBLIC
                </PixelButton>
                <PixelButton
                  color="rose"
                  size="md"
                  onClick={() => handleCreateLobby(true)}
                >
                  ⌫ PRIVATE
                </PixelButton>
              </div>
            </div>
          </PixelPanel>

          {/* Join via Code */}
          <PixelPanel accent="rose" title="✉ JOIN BY CODE ✉">
            <div className="p-2">
              <div className="flex gap-1.5 mb-2">
                {codeChars.map((ch, i) => (
                  <div
                    key={i}
                    className="flex-1 h-10 flex items-center justify-center font-pixel-display text-xl"
                    style={{
                      backgroundColor: "#0a0712",
                      border: ch.trim()
                        ? "3px solid #e85a7a"
                        : "3px solid #1f1a3d",
                      boxShadow: ch.trim()
                        ? "inset 0 0 8px rgba(232,90,122,0.4)"
                        : "inset 0 2px 0 0 rgba(0,0,0,0.5)",
                      color: ch.trim() ? "#e85a7a" : "#463a78",
                      textShadow: ch.trim()
                        ? "1px 1px 0 #000, 0 0 6px rgba(232,90,122,0.6)"
                        : "none",
                    }}
                  >
                    {ch.trim() || "_"}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  placeholder="Type code..."
                  value={joinCode}
                  onChange={(e) =>
                    setJoinCode(e.target.value.toUpperCase().slice(0, 6))
                  }
                  maxLength={6}
                  className="flex-1 min-w-0 font-pixel-display text-sm px-3 py-2 text-parchment uppercase"
                  style={{
                    backgroundColor: "#0a0712",
                    border: "3px solid #1f1a3d",
                    boxShadow: "inset 0 2px 0 0 rgba(0,0,0,0.5)",
                    letterSpacing: "0.3em",
                  }}
                />
                <PixelButton color="rose" size="md" onClick={handleJoinPrivate}>
                  ►
                </PixelButton>
              </div>
            </div>
          </PixelPanel>

          {/* Quick Start — Solo vs CPU */}
          <div
            className="flex-shrink-0"
            style={{
              backgroundColor: "#1a3a0e",
              border: "4px solid #6a9a30",
              boxShadow:
                "0 0 0 4px #0a0712, inset 0 4px 0 rgba(255,255,255,0.06)",
            }}
          >
            <div
              className="px-3 py-2 flex items-center justify-between"
              style={{
                backgroundColor: "#6a9a30",
                borderBottom: "4px solid #0a0712",
              }}
            >
              <span
                className="font-pixel-display text-[10px]"
                style={{ color: "#1a3a0e" }}
              >
                ▶ SOLO vs CPU GHOSTS
              </span>
              <span
                className="font-pixel-body text-xs"
                style={{ color: "#1a3a0e" }}
              >
                no server
              </span>
            </div>
            <div className="p-2 flex gap-1.5">
              {[
                {
                  l: "EASY",
                  c: "#9bd14f",
                  bd: "#6a9a30",
                  tx: "#1a3a0e",
                  skulls: 1,
                },
                {
                  l: "MEDIUM",
                  c: "#f4c430",
                  bd: "#c89820",
                  tx: "#1a1024",
                  skulls: 2,
                  active: true,
                },
                {
                  l: "HARD",
                  c: "#e85a7a",
                  bd: "#a83a5a",
                  tx: "#3a0e1a",
                  skulls: 3,
                },
              ].map((d) => (
                <button
                  key={d.l}
                  onClick={handleQuickStart}
                  className="pixel-btn font-pixel-display text-[9px] flex-1 py-2 flex flex-col items-center gap-0.5"
                  style={{
                    backgroundColor: d.active ? d.c : "#0a0712",
                    borderColor: d.active ? d.bd : "#1f1a3d",
                    color: d.active ? d.tx : d.c,
                    boxShadow: d.active
                      ? "inset 0 2px 0 0 rgba(255,255,255,0.18), inset 0 -2px 0 0 rgba(0,0,0,0.4), 0 4px 0 0 #0a0712"
                      : "inset 0 2px 0 0 rgba(255,255,255,0.04), 0 2px 0 0 #0a0712",
                  }}
                >
                  <span>{d.l}</span>
                  <span style={{ fontSize: 8, letterSpacing: 1 }}>
                    {"☠".repeat(d.skulls)}
                    <span style={{ opacity: 0.25 }}>
                      {"☠".repeat(3 - d.skulls)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT — public lobbies */}
        <div className="flex flex-col min-h-0">
          <PixelPanel accent="default" className="flex-1 flex flex-col min-h-0">
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{
                backgroundColor: "#1a1024",
                borderBottom: "4px solid #0a0712",
              }}
            >
              <div className="flex items-center gap-3">
                <span className="font-pixel-display text-[11px] tracking-wider" style={{ color: "#9bd14f", textShadow: "2px 2px 0 #000, 0 0 8px rgba(155,209,79,0.5)" }}>
                  ⚑ PUBLIC TABLES
                </span>
                <span className="font-pixel-body text-sm text-bone/70">
                  {publicLobbies.length} found
                </span>
              </div>
              <button
                onClick={() => socket.emit("get_public_lobbies_muushig")}
                className="pixel-btn font-pixel-display text-[9px] px-2.5 py-1.5"
                style={{
                  backgroundColor: "#463a78",
                  borderColor: "#2a234d",
                  color: "#ead8b1",
                }}
              >
                ↻ REFRESH
              </button>
            </div>

            {/* Header row */}
            <div
              className="grid px-4 py-2 font-pixel-display text-[9px] text-bone/50 tracking-wider"
              style={{
                gridTemplateColumns: "2fr 1.4fr 0.7fr 0.8fr",
                backgroundColor: "#0a0712",
              }}
            >
              <div>TABLE</div>
              <div>HOST</div>
              <div>SEATS</div>
              <div className="text-right">JOIN</div>
            </div>

            <div
              className="flex-1 overflow-y-auto"
              style={{ backgroundColor: "#14102a" }}
            >
              {publicLobbies.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-bone/50">
                  <div
                    style={{
                      fontSize: 40,
                      fontFamily: "'Press Start 2P', monospace",
                    }}
                  >
                    ?
                  </div>
                  <div className="font-pixel-body text-base">
                    No public lobbies found. Create one!
                  </div>
                </div>
              ) : (
                publicLobbies.map((lobby, i) => (
                  <div
                    key={lobby.id}
                    onClick={() => setSelectedLobby(lobby.id)}
                    className="grid px-4 py-3 cursor-pointer items-center"
                    style={{
                      gridTemplateColumns: "2fr 1.4fr 0.7fr 0.8fr",
                      backgroundColor:
                        selectedLobby === lobby.id
                          ? "#1a3a1a"
                          : i % 2 === 1
                            ? "#1a1530"
                            : "transparent",
                      borderLeft:
                        selectedLobby === lobby.id
                          ? "4px solid #9bd14f"
                          : "4px solid transparent",
                      borderBottom: "1px solid #1f1a3d",
                    }}
                  >
                    <div className="min-w-0">
                      <div className="font-pixel-display text-[11px] text-parchment truncate">
                        {lobby.name}
                      </div>
                      <div className="font-pixel-body text-xs text-bone/60">
                        #{lobby.id}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <PixelAvatar
                        variant={((lobby.id || "").charCodeAt(0) % 5) + 1}
                        size={20}
                      />
                      <span className="font-pixel-body text-base text-bone truncate">
                        {lobby.host}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: lobby.max }).map((_, j) => (
                        <div
                          key={j}
                          style={{
                            width: 10,
                            height: 14,
                            backgroundColor:
                              j < lobby.current ? "#9bd14f" : "#2a234d",
                            border: "1px solid #0a0712",
                            boxShadow:
                              j < lobby.current
                                ? "inset 0 1px 0 #c8ff80"
                                : "none",
                          }}
                        />
                      ))}
                      <span className="ml-1 font-pixel-display text-[9px] text-bone/70">
                        {lobby.current}/{lobby.max}
                      </span>
                    </div>
                    <div className="flex justify-end">
                      {lobby.current >= lobby.max ? (
                        <span
                          className="font-pixel-display text-[9px] px-3 py-1.5"
                          style={{
                            backgroundColor: "#0a0712",
                            color: "#7a1530",
                            border: "2px solid #3a0a18",
                          }}
                        >
                          FULL
                        </span>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleJoinPublic(lobby.id);
                          }}
                          className="pixel-btn font-pixel-display text-[9px] px-3 py-1.5"
                          style={{
                            backgroundColor: "#9bd14f",
                            borderColor: "#6a9a30",
                            color: "#1a3a0e",
                          }}
                        >
                          ► JOIN
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div
              className="px-4 py-3 flex items-center justify-between font-pixel-body text-sm text-bone/70"
              style={{
                borderTop: "4px solid #0a0712",
                backgroundColor: "#14102a",
              }}
            >
              <div>Tip: hover a table to peek at the host's deck.</div>
              <div className="flex items-center gap-2">
                <span className="text-glow-cyan">●</span>
                <span>SERVER CONNECTED</span>
              </div>
            </div>
          </PixelPanel>
        </div>
      </div>
    </div>
  );
};

export default LobbyMuushig;
