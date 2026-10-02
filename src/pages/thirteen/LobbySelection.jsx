// THIRTEEN LOBBY — the shared GameLobby configured for Thirteen.

import React from "react";
import GameLobby from "../../components/lobby/GameLobby";

// Module-level so the object is stable across renders (GameLobby's socket
// effect depends on `events`).
const THIRTEEN = {
  id: "thirteen",
  title: "Thirteen",
  route: "/game-13",
  defaultTableName: "CR7 GOAT",
  accent: { main: "#f4c430", deep: "#c89820" },
  events: {
    list: "get_public_lobbies",
    listUpdate: "public_lobbies_update",
    unlist: "leave_public_lobbies",
    create: "create_lobby",
    join: "join_lobby",
    joined: "lobby_joined",
  },
};

export default function LobbySelection() {
  return <GameLobby game={THIRTEEN} />;
}
