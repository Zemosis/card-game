// JOIN TABLE — where invite links land (/join/:code). Joins the table with the
// visitor's identity, then opens it exactly as the lobby's JOIN button would.

import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { socket, connectSocket } from "../utils/socket";
import { useAuth } from "../hooks/useAuth";
import { gameRoute } from "../lib/games";

export default function JoinTable() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  // While a saved session loads, identity is still the guest one; joining then
  // would seat a signed-in player under their guest name.
  const { identity, loading } = useAuth();
  const [error, setError] = useState("");
  const lobbyId = code.trim().toUpperCase();
  const playerName = `${identity.name} #${identity.tag}`;

  useEffect(() => {
    if (loading) return;
    const join = () => socket.emit("join_lobby", { lobbyId, playerName });
    const onJoined = (data) => navigate(gameRoute(data.gameType), { replace: true, state: { ...data, playerName } });
    const onError = (msg) => setError(String(msg || "Lobby not found"));

    socket.on("connect", join);
    socket.on("lobby_joined", onJoined);
    socket.on("error_message", onError);
    connectSocket(identity).then(() => {
      if (socket.connected) join();
    });
    return () => {
      socket.off("connect", join);
      socket.off("lobby_joined", onJoined);
      socket.off("error_message", onError);
    };
    // Join once per code, after the session has loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobbyId, loading]);

  return (
    <div className="flex flex-col items-center justify-center gap-5 h-screen starfield font-pixel-body text-parchment text-center px-4">
      {error ? (
        <>
          <div className="font-pixel-display text-[14px]" style={{ color: "#e85a7a" }}>CAN'T JOIN THIS TABLE</div>
          <div className="font-pixel-body text-[22px] text-bone/80">{error}</div>
          <button
            onClick={() => navigate("/lobby-13")}
            className="pixel-btn font-pixel-display text-[10px] px-4 py-3"
            style={{ backgroundColor: "#463a78", borderColor: "#2a234d", color: "#ead8b1" }}
          >
            GO TO THIRTEEN LOBBY
          </button>
        </>
      ) : (
        <div className="font-pixel-display text-[14px] text-glow-gold blink">JOINING TABLE {lobbyId}...</div>
      )}
    </div>
  );
}
