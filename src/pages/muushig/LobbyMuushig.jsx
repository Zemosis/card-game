// MUUSHIG LOBBY — the shared GameLobby configured for Muushig.
// The server has no Muushig handlers yet (see docs/ARCHITECTURE.md), so these
// events go unanswered until the engine lands; practice mode opens the mockup.

import React from "react";
import GameLobby from "../../components/lobby/GameLobby";

const MUUSHIG = {
  id: "muushig",
  title: "Muushig",
  route: "/game-muushig",
  defaultTableName: "Ger of the Steppe",
  accent: { main: "#e85a7a", deep: "#a83a5a" },
  events: {
    list: "get_public_lobbies_muushig",
    listUpdate: "public_lobbies_muushig_update",
    listTrigger: "public_lobbies_muushig_update_trigger",
    create: "create_lobby_muushig",
    join: "join_lobby_muushig",
    joined: "lobby_joined_muushig",
  },
};

export default function LobbyMuushig() {
  return <GameLobby game={MUUSHIG} />;
}
