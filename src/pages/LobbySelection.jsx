// LOBBY SELECTION SCREEN

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { socket } from "../utils/socket"; // Import the glue

const LobbySelection = () => {
  const navigate = useNavigate();

  // State for UI inputs
  const [playerName, setPlayerName] = useState("Player 1");
  const [lobbyName, setLobbyName] = useState("My Game Lobby");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [publicLobbies, setPublicLobbies] = useState([]);

  // --- SOCKET LISTENERS ---
  useEffect(() => {
    // Request lobby list on load
    socket.emit("get_public_lobbies");

    // Listen for updates
    socket.on("public_lobbies_update", (lobbies) => {
      setPublicLobbies(lobbies);
    });

    // Listen for triggers to refresh list
    socket.on("public_lobbies_update_trigger", () => {
      socket.emit("get_public_lobbies");
    });

    // Listen for successful join
    socket.on("lobby_joined", (data) => {
      // Navigate to game with lobby data
      navigate("/game-13", { state: { ...data, playerName } });
    });

    // Listen for errors
    socket.on("error_message", (msg) => {
      setError(msg);
      setTimeout(() => setError(""), 3000);
    });

    return () => {
      socket.off("public_lobbies_update");
      socket.off("public_lobbies_update_trigger");
      socket.off("lobby_joined");
      socket.off("error_message");
    };
  }, [navigate, playerName]);

  // --- ACTIONS ---

  const handleCreateLobby = (isPrivate) => {
    if (!playerName.trim()) {
      setError("Enter a name first!");
      return;
    }

    socket.emit("create_lobby", {
      lobbyName: lobbyName || `${playerName}'s Lobby`,
      playerName,
      isPrivate,
    });
  };

  const handleJoinPublic = (lobbyId) => {
    if (!playerName.trim()) {
      setError("Enter a name first!");
      return;
    }

    socket.emit("join_lobby", { lobbyId, playerName });
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

    socket.emit("join_lobby", { lobbyId: joinCode, playerName });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-6">
      <div className="max-w-4xl w-full bg-gray-900/80 backdrop-blur rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row border border-white/10">
        {/* LEFT PANEL: Create & Join Private */}
        <div className="w-full md:w-1/3 p-6 border-b md:border-b-0 md:border-r border-gray-700 bg-gray-800/50">
          <button
            onClick={() => navigate("/")}
            className="text-gray-400 hover:text-white mb-6 flex items-center gap-2 text-sm"
          >
            ← Back to Menu
          </button>

          <h2 className="text-xl font-bold text-white mb-6">Start Playing</h2>

          {/* Player Name Input */}
          <div className="mb-6">
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
              Your Name
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full bg-gray-700 text-white rounded p-2 border border-gray-600 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Create Section */}
          <div className="mb-8">
            <h3 className="text-sm font-bold text-blue-400 uppercase mb-3">
              Create Lobby
            </h3>
            <input
              type="text"
              placeholder="Lobby Name"
              value={lobbyName}
              onChange={(e) => setLobbyName(e.target.value)}
              className="w-full bg-gray-700 text-white rounded p-2 border border-gray-600 mb-3 text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={() => handleCreateLobby(false)}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded text-sm font-bold transition-colors"
              >
                Public
              </button>
              <button
                onClick={() => handleCreateLobby(true)}
                className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-2 rounded text-sm font-bold transition-colors"
              >
                Private
              </button>
            </div>
          </div>

          {/* Join Private Section */}
          <div>
            <h3 className="text-sm font-bold text-green-400 uppercase mb-3">
              Join via Code
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="ENTER CODE"
                maxLength={6}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="w-full bg-gray-700 text-white rounded p-2 border border-gray-600 text-center tracking-widest font-mono uppercase"
              />
              <button
                onClick={handleJoinPrivate}
                className="bg-green-600 hover:bg-green-500 text-white px-4 rounded font-bold"
              >
                →
              </button>
            </div>
            {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
          </div>
        </div>

        {/* RIGHT PANEL: Public Lobbies List */}
        <div className="w-full md:w-2/3 p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white">Public Lobbies</h2>
            <button
              onClick={() => socket.emit("get_public_lobbies")}
              className="text-blue-400 hover:text-blue-300 text-sm"
            >
              ↻ Refresh
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
            {publicLobbies.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                No public lobbies found. Create one!
              </div>
            ) : (
              publicLobbies.map((lobby) => (
                <div
                  key={lobby.id}
                  className="bg-gray-800 hover:bg-gray-750 border border-gray-700 rounded-lg p-4 flex items-center justify-between transition-colors"
                >
                  <div>
                    <div className="font-bold text-white text-lg">
                      {lobby.name}
                    </div>
                    <div className="text-sm text-gray-400">
                      Host: <span className="text-gray-300">{lobby.host}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm font-bold text-gray-300">
                        Players
                      </div>
                      <div
                        className={`text-lg font-mono ${lobby.current === lobby.max ? "text-red-400" : "text-green-400"}`}
                      >
                        {lobby.current}/{lobby.max}
                      </div>
                    </div>

                    <button
                      onClick={() => handleJoinPublic(lobby.id)}
                      disabled={lobby.current >= lobby.max}
                      className={`
                        px-6 py-2 rounded font-bold transition-colors
                        ${
                          lobby.current >= lobby.max
                            ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                            : "bg-blue-600 hover:bg-blue-500 text-white"
                        }
                      `}
                    >
                      {lobby.current >= lobby.max ? "FULL" : "JOIN"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LobbySelection;
